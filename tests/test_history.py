import gzip
import json

from data_tracker.history import build_history

from conftest import chart_payload


def write_raw(raw_dir, day, item_id="nvidia", closes=(100, 110)):
    directory = raw_dir / day
    directory.mkdir(parents=True, exist_ok=True)
    with gzip.open(directory / f"yahoo_finance_chart_{item_id}.json.gz", "wt", encoding="utf-8") as handle:
        json.dump(chart_payload(closes), handle)


def test_history_is_sorted_and_has_one_row_per_item_day(tmp_path):
    raw = tmp_path / "raw"
    output = tmp_path / "history.csv"
    write_raw(raw, "2026-11-25", closes=(100, 120))
    write_raw(raw, "2026-11-24", closes=(100, 110))
    rows = build_history(raw, output)
    assert [(row["date"], row["item_id"]) for row in rows] == [("2026-11-24", "nvidia"), ("2026-11-25", "nvidia")]
    assert output.read_text(encoding="utf-8").splitlines()[1].startswith("2026-11-24,nvidia,")


def test_same_day_rebuild_replaces_the_snapshot_without_duplicate_rows(tmp_path):
    raw = tmp_path / "raw"
    output = tmp_path / "history.csv"
    write_raw(raw, "2026-11-24", closes=(100, 110))
    first = build_history(raw, output)
    write_raw(raw, "2026-11-24", closes=(100, 135))
    second = build_history(raw, output)
    assert len(first) == len(second) == 1
    assert second[0]["close_usd"] == 135
    assert output.read_text(encoding="utf-8").count("2026-11-24") == 1
