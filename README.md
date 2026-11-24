# FDA Market Data Tracker

This project tracks ten market items for the Financial Data Analytics Data
Tracker Project. It collects a daily close, daily percentage change, and volume
from Yahoo Finance's public Chart JSON endpoint, stores the original compressed
responses, rebuilds a reproducible history, reports the biggest moves, and
publishes a GitHub Pages site.

[![Tests](https://github.com/juliandpascu-lab/fda-data-tracker/actions/workflows/tests.yml/badge.svg)](https://github.com/juliandpascu-lab/fda-data-tracker/actions/workflows/tests.yml)

## Links

- Repository: `https://github.com/juliandpascu-lab/fda-data-tracker`
- Live site: `https://juliandpascu-lab.github.io/fda-data-tracker/`

## Tracked items

| Item ID | Ticker | Item | Category |
| --- | --- | --- | --- |
| `sp500` | `^GSPC` | S&P 500 | Index |
| `nvidia` | `NVDA` | NVIDIA | Stock |
| `palantir` | `PLTR` | Palantir | Stock |
| `q2` | `QTWO` | Q2 Holdings | Stock |
| `bitcoin` | `BTC-USD` | Bitcoin | Crypto |
| `ethereum` | `ETH-USD` | Ethereum | Crypto |
| `vanguard_morningstar` | `VTSAX` | Vanguard Morningstar Total Stock Market Index Fund | Fund |
| `hartford_schroders` | `SCVEX` | Hartford Schroders International Stock Fund Class A | Fund |
| `apple` | `AAPL` | Apple | Stock |
| `jpmorgan` | `JPM` | JPMorgan Chase | Stock |

The stable `item_id` is the key that lines an item up across days. The source
is Yahoo Finance's public Chart JSON endpoint. No login or API key is used.
The tracker requests only the ten configured tickers instead of a broad market
universe.

## Raw data and history

Each successful source response is saved exactly as JSON, compressed with gzip:

```text
data/raw/<UTC-date>/yahoo_finance_chart_<item_id>.json.gz
```

One source failure does not stop collection. A failed source writes no raw file
for that day and is recorded with `ok: false` in `data/status.json`.

`data/history.csv` is rebuilt only from the dated raw files. Its columns are:

| Column | Meaning | Unit |
| --- | --- | --- |
| `date` | UTC date of the run that produced the row | `YYYY-MM-DD` |
| `item_id` | Stable configured item key | text |
| `item` | Display name | text |
| `source` | Source identifier | text |
| `category` | Index, stock, crypto, or fund | text |
| `close_usd` | Latest close/NAV returned in the source response | USD |
| `change_pct` | Change from the previous observation in the source response | percent |
| `volume` | Latest reported trading volume | units |

Rows are sorted by `date`, then `item_id`. A source that does not report a
value leaves that field empty.

The movement rule is the absolute value of `change_pct`. The daily Issue lists
the five current items with the largest absolute percentage move and shows the
previous close, current close, and percentage change. It also lists items that
appeared or disappeared. The first successful raw date establishes the initial
inventory; later dates determine appeared and disappeared items. A same-day
rerun replaces that date's raw files and rebuilds the history.

The history build command is:

```bash
python -m data_tracker.cli build-history
```

## Status file

`data/status.json` contains `run_time`, `first_run_date`,
`days_with_success`, `items`, `new_today`, `gone_today`, and a `sources` list.
Each source entry contains `name`, `ok`, and `count`, with an error message when
the source fails.

## Pipeline and schedule

`.github/workflows/pipeline.yml` runs the Python pipeline once per day at
23:00 UTC, which is 5:00 PM Central during the current CST season. It can also
be manually dispatched. The run collects raw files, rebuilds history, writes
status, creates or updates the dated GitHub Issue, commits the generated data,
and deploys the `site/` directory to GitHub Pages.

`.github/workflows/tests.yml` runs `python -m pytest` on every push.
`.github/workflows/pages.yml` deploys site-only changes to GitHub Pages.

## Site

- `site/index.html` is the Today page. It shows the last run, source status,
  status counts, every latest item value with its change, and the biggest moves.
- `site/browse.html` shows the latest values with category and source filters,
  item-name search, numeric ascending/descending sorts, and a browser-persisted
  shortlist.
- `site/trends.html` calculates a selectable time-series chart for every
  numeric field and four history-based findings in the browser.
- `site/manifest.webmanifest` and `site/service-worker.js` make the site
  installable and available with the last loaded data when offline.

## Complete file inventory

| Path | Purpose |
| --- | --- |
| `README.md` | Requirements, sources, columns, movement rule, commands, and file inventory. |
| `.gitignore` | Local Python/cache exclusions. |
| `pyproject.toml` | Package metadata and pytest configuration. |
| `.github/workflows/pipeline.yml` | Daily collection, issue, commit, and Pages deployment. |
| `.github/workflows/pages.yml` | Pages deployment for site changes. |
| `.github/workflows/tests.yml` | Pytest on every push. |
| `data/history.csv` | Fixed-path item-per-day history. |
| `data/status.json` | Fixed-path latest-run summary. |
| `data/raw/.gitkeep` | Keeps the raw-data root in Git. |
| `data/raw/<date>/*.json.gz` | Compressed original source responses. |
| `src/data_tracker/config.py` | Ten items, tickers, categories, and source keys. |
| `src/data_tracker/schema.py` | Fixed paths and history columns. |
| `src/data_tracker/collector.py` | Public JSON collection and failure isolation. |
| `src/data_tracker/normalize.py` | Converts chart JSON to common history columns. |
| `src/data_tracker/history.py` | Rebuilds history from raw files only. |
| `src/data_tracker/status.py` | Computes and writes the status summary. |
| `src/data_tracker/issues.py` | Creates/updates daily Issues and closes the prior one. |
| `src/data_tracker/cli.py` | `run` and `build-history` commands. |
| `tests/test_collector.py` | Collection and source-failure tests. |
| `tests/test_normalize.py` | Common-column conversion tests. |
| `tests/test_history.py` | History and same-day replacement tests. |
| `tests/test_status.py` | Status and appeared/disappeared tests. |
| `tests/test_issues.py` | Movement-rule and Issue-body tests. |
| `site/index.html` | Today page. |
| `site/browse.html` | Browse/filter/shortlist page. |
| `site/trends.html` | Browser-calculated Trends page. |
| `site/app.js` | Shared data loading, Today, Browse, tables, filters, and shortlist. |
| `site/trends.js` | Browser-calculated time series and findings. |
| `site/styles.css` | Shared fonts, colors, responsive layout, tables, and charts. |
| `site/manifest.webmanifest` | Installable web-app metadata. |
| `site/service-worker.js` | Network-first loading and offline cache. |
| `site/icon.svg` | Web-app icon. |
| `site/data/history.csv` | Pages mirror of the generated history. |
| `site/data/status.json` | Pages mirror of the generated status. |

## Local commands

```bash
python -m pip install -e ".[dev]"
python -m pytest
python -m data_tracker.cli run --skip-issues --skip-commit
```
