from __future__ import annotations

import gzip
from datetime import date
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

from .config import ITEMS, source_key
from .schema import RAW_DIR


API_TEMPLATE = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=5d&interval=1d&events=div%2Csplits"


def fetch_raw(ticker: str, timeout: int = 30) -> bytes:
    url = API_TEMPLATE.format(ticker=quote(ticker, safe=""))
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "FDA-Data-Tracker/0.1"})
    with urlopen(request, timeout=timeout) as response:
        body = response.read()
    if not body.startswith(b"{"):
        raise ValueError("source response was not JSON")
    return body


def collect(run_date: date, raw_dir: Path = RAW_DIR) -> list[dict[str, object]]:
    day_dir = raw_dir / run_date.isoformat()
    day_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, object]] = []
    for item in ITEMS:
        output = day_dir / f"{source_key(item)}.json.gz"
        if output.exists():
            output.unlink()
        try:
            body = fetch_raw(item.ticker)
            with gzip.open(output, "wb") as handle:
                handle.write(body)
            results.append({"name": source_key(item), "ok": True, "count": 1})
        except Exception as exc:  # one source must not stop the run
            output.unlink(missing_ok=True)
            results.append({"name": source_key(item), "ok": False, "count": 0, "error": str(exc)})
    return results
