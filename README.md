# Autonomous Markets Control Deck

A Node.js app that runs a mock trading engine and serves a lightweight dashboard + APIs.

## Feature summary
- **Live market polling** from Yahoo Finance (`AAPL`, `BTC-USD`, or custom symbols).
- **Signal generation** using RSI.
- **Decision layer** via:
  - deterministic mock strategy (default), or
  - Ollama JSON decisions.
- **Portfolio simulator** with virtual cash, positions, and trade history.
- **Metrics**: portfolio value, P&L, return %, win rate, Sharpe.
- **Streaming + APIs**: SSE events and JSON endpoints.
- **Persistence** to `results.json` for easy integration.

## Project structure
- `server.js`: app bootstrap (load config, start engine, start HTTP server).
- `app-server.js`: HTTP routing layer and SSE wiring.
- `trading-engine.js`: market fetch, decisioning, execution, and metrics.
- `public/index.html`: dashboard UI.
- `tests/unit`: unit tests for engine and API server.
- `config.yaml`: runtime configuration.

## Clone and run locally
### 1) Clone
```bash
git clone <your-repo-url>
cd llm-startup
```

### 2) Install dependencies
```bash
npm install
```

### 3) Start locally
```bash
node server.js
```
Open: `http://localhost:3000`

## Run with Docker
```bash
docker compose up --build
```

## Optional: enable Ollama decisions
1. Install Ollama and pull a model:
   ```bash
   ollama pull llama3.1:8b
   ```
2. Start with Ollama provider:
   ```bash
   LLM_PROVIDER=ollama node server.js
   ```

## API endpoints
- `GET /api/state` → full engine state.
- `GET /trades` → latest 50 trades.
- `GET /portfolio` → cash, positions, metrics.
- `GET /events` → SSE stream of state updates.

## Configuration
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

## Development checks
```bash
npm test
```

For browser e2e checks (requires Playwright browsers):
```bash
npm run test:e2e
```

## Maintainability and testability notes
- Server concerns are separated from engine logic.
- Trading engine supports dependency injection for:
  - network requests,
  - file writes,
  - clock/time generation.
- Unit tests cover:
  - RSI + parser utilities,
  - fallback behavior,
  - trade execution,
  - API endpoints.
