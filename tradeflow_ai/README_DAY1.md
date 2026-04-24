# TradeFlow AI Day 1 MVP

Local-first paper-trading assistant using free tools only.

## Features
- 90-day OHLCV load from `yfinance`
- Indicators: SMA20, SMA50, RSI14, MACD, ATR14, volatility
- Rule-based signal: BUY / SELL / HOLD / NO TRADE
- Risk manager: 1% risk, 1.5 ATR stop, 2R target minimum
- LangGraph workflow orchestration
- Ollama local model for concise reasoning rewrite
- SQLite journal logging
- Streamlit dashboard with chart + journal

## Run
```bash
pip install -r requirements-day1.txt
streamlit run tradeflow_ai/app.py
```

## First run task (BTC-USD)
```bash
python tradeflow_ai/first_run.py
```

> Learning and paper-trading assistant only. Not financial advice.
