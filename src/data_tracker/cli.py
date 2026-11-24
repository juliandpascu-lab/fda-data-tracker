from __future__ import annotations

import argparse
import subprocess
from datetime import datetime, timezone

from .collector import collect
from .history import build_history, build_rows
from .issues import sync_issue
from .schema import HISTORY_PATH, STATUS_PATH
from .status import build_status, sync_site_data, write_status


def commit_generated(run_date: str) -> None:
    subprocess.run(["git", "add", "data", "site/data"], check=True)
    if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode == 0:
        return
    subprocess.run(["git", "commit", "-m", f"Daily market snapshot {run_date}"], check=True)
    subprocess.run(["git", "push"], check=True)


def run_pipeline(skip_issues: bool = False, skip_commit: bool = False) -> None:
    now = datetime.now(timezone.utc)
    run_date = now.date()
    source_results = collect(run_date)
    rows = build_history()
    status = build_status(now, source_results, rows)
    write_status(status)
    sync_site_data()
    latest_date = max((row["date"] for row in rows), default="")
    previous_date = max((row["date"] for row in rows if row["date"] < latest_date), default="")
    if not skip_issues:
        sync_issue(run_date, [row for row in rows if row["date"] == latest_date], [row for row in rows if row["date"] == previous_date])
    if not skip_commit:
        commit_generated(run_date.isoformat())
    print(f"run_date={run_date} rows={len(rows)} status={STATUS_PATH} history={HISTORY_PATH}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Daily market data tracker")
    subparsers = parser.add_subparsers(dest="command", required=True)
    run_parser = subparsers.add_parser("run")
    run_parser.add_argument("--skip-issues", action="store_true")
    run_parser.add_argument("--skip-commit", action="store_true")
    subparsers.add_parser("build-history")
    args = parser.parse_args()
    if args.command == "run":
        run_pipeline(args.skip_issues, args.skip_commit)
    else:
        rows = build_history()
        print(f"rebuilt {len(rows)} history rows from raw files")


if __name__ == "__main__":
    main()
