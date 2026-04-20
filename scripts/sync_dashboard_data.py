#!/usr/bin/env python3
"""Generate data/dashboard-data.json from local Codex/Openclaw usage + model_cost.json."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--codex-home", default=str(Path.home() / ".codex"))
    parser.add_argument("--openclaw-home", default=str(Path.home() / ".openclaw"))
    parser.add_argument("--claude-home", default=str(Path.home() / ".claude"))
    parser.add_argument(
        "--model-cost-json",
        default=str(Path(__file__).resolve().parents[1] / "model_cost.json"),
    )
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parents[1] / "data" / "dashboard-data.json"),
    )
    parser.add_argument("--tz-offset-hours", type=int, default=8)
    return parser.parse_args()


def parse_dt(value: object) -> datetime | None:
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
        except Exception:
            return None
    return None


def extract_cached_input_tokens(usage: dict) -> int:
    direct_fields = [
        usage.get("cached_input_tokens"),
        usage.get("input_cached_tokens"),
        usage.get("cache_read_input_tokens"),
    ]
    for value in direct_fields:
        if isinstance(value, int) and value >= 0:
            return value

    details = usage.get("input_tokens_details")
    if isinstance(details, dict):
        value = details.get("cached_tokens")
        if isinstance(value, int) and value >= 0:
            return value

    prompt_details = usage.get("prompt_tokens_details")
    if isinstance(prompt_details, dict):
        value = prompt_details.get("cached_tokens")
        if isinstance(value, int) and value >= 0:
            return value

    return 0


def collect_source_files(
    codex_home: Path, openclaw_home: Path, claude_home: Path
) -> tuple[list[tuple[Path, str]], set[str]]:
    codex_files = list((codex_home / "sessions").rglob("*.jsonl")) + list(
        (codex_home / "archived_sessions").rglob("*.jsonl")
    )
    files_by_name: dict[str, Path] = {}
    for file_path in codex_files:
        if file_path.parent.name == "archived_sessions":
            files_by_name[file_path.name] = file_path
    for file_path in codex_files:
        files_by_name.setdefault(file_path.name, file_path)

    openclaw_active = list((openclaw_home / "agents").glob("*/sessions/*.jsonl"))
    openclaw_deleted = list(
        (openclaw_home / "agents").glob("*/sessions/*.jsonl.deleted.*")
    )
    openclaw_sessions_by_id: dict[str, Path] = {}
    for file_path in openclaw_deleted:
        key = file_path.name.split(".jsonl.deleted.", 1)[0]
        openclaw_sessions_by_id.setdefault(key, file_path)
    for file_path in openclaw_active:
        key = file_path.stem
        openclaw_sessions_by_id[key] = file_path

    openclaw_session_ids = set(openclaw_sessions_by_id.keys())
    openclaw_cron_files = list((openclaw_home / "cron" / "runs").glob("*.jsonl"))
    claude_files = list((claude_home / "projects").rglob("*.jsonl")) + list(
        (claude_home / "transcripts").rglob("*.jsonl")
    )

    entries: list[tuple[Path, str]] = []
    entries.extend((path, "codex_like") for path in files_by_name.values())
    entries.extend((path, "openclaw_session") for path in openclaw_sessions_by_id.values())
    entries.extend((path, "openclaw_cron") for path in openclaw_cron_files)
    entries.extend((path, "claude_jsonl") for path in claude_files)
    entries.sort(key=lambda x: str(x[0]))
    return entries, openclaw_session_ids


def collect_claude_stats_daily_tokens(
    claude_home: Path,
) -> list[tuple[str, str, int]]:
    stats_path = claude_home / "stats-cache.json"
    if not stats_path.exists():
        return []
    try:
        stats = json.loads(stats_path.read_text(encoding="utf-8"))
    except Exception:
        return []

    result: list[tuple[str, str, int]] = []
    for row in stats.get("dailyModelTokens", []):
        if not isinstance(row, dict):
            continue
        day = row.get("date")
        tokens_by_model = row.get("tokensByModel")
        if not isinstance(day, str) or not isinstance(tokens_by_model, dict):
            continue
        for model, total in tokens_by_model.items():
            if isinstance(model, str) and isinstance(total, int) and total > 0:
                result.append((day, model, total))
    return result


def main() -> None:
    args = parse_args()
    codex_home = Path(args.codex_home).expanduser()
    openclaw_home = Path(args.openclaw_home).expanduser()
    claude_home = Path(args.claude_home).expanduser()
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

    source_files, openclaw_session_ids = collect_source_files(
        codex_home, openclaw_home, claude_home
    )
    claude_stats_daily = collect_claude_stats_daily_tokens(claude_home)

    tz = timezone(timedelta(hours=args.tz_offset_hours))
    daily_model: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(
            lambda: {
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "cached_input_tokens": 0,
            }
        )
    )
    claude_usage_seen: set[tuple[str, str]] = set()

    for file_path, source_kind in source_files:
        model_points: list[tuple[datetime, str]] = []
        token_points: list[tuple[datetime, int, int, int]] = []
        usage_points: list[tuple[datetime, str | None, int, int, int, int]] = []

        for line in file_path.read_text(encoding="utf-8").splitlines():
            try:
                obj = json.loads(line)
            except Exception:
                continue

            timestamp = obj.get("timestamp")
            if timestamp is None:
                timestamp = obj.get("ts")
            if timestamp is None:
                timestamp = obj.get("runAtMs")
            if timestamp is None:
                continue
            dt = parse_dt(timestamp)
            if dt is None:
                continue

            obj_type = obj.get("type")
            payload = obj.get("payload") if isinstance(obj.get("payload"), dict) else {}
            message = obj.get("message") if isinstance(obj.get("message"), dict) else {}

            if obj_type == "turn_context":
                model = payload.get("model")
                if isinstance(model, str) and model:
                    model_points.append((dt, model))
                continue

            if obj_type == "model_change":
                model = obj.get("modelId")
                if isinstance(model, str) and model:
                    model_points.append((dt, model))
                continue

            if obj_type == "custom" and obj.get("customType") == "model-snapshot":
                data = obj.get("data") if isinstance(obj.get("data"), dict) else {}
                model = data.get("modelId")
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
                continue

            if obj_type == "message" and message.get("role") == "assistant":
                model = obj.get("model")
                if isinstance(model, str) and model:
                    model_points.append((dt, model))
                usage = (
                    message.get("usage") if isinstance(message.get("usage"), dict) else {}
                )
                input_tokens = usage.get("input_tokens", usage.get("input"))
                output_tokens = usage.get("output_tokens", usage.get("output"))
                total_tokens = usage.get("total_tokens", usage.get("totalTokens"))
                cached_input_tokens = extract_cached_input_tokens(usage)
                if isinstance(input_tokens, int) and isinstance(output_tokens, int):
                    if not isinstance(total_tokens, int):
                        total_tokens = input_tokens + output_tokens
                    usage_points.append(
                        (
                            dt,
                            model if isinstance(model, str) else None,
                            input_tokens,
                            output_tokens,
                            total_tokens,
                            cached_input_tokens,
                        )
                    )
                continue

            if obj_type == "assistant" and isinstance(message, dict):
                model = message.get("model")
                if not isinstance(model, str) or not model:
                    model = obj.get("model")
                if isinstance(model, str) and model:
                    model_points.append((dt, model))
                usage = (
                    message.get("usage") if isinstance(message.get("usage"), dict) else {}
                )
                input_tokens = usage.get("input_tokens", usage.get("input"))
                output_tokens = usage.get("output_tokens", usage.get("output"))
                total_tokens = usage.get("total_tokens", usage.get("totalTokens"))
                cached_input_tokens = extract_cached_input_tokens(usage)
                if isinstance(input_tokens, int) and isinstance(output_tokens, int):
                    if not isinstance(total_tokens, int):
                        total_tokens = input_tokens + output_tokens
                    usage_points.append(
                        (
                            dt,
                            model if isinstance(model, str) else None,
                            input_tokens,
                            output_tokens,
                            total_tokens,
                            cached_input_tokens,
                        )
                    )
                continue

            usage = obj.get("usage") if isinstance(obj.get("usage"), dict) else {}
            input_tokens = usage.get("input_tokens", usage.get("input"))
            output_tokens = usage.get("output_tokens", usage.get("output"))
            total_tokens = usage.get("total_tokens", usage.get("totalTokens"))
            cached_input_tokens = extract_cached_input_tokens(usage)
            model = obj.get("model")

            # Skip cron summary rows when the source session file exists, to avoid double counting.
            if source_kind == "openclaw_cron":
                session_id = obj.get("sessionId")
                if isinstance(session_id, str) and session_id in openclaw_session_ids:
                    continue

            if isinstance(input_tokens, int) and isinstance(output_tokens, int):
                if not isinstance(total_tokens, int):
                    total_tokens = input_tokens + output_tokens
                usage_points.append(
                    (
                        dt,
                        model if isinstance(model, str) else None,
                        input_tokens,
                        output_tokens,
                        total_tokens,
                        cached_input_tokens,
                    )
                )
                if isinstance(model, str) and model:
                    model_points.append((dt, model))

        if len(token_points) < 2 and not usage_points:
            continue

        model_points.sort(key=lambda x: x[0])
        token_points.sort(key=lambda x: x[0])
        usage_points.sort(key=lambda x: x[0])

        model_index = -1
        current_model = "unknown"

        def advance_model(target_dt: datetime) -> str:
            nonlocal model_index, current_model
            while (
                model_index + 1 < len(model_points)
                and model_points[model_index + 1][0] <= target_dt
            ):
                model_index += 1
                current_model = model_points[model_index][1]
            return current_model

        if len(token_points) >= 2:
            _, prev_input, prev_output, prev_total = token_points[0]
            advance_model(token_points[0][0])

            for dt, cur_input, cur_output, cur_total in token_points[1:]:
                model_name = advance_model(dt)
                delta_input = cur_input - prev_input if cur_input > prev_input else 0
                delta_output = cur_output - prev_output if cur_output > prev_output else 0
                delta_total = cur_total - prev_total if cur_total > prev_total else 0

                if delta_total > 0:
                    day_key = dt.astimezone(tz).date().isoformat()
                    row = daily_model[day_key][model_name]
                    row["input_tokens"] += delta_input
                    row["output_tokens"] += delta_output
                    row["total_tokens"] += delta_total
                    if source_kind == "claude_jsonl":
                        claude_usage_seen.add((day_key, model_name))

                prev_input, prev_output, prev_total = cur_input, cur_output, cur_total
        else:
            for dt, model_name, input_tokens, output_tokens, total_tokens, cached_input_tokens in usage_points:
                if total_tokens <= 0:
                    continue
                resolved_model = model_name or advance_model(dt)
                day_key = dt.astimezone(tz).date().isoformat()
                row = daily_model[day_key][resolved_model]
                row["input_tokens"] += input_tokens
                row["output_tokens"] += output_tokens
                row["total_tokens"] += total_tokens
                row["cached_input_tokens"] += min(cached_input_tokens, input_tokens)
                if source_kind == "claude_jsonl":
                    claude_usage_seen.add((day_key, resolved_model))

    # Claude stats-cache only has total tokens by model/day.
    # Backfill them only when the same day/model doesn't already have detailed usage.
    for day_key, model_name, total_tokens in claude_stats_daily:
        if (day_key, model_name) in claude_usage_seen:
            continue
        row = daily_model[day_key][model_name]
        row["input_tokens"] += total_tokens
        row["total_tokens"] += total_tokens

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
                (usage["input_tokens"] - min(usage["cached_input_tokens"], usage["input_tokens"]))
                / 1_000_000
                * pricing["input_usd_per_1m_tokens"]
            ) + (
                min(usage["cached_input_tokens"], usage["input_tokens"])
                / 1_000_000
                * pricing["cached_input_usd_per_1m_tokens"]
            )
            output_cost = (
                usage["output_tokens"] / 1_000_000 * pricing["output_usd_per_1m_tokens"]
            )
            total_cost = input_cost + output_cost
            cache_savings = (
                min(usage["cached_input_tokens"], usage["input_tokens"])
                / 1_000_000
                * (
                    pricing["input_usd_per_1m_tokens"]
                    - pricing["cached_input_usd_per_1m_tokens"]
                )
            )

            model_rows.append(
                {
                    "model": model,
                    "input_tokens": usage["input_tokens"],
                    "output_tokens": usage["output_tokens"],
                    "total_tokens": usage["total_tokens"],
                    "cached_input_tokens": usage["cached_input_tokens"],
                    "input_cost_usd": round(input_cost, 6),
                    "output_cost_usd": round(output_cost, 6),
                    "total_cost_usd": round(total_cost, 6),
                    "cache_savings_usd": round(cache_savings, 6),
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
