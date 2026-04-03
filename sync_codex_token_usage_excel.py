#!/usr/bin/env python3
"""
Sync Codex token usage into an Excel file.

Data source:
- ~/.codex/sessions/**/*.jsonl
- ~/.codex/archived_sessions/*.jsonl
- ~/.openclaw/agents/*/sessions/*.jsonl (Openclaw)
- ~/.claude/projects/**/*.jsonl and ~/.claude/stats-cache.json (Claude)

Output columns:
- 日期
- 模型1, 模型1 - 输入token数, 模型1 - 输出token数
- 模型2, 模型2 - 输入token数, 模型2 - 输出token数
- ... (expanded dynamically by max model count per day)
"""

from __future__ import annotations

import argparse
import json
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Tuple
from xml.sax.saxutils import escape


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build daily model token usage Excel from local Codex/Openclaw session files."
    )
    parser.add_argument(
        "--codex-home",
        default=str(Path.home() / ".codex"),
        help="Home directory for session files (default: ~/.codex)",
    )
    parser.add_argument(
        "--output",
        default=str(Path.cwd() / "codex-token-usage-by-model.xlsx"),
        help="Output .xlsx path (default: ./codex-token-usage-by-model.xlsx)",
    )
    parser.add_argument(
        "--tz-offset-hours",
        type=int,
        default=8,
        help="Timezone offset for daily aggregation (default: 8)",
    )
    return parser.parse_args()


def col_name(idx: int) -> str:
    name = ""
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        name = chr(65 + rem) + name
    return name


def write_simple_xlsx(table: List[List[object]], out_path: Path) -> None:
    sheet_rows = []
    for r_idx, row in enumerate(table, start=1):
        cells = []
        for c_idx, val in enumerate(row, start=1):
            ref = f"{col_name(c_idx)}{r_idx}"
            if isinstance(val, (int, float)):
                cells.append(f'<c r="{ref}"><v>{val}</v></c>')
            else:
                txt = escape(str(val))
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{txt}</t></is></c>')
        sheet_rows.append(f'<row r="{r_idx}">' + "".join(cells) + "</row>")

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        "<sheetData>"
        + "".join(sheet_rows)
        + "</sheetData>"
        "</worksheet>"
    )

    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Token Usage" sheetId="1" r:id="rId1"/></sheets>'
        "</workbook>"
    )

    content_types_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>"
    )

    rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        "</Relationships>"
    )

    wb_rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        "</Relationships>"
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml)
        zf.writestr("_rels/.rels", rels_xml)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", wb_rels_xml)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)


