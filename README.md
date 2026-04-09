# AI Driven Stock Market Autonomous

This project is like a robot that **pretends to trade stocks**.
It watches market prices, checks a simple signal called RSI, and decides if it would BUY, SELL, or HOLD.

✅ It uses **fake money only**.

✅ It is for **learning and experiments**, not real investing.

## What this app does

- Gets market prices from Yahoo Finance (example symbols: `AAPL`, `BTC-USD`)
- Calculates RSI(14) using 5-minute candles
- Runs an automated trading loop every 1–5+ minutes (configurable)
- Simulates trades with virtual capital
- Saves the latest simulation state to `results.json`
- Shows a very simple dashboard UI
- Includes beginner-friendly traffic lights:
  - Value
  - Quality
  - Risk
  - Income

## What AI does here

- By default, the app uses a simple built-in decision fallback.
- You can optionally connect Ollama for LLM decisions.
- If the LLM fails, the app safely falls back to `HOLD` logic.

## API endpoints

- `GET /api/results` → latest data from `results.json`
- `GET /api/portfolio` → portfolio snapshot
- `GET /api/signals` → latest signal list
- `GET /api/state` → full in-memory state

## How to run

```bash
git clone <your-repo-url>
cd llm-startup
npm install
npm start
```

Then open:

`http://localhost:3000`

## Notes

- If `results.json` does not exist yet, APIs return safe default data.
- This is a simulator for education. Do not use it for real-money trading decisions.
