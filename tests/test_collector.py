import gzip

from data_tracker import collector
from data_tracker.config import ITEMS, source_key

from conftest import chart_bytes


def test_collection_writes_compressed_original_response_for_each_item(tmp_path, monkeypatch):
    monkeypatch.setattr(collector, "fetch_raw", lambda ticker: chart_bytes())
    results = collector.collect(__import__("datetime").date(2026, 11, 24), tmp_path)
    assert len(results) == len(ITEMS)
    assert all(result["ok"] for result in results)
    for item in ITEMS:
        path = tmp_path / "2026-11-24" / f"{source_key(item)}.json.gz"
        assert path.exists()
        with gzip.open(path, "rb") as handle:
            assert handle.read().startswith(b"{")


def test_one_failed_source_does_not_stop_collection_or_leave_a_raw_file(tmp_path, monkeypatch):
    def fake_fetch(ticker):
        if ticker == "QTWO":
            raise OSError("temporary source failure")
        return chart_bytes()

    monkeypatch.setattr(collector, "fetch_raw", fake_fetch)
    results = collector.collect(__import__("datetime").date(2026, 11, 24), tmp_path)
    failed = next(result for result in results if result["name"].endswith("_q2"))
    assert failed["ok"] is False
    assert not (tmp_path / "2026-11-24" / "yahoo_finance_chart_q2.json.gz").exists()
    assert len(list((tmp_path / "2026-11-24").glob("*.json.gz"))) == len(ITEMS) - 1
