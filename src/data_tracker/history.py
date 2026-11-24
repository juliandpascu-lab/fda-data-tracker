from __future__ import annotations

import csv
from datetime import date
from pathlib import Path

from .normalize import normalize_raw_file
from .schema import HISTORY_COLUMNS, HISTORY_PATH, RAW_DIR


def raw_dates(raw_dir: Path = RAW_DIR) -> list[str]:
    return sorted(path.name for path in raw_dir.iterdir() if path.is_dir() and path.name[:4].isdigit()) if raw_dir.exists() else []


def raw_files_for_date(day: str, raw_dir: Path = RAW_DIR) -> list[Path]:
    path = raw_dir / day
    return sorted(path.glob("*.json.gz")) if path.exists() else []


def build_rows(raw_dir: Path = RAW_DIR) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for day in raw_dates(raw_dir):
        for path in raw_files_for_date(day, raw_dir):
            rows.append(normalize_raw_file(path, day))
    return sorted(rows, key=lambda row: (str(row["date"]), str(row["item_id"])))


def write_history(rows: list[dict[str, object]], output: Path = HISTORY_PATH) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=HISTORY_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") if row.get(column, "") is not None else "" for column in HISTORY_COLUMNS})


def build_history(raw_dir: Path = RAW_DIR, output: Path = HISTORY_PATH) -> list[dict[str, object]]:
    rows = build_rows(raw_dir)
    write_history(rows, output)
    return rows