def build_daily_model_usage(
    codex_home: Path, tz: timezone
) -> Dict[str, Dict[str, Dict[str, int]]]:
    codex_files = list((codex_home / "sessions").rglob("*.jsonl")) + list(
        (codex_home / "archived_sessions").rglob("*.jsonl")
    )
    openclaw_active = list((codex_home / "agents").glob("*/sessions/*.jsonl"))
    openclaw_deleted = list((codex_home / "agents").glob("*/sessions/*.jsonl.deleted.*"))
    openclaw_cron_files = list((codex_home / "cron" / "runs").glob("*.jsonl"))
    claude_jsonl_files = list((codex_home / "projects").rglob("*.jsonl")) + list(
        (codex_home / "transcripts").rglob("*.jsonl")
    )
    claude_stats_path = codex_home / "stats-cache.json"

    # Deduplicate Openclaw sessions by session id.
    # Prefer active .jsonl over .jsonl.deleted.* snapshots when both exist.
    openclaw_sessions_by_id: Dict[str, Path] = {}
    for p in openclaw_deleted:
        name = p.name
        key = name.split(".jsonl.deleted.", 1)[0]
        openclaw_sessions_by_id.setdefault(key, p)
    for p in openclaw_active:
        name = p.name
        key = name[:-6] if name.endswith(".jsonl") else name
        openclaw_sessions_by_id[key] = p

    # Deduplicate Codex rollouts by filename. Prefer archived file if duplicated.
    files_by_name: Dict[str, Path] = {}
    for p in codex_files:
        if p.parent.name == "archived_sessions":
            files_by_name[p.name] = p
    for p in codex_files:
        files_by_name.setdefault(p.name, p)

    openclaw_session_ids = set(openclaw_sessions_by_id.keys())
    all_files: List[Tuple[Path, str]] = []
    all_files.extend((p, "codex_like") for p in files_by_name.values())
    all_files.extend((p, "openclaw_session") for p in openclaw_sessions_by_id.values())
    all_files.extend((p, "openclaw_cron") for p in openclaw_cron_files)
    all_files.extend((p, "claude_jsonl") for p in claude_jsonl_files)
    all_files.sort(key=lambda x: str(x[0]))

    claude_stats_daily: List[Tuple[str, str, int]] = []
    if claude_stats_path.exists():
        try:
            stats_obj = json.loads(claude_stats_path.read_text(encoding="utf-8"))
            for row in stats_obj.get("dailyModelTokens", []):
                if not isinstance(row, dict):
                    continue
                day = row.get("date")
                tokens_by_model = row.get("tokensByModel")
                if not isinstance(day, str) or not isinstance(tokens_by_model, dict):
                    continue
                for model, total in tokens_by_model.items():
                    if isinstance(model, str) and isinstance(total, int) and total > 0:
                        claude_stats_daily.append((day, model, total))
        except Exception:
            claude_stats_daily = []

    daily_model: Dict[str, Dict[str, Dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"input": 0, "output": 0, "total": 0})
    )
    claude_usage_seen: set[Tuple[str, str]] = set()

    for path, source_kind in all_files:
        model_points: List[Tuple[datetime, str]] = []
        token_points: List[Tuple[datetime, int, int, int]] = []
        usage_points: List[Tuple[datetime, str | None, int, int, int]] = []

        with path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except Exception:
                    continue

                ts = obj.get("timestamp")
                if ts is None:
                    ts = obj.get("ts")
                if ts is None:
                    ts = obj.get("runAtMs")
                if not ts:
                    continue
                dt: datetime | None = None
                if isinstance(ts, str):
                    try:
                        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    except Exception:
                        dt = None
                elif isinstance(ts, (int, float)):
                    try:
                        dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
                    except Exception:
                        dt = None
                if dt is None:
                    continue

                typ = obj.get("type")
                payload = obj.get("payload") if isinstance(obj.get("payload"), dict) else {}
                msg = obj.get("message") if isinstance(obj.get("message"), dict) else {}

                if typ == "turn_context":
                    model = payload.get("model")
                    if isinstance(model, str) and model:
                        model_points.append((dt, model))
                    continue

                if typ == "model_change":
                    model = obj.get("modelId")
                    if isinstance(model, str) and model:
                        model_points.append((dt, model))
                    continue

                if typ == "custom" and obj.get("customType") == "model-snapshot":
                    data = obj.get("data") if isinstance(obj.get("data"), dict) else {}
                    model = data.get("modelId")
                    if isinstance(model, str) and model:
                        model_points.append((dt, model))
                    continue

                if typ == "event_msg" and payload.get("type") == "token_count":
                    info = payload.get("info") if isinstance(payload.get("info"), dict) else {}
                    ttu = (
                        info.get("total_token_usage")
                        if isinstance(info.get("total_token_usage"), dict)
                        else {}
                    )
                    i = ttu.get("input_tokens")
                    o = ttu.get("output_tokens")
                    t = ttu.get("total_tokens")
                    if all(isinstance(x, int) for x in (i, o, t)):
                        token_points.append((dt, i, o, t))
                    continue

                if typ == "message" and msg.get("role") == "assistant":
                    msg_model = obj.get("model")
                    if not isinstance(msg_model, str) or not msg_model:
                        msg_inner_model = msg.get("model")
                        if isinstance(msg_inner_model, str) and msg_inner_model:
                            msg_model = msg_inner_model
                    if isinstance(msg_model, str) and msg_model:
                        model_points.append((dt, msg_model))
                    usage = msg.get("usage") if isinstance(msg.get("usage"), dict) else {}
                    i = usage.get("input_tokens", usage.get("input"))
                    o = usage.get("output_tokens", usage.get("output"))
                    t = usage.get("total_tokens", usage.get("totalTokens"))
                    if isinstance(i, int) and isinstance(o, int):
                        if not isinstance(t, int):
                            t = i + o
                        usage_points.append((dt, msg_model if isinstance(msg_model, str) else None, i, o, t))
                    continue

                if typ == "assistant" and isinstance(msg, dict):
                    msg_model = msg.get("model")
                    if isinstance(msg_model, str) and msg_model:
                        model_points.append((dt, msg_model))
                    usage = msg.get("usage") if isinstance(msg.get("usage"), dict) else {}
                    i = usage.get("input_tokens", usage.get("input"))
                    o = usage.get("output_tokens", usage.get("output"))
                    t = usage.get("total_tokens", usage.get("totalTokens"))
                    if isinstance(i, int) and isinstance(o, int):
                        if not isinstance(t, int):
                            t = i + o
                        usage_points.append((dt, msg_model if isinstance(msg_model, str) else None, i, o, t))
                    continue

                usage = obj.get("usage") if isinstance(obj.get("usage"), dict) else {}
                i = usage.get("input_tokens", usage.get("input"))
                o = usage.get("output_tokens", usage.get("output"))
                t = usage.get("total_tokens", usage.get("totalTokens"))
                model = obj.get("model")

                # Skip Openclaw cron summary rows when matching session files exist.
                if source_kind == "openclaw_cron":
                    session_id = obj.get("sessionId")
                    if isinstance(session_id, str) and session_id in openclaw_session_ids:
                        continue

                if isinstance(i, int) and isinstance(o, int):
                    if not isinstance(t, int):
                        t = i + o
                    usage_points.append((dt, model if isinstance(model, str) else None, i, o, t))
                    if isinstance(model, str) and model:
                        model_points.append((dt, model))

        if len(token_points) < 2 and not usage_points:
            continue

        model_points.sort(key=lambda x: x[0])
        token_points.sort(key=lambda x: x[0])
        usage_points.sort(key=lambda x: x[0])

        mi = -1
        current_model = "unknown"

        def advance_model(target_dt: datetime) -> str:
            nonlocal mi, current_model
            while mi + 1 < len(model_points) and model_points[mi + 1][0] <= target_dt:
                mi += 1
                current_model = model_points[mi][1]
            return current_model

        if len(token_points) >= 2:
            prev_dt, prev_i, prev_o, prev_t = token_points[0]
            advance_model(prev_dt)

            for dt, ci, co, ct in token_points[1:]:
                model = advance_model(dt)

                di = ci - prev_i if ci > prev_i else 0
                do = co - prev_o if co > prev_o else 0
                dtok = ct - prev_t if ct > prev_t else 0

                if dtok > 0:
                    day = dt.astimezone(tz).date().isoformat()
                    row = daily_model[day][model]
                    row["input"] += di
                    row["output"] += do
                    row["total"] += dtok
                    if source_kind == "claude_jsonl":
                        claude_usage_seen.add((day, model))

                prev_dt, prev_i, prev_o, prev_t = dt, ci, co, ct
        else:
            for dt, model_from_usage, i, o, t in usage_points:
                model = model_from_usage or advance_model(dt)
                if t <= 0:
                    continue
                day = dt.astimezone(tz).date().isoformat()
                row = daily_model[day][model]
                row["input"] += i
                row["output"] += o
                row["total"] += t
                if source_kind == "claude_jsonl":
                    claude_usage_seen.add((day, model))

    # Claude stats-cache provides total tokens by day/model only; backfill missing days/models.
    for day, model, total in claude_stats_daily:
        if (day, model) in claude_usage_seen:
            continue
        row = daily_model[day][model]
        row["input"] += total
        row["total"] += total

    return daily_model


