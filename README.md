# Autonomous Markets Control Deck

A single-container Node app that runs a live, LLM-assisted **mock trading engine** and serves a dashboard.

## What this now does
- Live ingestion from Yahoo Finance every 1-5+ minutes (configurable) for symbols like `AAPL` and `BTC-USD`.
- RSI(14) signal generation from 5m candles.
- LLM decision hook (Ollama optional) with strict `BUY | SELL | HOLD` + `size_pct` output.
- Mock portfolio execution with virtual capital and persisted trade history.
- Performance metrics: portfolio value, P&L, return %, win rate, Sharpe.
- Output persisted to `results.json` for external polling/UI integrations.

## Quick start (Docker)
```bash
docker compose up --build
```
Then open `http://localhost:3000`.

## Optional local Ollama
1. Install Ollama and pull model:
   ```bash
   ollama pull llama3.1:8b
   ```
2. Run with Ollama decisions:
   ```bash
   LLM_PROVIDER=ollama docker compose up --build
   ```

## Runtime endpoints
- `GET /api/state` full engine state.
- `GET /trades` latest trades.
- `GET /portfolio` portfolio summary.
- `GET /events` SSE stream.

## Config
Edit `config.yaml`:
- `symbols`
- `pollIntervalSeconds`
- `capital`
- `maxPositionPct`
- `rsiPeriod`
- `llm.provider` (`mock` or `ollama`)
- `llm.model`
- `llm.url`
- `outputPath`

No cloud dependencies are required for the default (`mock`) mode.
