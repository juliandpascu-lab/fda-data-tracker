from datetime import datetime, timezone
from pathlib import Path

from data_tracker import status
from data_tracker.config import source_key, ITEMS_BY_ID


def test_status_counts_latest_items_and_gone_items(monkeypatch):
    monkeypatch.setattr(status, "raw_dates", lambda: ["2026-11-23", "2026-11-24"])
    monkeypatch.setattr(status, "raw_files_for_date", lambda day: [Path(f"{source_key(ITEMS_BY_ID['nvidia'])}.json.gz")])
    rows = [
        {"date": "2026-11-23", "item_id": "nvidia"},
        {"date": "2026-11-23", "item_id": "apple"},
        {"date": "2026-11-24", "item_id": "nvidia"},
    ]
    result = status.build_status(datetime(2026, 11, 24, 23, tzinfo=timezone.utc), [{"name": "feed", "ok": True, "count": 1}], rows)
    assert result["first_run_date"] == "2026-11-23"
    assert result["days_with_success"] == 2
    assert result["items"] == 1
    assert result["new_today"] == 0
    assert result["gone_today"] == 0
    assert result["run_window"] == "manual"


def test_status_marks_an_item_gone_when_its_source_returned_without_it(monkeypatch):
    monkeypatch.setattr(status, "raw_dates", lambda: ["2026-11-23", "2026-11-24"])
    monkeypatch.setattr(status, "raw_files_for_date", lambda day: [Path(f"{source_key(ITEMS_BY_ID['apple'])}.json.gz")])
    rows = [{"date": "2026-11-23", "item_id": "apple"}]
    result = status.build_status(datetime(2026, 11, 24, 23, tzinfo=timezone.utc), [], rows)
    assert result["gone_today"] == 1