def build_table(daily_model: Dict[str, Dict[str, Dict[str, int]]]) -> List[List[object]]:
    rows: List[Tuple[str, List[Tuple[str, Dict[str, int]]]]] = []
    for day in sorted(daily_model.keys()):
        models = [(m, v) for m, v in daily_model[day].items() if v["total"] > 0]
        if not models:
            continue
        models.sort(key=lambda x: (-x[1]["total"], x[0]))
        rows.append((day, models))

    max_models = max((len(models) for _, models in rows), default=0)

    header: List[object] = ["日期"]
    for i in range(1, max_models + 1):
        header.extend(
            [
                f"模型{i}",
                f"模型{i} - 输入token数",
                f"模型{i} - 输出token数",
            ]
        )

    table: List[List[object]] = [header]
    for day, models in rows:
        row: List[object] = [day]
        for model, values in models:
            row.extend([model, values["input"], values["output"]])
        need = 1 + max_models * 3
        if len(row) < need:
            row.extend([""] * (need - len(row)))
        table.append(row)

    return table


def main() -> None:
    args = parse_args()
    codex_home = Path(args.codex_home).expanduser()
    out_path = Path(args.output).expanduser()
    tz = timezone(timedelta(hours=args.tz_offset_hours))

    daily_model = build_daily_model_usage(codex_home, tz)
    table = build_table(daily_model)
    write_simple_xlsx(table, out_path)

    print(f"output: {out_path}")
    print(f"rows: {max(len(table) - 1, 0)}")


if __name__ == "__main__":
    main()
