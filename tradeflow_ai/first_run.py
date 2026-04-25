import json

from app import ensure_journal, run_analysis


if __name__ == "__main__":
    ensure_journal()
    state = run_analysis(symbol="BTC-USD", timeframe="1d", model_name="llama3")
    print(json.dumps(state.get("decision", {}), indent=2))
