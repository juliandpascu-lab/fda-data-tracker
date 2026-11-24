from dataclasses import dataclass


@dataclass(frozen=True)
class Item:
    item_id: str
    ticker: str
    name: str
    category: str


SOURCE_NAME = "yahoo_finance_chart"

ITEMS = (
    Item("sp500", "^GSPC", "S&P 500", "Index"),
    Item("nvidia", "NVDA", "NVIDIA", "Stock"),
    Item("palantir", "PLTR", "Palantir", "Stock"),
    Item("q2", "QTWO", "Q2 Holdings", "Stock"),
    Item("bitcoin", "BTC-USD", "Bitcoin", "Crypto"),
    Item("ethereum", "ETH-USD", "Ethereum", "Crypto"),
    Item("vanguard_morningstar", "VTSAX", "Vanguard Morningstar Total Stock Market Index Fund", "Fund"),
    Item("hartford_schroders", "SCVEX", "Hartford Schroders International Stock Fund Class A", "Fund"),
    Item("apple", "AAPL", "Apple", "Stock"),
    Item("jpmorgan", "JPM", "JPMorgan Chase", "Stock"),
)

ITEMS_BY_ID = {item.item_id: item for item in ITEMS}
ITEMS_BY_TICKER = {item.ticker: item for item in ITEMS}


def source_key(item: Item) -> str:
    return f"{SOURCE_NAME}_{item.item_id}"
