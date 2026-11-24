from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
HISTORY_PATH = ROOT / "data" / "history.csv"
STATUS_PATH = ROOT / "data" / "status.json"
SITE_DATA_DIR = ROOT / "site" / "data"

HISTORY_COLUMNS = [
    "date",
    "item_id",
    "item",
    "source",
    "category",
    "close_usd",
    "change_pct",
    "volume",
]
