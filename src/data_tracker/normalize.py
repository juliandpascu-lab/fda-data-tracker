from __future__ import annotations

import gzip
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import ITEMS_BY_ID, SOURCE_NAME, source_key


def _observations(payload: dict[str, Any]) -> list[tuple[int, float, float | None]]:
    result = payload.get("chart", {}).get("result") or []
    if not result:
        raise ValueError("chart response has no result")
    chart = result[0]
    timestamps = chart.get("timestamp") or []
    quotes = ((chart.get("indicators") or {}).get("quote") or [{}])[0]
    closes = quotes.get("close") or []
    volumes = quotes.get("volume") or []
    observations = []
    for index, timestamp in enumerate(timestamps):
        close = closes[index] if index < len(closes) else None
        if close is None:
            continue
        volume = volumes[index] if index < len(volumes) else None
        observations.append((int(timestamp), float(close), float(volume) if volume is not None else None))
    if not observations:
        raise ValueError("chart response has no close observations")
    return observations


def normalize_payload(payload: dict[str, Any], item_id: str, date: str) -> dict[str, Any]:
    item = ITEMS_BY_ID[item_id]
    observations = _observations(payload)
    timestamp, close, volume = observations[-1]
    previous_close = observations[-2][1] if len(observations) >= 2 else None
    change_pct = None
    if previous_close not in (None, 0):
        change_pct = round((close - previous_close) / previous_close * 100, 6)
    observed_date = datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()
    return {
        "date": date,
        "item_id": item.item_id,
        "item": item.name,
        "source": SOURCE_NAME,
        "category": item.category,
        "close_usd": round(close, 6),
        "change_pct": change_pct,
        "volume": volume,
        "observed_date": observed_date,
    }


def normalize_raw_file(path: Path, date: str) -> dict[str, Any]:
    filename = path.name.removesuffix(".json.gz")
    prefix = f"{SOURCE_NAME}_"
    if not filename.startswith(prefix):
        raise ValueError(f"unknown raw source filename: {path.name}")
    item_id = filename.removeprefix(prefix)
    if item_id not in ITEMS_BY_ID:
        raise ValueError(f"unknown item in raw filename: {item_id}")
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        payload = json.load(handle)
    return normalize_payload(payload, item_id, date)
