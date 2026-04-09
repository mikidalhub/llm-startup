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

## Configuration
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

## Deploy to GitHub Pages (free tier)
This repo now includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that can deploy the Next.js UI to GitHub Pages.

### What GitHub Actions does (simple)
- It is GitHub's built-in automation runner.
- When you push to `main`, it runs steps for you: install, test, build, and deploy.
- You do not need to run deployment commands manually each time.

### Free-tier friendly setup
- Uses GitHub-hosted runners and GitHub Pages (both available on GitHub Free).
- Keeps one small job (test + build + deploy) to minimize action minutes.
- Uses dependency caching (`npm`) to speed up future runs.
- Automatically detects GitHub Pages subpath (`/<repo>`) for project pages so static assets load correctly.

### One-time repo settings
1. Push this code to GitHub.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Push to `main` (or run the workflow manually in the **Actions** tab).

After a successful run, your site URL will appear in the workflow summary.
