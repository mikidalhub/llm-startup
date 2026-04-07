# Autonomous Markets Control Deck

A single-container Node app that runs a live, LLM-assisted **mock trading engine** and now includes a **beginner-friendly value investing intelligence layer**.

## What this now does
- Live ingestion from Yahoo Finance every 1-5+ minutes (configurable) for symbols like `AAPL` and `BTC-USD`.
- RSI(14) signal generation from 5m candles for the simulation loop.
- LLM decision hook (Ollama optional) with strict `BUY | SELL | HOLD` + `size_pct` output.
- Mock portfolio execution with virtual capital and persisted trade history.
- Value-investing analysis modules for fundamentals, value, risk, dividends, portfolio health, and explanations.
- Beginner mode traffic lights (Green/Yellow/Red) for Value, Quality, Risk, and Income.
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
- `GET /opportunities` ranked long-term opportunities from scanner universes.
- `GET /company/:ticker` company health card.
- `GET /analysis/:ticker` beginner-focused analysis summary.
- `GET /dividends` portfolio dividend income projection.
- `GET /risk` portfolio-level risk analysis.
- `GET /daily-brief` auto-generated investor briefing.

## Config
Edit `config.yaml`:
- `symbols`
- `pollIntervalSeconds`
- `capital`
- `maxPositionPct`
- `rsiPeriod`
- `scannerUniverse`
- `llm.provider` (`mock` or `ollama`)
- `llm.model`
- `llm.url`
- `outputPath`

See `docs/INVESTMENT_PLATFORM_BLUEPRINT.md` for architecture, formulas, UX, and roadmap.
