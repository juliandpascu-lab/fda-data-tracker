from __future__ import annotations

import json
import os
from datetime import date, timedelta
from urllib.request import Request, urlopen

from .config import ITEMS_BY_ID, source_key
from .history import raw_files_for_date


def _api_request(method: str, url: str, token: str, payload: dict | None = None):
    body = json.dumps(payload).encode() if payload is not None else None
    request = Request(url, data=body, method=method, headers={"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}", "User-Agent": "fda-data-tracker", "Content-Type": "application/json"})
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read())


def _money(value: object) -> str:
    return "—" if value in (None, "") else f"${float(value):,.2f}"


def issue_body(run_date: date, rows: list[dict[str, object]], previous_rows: list[dict[str, object]]) -> str:
    previous = {str(row["item_id"]): row for row in previous_rows}
    current_ids = {str(row["item_id"]) for row in rows}
    previous_ids = set(previous)
    movers = sorted((row for row in rows if row.get("change_pct") not in (None, "")), key=lambda row: abs(float(row["change_pct"])), reverse=True)[:5]
    lines = [f"# Market snapshot — {run_date.isoformat()}", "", "Move rule: biggest movers are the five current items with the largest absolute daily percentage change from the source chart response.", "", "## Biggest moves", "", "| Item | Previous close | Current close | Change |", "| --- | ---: | ---: | ---: |"]
    lines.extend(f"| {row['item']} | {_money(previous.get(str(row['item_id']), {}).get('close_usd'))} | {_money(row.get('close_usd'))} | {float(row['change_pct']):+.2f}% |" for row in movers)
    appeared = sorted(current_ids - previous_ids)
    disappeared = sorted(previous_ids - current_ids)
    current_sources = {path.name.removesuffix(".json.gz") for path in raw_files_for_date(run_date.isoformat())}
    disappeared = [item_id for item_id in disappeared if source_key(ITEMS_BY_ID[item_id]) in current_sources]
    appeared_lines = [f"- {ITEMS_BY_ID[item_id].name}" for item_id in appeared] or ["- None"]
    disappeared_lines = [f"- {ITEMS_BY_ID[item_id].name}" for item_id in disappeared] or ["- None"]
    lines.extend(["", "## Appeared", "", *appeared_lines, "", "## Disappeared", "", *disappeared_lines])
    return "\n".join(lines) + "\n"


def sync_issue(run_date: date, rows: list[dict[str, object]], previous_rows: list[dict[str, object]]) -> None:
    token = os.environ.get("GITHUB_TOKEN")
    repository = os.environ.get("GITHUB_REPOSITORY")
    if not token or not repository:
        return
    base = f"https://api.github.com/repos/{repository}"
    issues = _api_request("GET", f"{base}/issues?state=all&per_page=100", token)
    title = run_date.isoformat()
    body = issue_body(run_date, rows, previous_rows)
    current = next((issue for issue in issues if issue.get("title") == title and "pull_request" not in issue), None)
    if current:
        _api_request("PATCH", f"{base}/issues/{current['number']}", token, {"body": body, "state": "open"})
    else:
        _api_request("POST", f"{base}/issues", token, {"title": title, "body": body})
    previous_title = (run_date - timedelta(days=1)).isoformat()
    previous_issue = next((issue for issue in issues if issue.get("title") == previous_title and issue.get("state") == "open" and "pull_request" not in issue), None)
    if previous_issue:
        _api_request("PATCH", f"{base}/issues/{previous_issue['number']}", token, {"state": "closed"})
