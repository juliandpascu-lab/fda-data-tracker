import json


def chart_payload(closes=(100.0, 110.0), volumes=(1000, 2000)):
    return {
        "chart": {
            "result": [{
                "timestamp": [1704067200 + index * 86400 for index in range(len(closes))],
                "indicators": {"quote": [{"close": list(closes), "volume": list(volumes)}]},
            }],
            "error": None,
        }
    }


def chart_bytes(closes=(100.0, 110.0), volumes=(1000, 2000)):
    return json.dumps(chart_payload(closes, volumes)).encode("utf-8")
