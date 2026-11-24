from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from shutil import copy2

from .config import ITEMS, source_key
from .history import raw_dates, raw_files_for_date
from .schema import HISTORY_PATH, SITE_DATA_DIR, STATUS_PATH


def _utc_iso(value: datetime | None = None) -> str:
    value = value or datetime.now(timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def build_status(run_time: datetime, source_results: list[dict[str, object]], rows: list[dict[str, object]]) -> dict[str, object]:
    dates = raw_dates()
    latest_date = dates[-1] if dates else ""
    previous_date = dates[-2] if len(dates) > 1 else None
    latest_rows = [row for row in rows if row["date"] == latest_date]
    previous_rows = [row for row in rows if previous_date and row["date"] == previous_date]
    latest_ids = {str(row["item_id"]) for row in latest_rows}
    previous_ids = {str(row["item_id"]) for row in previous_rows}
    current_sources = {path.name.removesuffix(".json.gz") for path in raw_files_for_date(latest_date)} if latest_date else set()
    previous_by_id = {str(row["item_id"]): row for row in previous_rows}
    gone = 0
    for item in ITEMS:
        if item.item_id in previous_ids and item.item_id not in latest_ids and source_key(item) in current_sources:
            gone += 1
    return {
        "run_time": _utc_iso(run_time),
        "first_run_date": dates[0] if dates else "",
        "days_with_success": len(dates),
        "items": len(latest_ids),
        "new_today": len(latest_ids - previous_ids),
        "gone_today": gone,
        "sources": source_results,
    }


def write_status(status: dict[str, object], output: Path = STATUS_PATH) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")


def sync_site_data() -> None:
    SITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    copy2(HISTORY_PATH, SITE_DATA_DIR / "history.csv")
    copy2(STATUS_PATH, SITE_DATA_DIR / "status.json")
