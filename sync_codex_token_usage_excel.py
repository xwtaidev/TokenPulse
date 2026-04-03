#!/usr/bin/env python3
"""
Sync Codex token usage into an Excel file.

Data source:
- ~/.codex/sessions/**/*.jsonl
- ~/.codex/archived_sessions/*.jsonl

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
        description="Build daily model token usage Excel from local Codex session files."
    )
    parser.add_argument(
        "--codex-home",
        default=str(Path.home() / ".codex"),
        help="Codex home directory (default: ~/.codex)",
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
    all_files = list((codex_home / "sessions").rglob("*.jsonl")) + list(
        (codex_home / "archived_sessions").rglob("*.jsonl")
    )

    # Deduplicate by rollout filename. Prefer archived file if duplicated.
    files_by_name: Dict[str, Path] = {}
    for p in all_files:
        if p.parent.name == "archived_sessions":
            files_by_name[p.name] = p
    for p in all_files:
        files_by_name.setdefault(p.name, p)

    daily_model: Dict[str, Dict[str, Dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"input": 0, "output": 0, "total": 0})
    )

    for path in sorted(files_by_name.values()):
        model_points: List[Tuple[datetime, str]] = []
        token_points: List[Tuple[datetime, int, int, int]] = []

        with path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except Exception:
                    continue

                ts = obj.get("timestamp")
                if not ts:
                    continue
                try:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except Exception:
                    continue

                typ = obj.get("type")
                payload = obj.get("payload") if isinstance(obj.get("payload"), dict) else {}

                if typ == "turn_context":
                    model = payload.get("model")
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

        if len(token_points) < 2:
            continue

        model_points.sort(key=lambda x: x[0])
        token_points.sort(key=lambda x: x[0])

        mi = -1
        current_model = "unknown"

        prev_dt, prev_i, prev_o, prev_t = token_points[0]
        while mi + 1 < len(model_points) and model_points[mi + 1][0] <= prev_dt:
            mi += 1
            current_model = model_points[mi][1]

        for dt, ci, co, ct in token_points[1:]:
            while mi + 1 < len(model_points) and model_points[mi + 1][0] <= dt:
                mi += 1
                current_model = model_points[mi][1]

            di = ci - prev_i if ci > prev_i else 0
            do = co - prev_o if co > prev_o else 0
            dtok = ct - prev_t if ct > prev_t else 0

            if dtok > 0:
                day = dt.astimezone(tz).date().isoformat()
                row = daily_model[day][current_model]
                row["input"] += di
                row["output"] += do
                row["total"] += dtok

            prev_dt, prev_i, prev_o, prev_t = dt, ci, co, ct

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
