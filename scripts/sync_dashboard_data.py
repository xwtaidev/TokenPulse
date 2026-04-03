#!/usr/bin/env python3
"""Generate data/dashboard-data.json from local Codex sessions + model_cost.json."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--codex-home", default=str(Path.home() / ".codex"))
    parser.add_argument(
        "--model-cost-json",
        default=str(Path(__file__).resolve().parents[2] / "model_cost.json"),
    )
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parents[1] / "data" / "dashboard-data.json"),
    )
    parser.add_argument("--tz-offset-hours", type=int, default=8)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    codex_home = Path(args.codex_home).expanduser()
    model_cost_path = Path(args.model_cost_json).expanduser()
    out_path = Path(args.output).expanduser()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    model_cost = json.loads(model_cost_path.read_text(encoding="utf-8"))
    price_map: dict[str, dict[str, float | str | None]] = {}
    for item in model_cost.get("models", []):
        model = item.get("model")
        pricing = item.get("pricing") or {}
        if model:
            price_map[model] = {
                "input_usd_per_1m_tokens": float(
                    pricing.get("input_usd_per_1m_tokens", 0) or 0
                ),
                "output_usd_per_1m_tokens": float(
                    pricing.get("output_usd_per_1m_tokens", 0) or 0
                ),
                "cached_input_usd_per_1m_tokens": float(
                    pricing.get("cached_input_usd_per_1m_tokens", 0) or 0
                ),
                "source_url": pricing.get("source_url"),
            }

    all_files = list((codex_home / "sessions").rglob("*.jsonl")) + list(
        (codex_home / "archived_sessions").rglob("*.jsonl")
    )
    files_by_name: dict[str, Path] = {}
    for file_path in all_files:
        if file_path.parent.name == "archived_sessions":
            files_by_name[file_path.name] = file_path
    for file_path in all_files:
        files_by_name.setdefault(file_path.name, file_path)

    tz = timezone(timedelta(hours=args.tz_offset_hours))
    daily_model: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(
            lambda: {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        )
    )

    for file_path in sorted(files_by_name.values()):
        model_points: list[tuple[datetime, str]] = []
        token_points: list[tuple[datetime, int, int, int]] = []

        for line in file_path.read_text(encoding="utf-8").splitlines():
            try:
                obj = json.loads(line)
            except Exception:
                continue

            timestamp = obj.get("timestamp")
            if not timestamp:
                continue
            try:
                dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except Exception:
                continue

            obj_type = obj.get("type")
            payload = obj.get("payload") if isinstance(obj.get("payload"), dict) else {}

            if obj_type == "turn_context":
                model = payload.get("model")
                if isinstance(model, str) and model:
                    model_points.append((dt, model))
                continue

            if obj_type == "event_msg" and payload.get("type") == "token_count":
                info = payload.get("info") if isinstance(payload.get("info"), dict) else {}
                total_usage = (
                    info.get("total_token_usage")
                    if isinstance(info.get("total_token_usage"), dict)
                    else {}
                )
                input_tokens = total_usage.get("input_tokens")
                output_tokens = total_usage.get("output_tokens")
                total_tokens = total_usage.get("total_tokens")
                if all(
                    isinstance(v, int)
                    for v in (input_tokens, output_tokens, total_tokens)
                ):
                    token_points.append((dt, input_tokens, output_tokens, total_tokens))

        if len(token_points) < 2:
            continue

        model_points.sort(key=lambda x: x[0])
        token_points.sort(key=lambda x: x[0])

        model_index = -1
        current_model = "unknown"
        _, prev_input, prev_output, prev_total = token_points[0]

        while model_index + 1 < len(model_points) and model_points[model_index + 1][
            0
        ] <= token_points[0][0]:
            model_index += 1
            current_model = model_points[model_index][1]

        for dt, cur_input, cur_output, cur_total in token_points[1:]:
            while model_index + 1 < len(model_points) and model_points[model_index + 1][
                0
            ] <= dt:
                model_index += 1
                current_model = model_points[model_index][1]

            delta_input = cur_input - prev_input if cur_input > prev_input else 0
            delta_output = cur_output - prev_output if cur_output > prev_output else 0
            delta_total = cur_total - prev_total if cur_total > prev_total else 0

            if delta_total > 0:
                day_key = dt.astimezone(tz).date().isoformat()
                row = daily_model[day_key][current_model]
                row["input_tokens"] += delta_input
                row["output_tokens"] += delta_output
                row["total_tokens"] += delta_total

            prev_input, prev_output, prev_total = cur_input, cur_output, cur_total

    all_models = sorted({m for day in daily_model.values() for m in day.keys()})
    summary = {
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_tokens": 0,
        "total_cost_usd": 0.0,
    }

    daily_rows = []
    for day in sorted(daily_model.keys()):
        model_rows = []
        day_input = day_output = day_total = 0
        day_cost = 0.0

        for model in sorted(daily_model[day].keys()):
            usage = daily_model[day][model]
            pricing = price_map.get(
                model,
                {
                    "input_usd_per_1m_tokens": 0.0,
                    "output_usd_per_1m_tokens": 0.0,
                    "cached_input_usd_per_1m_tokens": 0.0,
                    "source_url": None,
                },
            )
            input_cost = (
                usage["input_tokens"] / 1_000_000 * pricing["input_usd_per_1m_tokens"]
            )
            output_cost = (
                usage["output_tokens"] / 1_000_000 * pricing["output_usd_per_1m_tokens"]
            )
            total_cost = input_cost + output_cost

            model_rows.append(
                {
                    "model": model,
                    "input_tokens": usage["input_tokens"],
                    "output_tokens": usage["output_tokens"],
                    "total_tokens": usage["total_tokens"],
                    "input_cost_usd": round(input_cost, 6),
                    "output_cost_usd": round(output_cost, 6),
                    "total_cost_usd": round(total_cost, 6),
                }
            )
            day_input += usage["input_tokens"]
            day_output += usage["output_tokens"]
            day_total += usage["total_tokens"]
            day_cost += total_cost

        daily_rows.append(
            {
                "date": day,
                "input_tokens": day_input,
                "output_tokens": day_output,
                "total_tokens": day_total,
                "total_cost_usd": round(day_cost, 6),
                "models": sorted(model_rows, key=lambda x: x["total_tokens"], reverse=True),
            }
        )

        summary["total_input_tokens"] += day_input
        summary["total_output_tokens"] += day_output
        summary["total_tokens"] += day_total
        summary["total_cost_usd"] += day_cost

    summary["total_cost_usd"] = round(summary["total_cost_usd"], 6)
    output = {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "timezone": "Asia/Shanghai",
        "pricing_unit": "USD per 1M tokens",
        "models": all_models,
        "pricing": price_map,
        "summary": summary,
        "daily": daily_rows,
    }

    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {out_path} with {len(daily_rows)} days")


if __name__ == "__main__":
    main()
