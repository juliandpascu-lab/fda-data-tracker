from datetime import date
from pathlib import Path

from data_tracker import issues
from data_tracker.config import source_key, ITEMS_BY_ID


def test_issue_move_rule_lists_five_largest_absolute_moves(monkeypatch):
    current = [{"item_id": f"n{i}", "item": f"Name {i}", "close_usd": 100 + i, "change_pct": i} for i in range(1, 7)]
    previous = [{"item_id": f"n{i}", "item": f"Name {i}", "close_usd": 99, "change_pct": ""} for i in range(1, 7)]
    monkeypatch.setattr(issues, "raw_files_for_date", lambda day: [])
    body = issues.issue_body(date(2026, 11, 24), current, previous)
    assert "Name 6" in body
    assert "Name 2" in body
    assert "Name 1" not in body.split("## Appeared")[0]
    assert body.count("| Name ") == 5


def test_issue_body_reports_appeared_and_disappeared_items(monkeypatch):
    current = [{"item_id": "nvidia", "item": "NVIDIA", "close_usd": 120, "change_pct": 2}]
    previous = [{"item_id": "apple", "item": "Apple", "close_usd": 100, "change_pct": ""}]
    current_source_files = [Path(f"{source_key(ITEMS_BY_ID['nvidia'])}.json.gz"), Path(f"{source_key(ITEMS_BY_ID['apple'])}.json.gz")]
    monkeypatch.setattr(issues, "raw_files_for_date", lambda day: current_source_files)
    body = issues.issue_body(date(2026, 11, 24), current, previous)
    assert "## Appeared" in body
    assert "## Disappeared" in body
    assert "NVIDIA" in body
    assert "Apple" in body
