import gzip
import json

import pytest

from data_tracker.config import ITEMS, SOURCE_NAME, source_key
from data_tracker.normalize import normalize_payload, normalize_raw_file
from data_tracker.schema import HISTORY_COLUMNS

from conftest import chart_payload


@pytest.mark.parametrize("item", ITEMS, ids=lambda item: item.item_id)
def test_every_configured_source_converts_to_common_columns(item):
    row = normalize_payload(chart_payload((100, 110), (1000, 2000)), item.item_id, "2026-11-24")
    assert set(HISTORY_COLUMNS).issubset(row)
    assert row["item_id"] == item.item_id
    assert row["item"] == item.name
    assert row["source"] == SOURCE_NAME
    assert row["close_usd"] == 110
    assert row["change_pct"] == 10
    assert row["volume"] == 2000


def test_raw_gzip_conversion_uses_stable_filename_key(tmp_path):
    path = tmp_path / f"{source_key(ITEMS[0])}.json.gz"
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        json.dump(chart_payload(), handle)
    row = normalize_raw_file(path, "2026-11-24")
    assert row["item_id"] == ITEMS[0].item_id
    assert row["date"] == "2026-11-24"
