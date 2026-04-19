# Agentic Trading Application

Production-oriented trading simulation platform with a transparent agent pipeline: **market ingestion → signal generation → decisioning → execution simulation → portfolio analytics → real-time observability UI**.

This repository is intentionally structured so product teams, engineering teams, and demo stakeholders can all inspect what the system is doing in near real-time.

---

## 1) Product Overview

### What it does
- Runs scheduled and on-demand trading cycles across a configured symbol universe.
- Fetches market data (Yahoo Finance chart + quote data).
- Generates AI decisions (BUY / SELL / HOLD) using either:
  - deterministic fallback rules, or
  - an Ollama-backed LLM decision prompt.
- Simulates order execution against portfolio constraints.
- Persists state/results to JSON and optionally Redis.
- Streams state + process events to UI via SSE and WebSocket.

### Why it matters
- **Trust by design:** every cycle stage emits human-readable events.
- **Fast iteration:** no heavy broker dependency for MVP validation.
- **Demo-ready:** includes portfolio KPIs, per-operation P&L semantics, trade timeline, and decision transparency.

---

## 2) Core Capabilities

- **Automated trading cycles** (boot + polling + daily schedule).
- **Agentic decision layer** with configurable LLM provider and strict JSON outputs.
- **Portfolio accounting**: cash, positions, equity curve, pnl, return %, win rate, sharpe, max drawdown.
- **Opportunity/risk/dividend intelligence** via modular analysis engines.
- **Realtime observability**:
  - lifecycle state (`IDLE/FETCHING/DECIDING/TRADING/PERSISTING`),
  - event stream (`tick-started`, `decision-made`, `trade-processed`, `tick-finished`, etc.),
  - recent operations and decision logs.

---

## 3) System Architecture (Layered)

### Frontend Layer
- **Framework:** Next.js 14 + React 18 + MUI.
- **Entry:** `src/app/page.tsx` renders live dashboard/cards/timeline/controls.
- **State management:** local React hooks (`useState`, `useMemo`, `useEffect`) with periodic hydration plus event-driven updates.
- **Primary UX components:**
  - value cards (Portfolio Value, Net Profit, Daily Change, Revenue),
  - equity curve panel,
  - trade list and decision detail drawer,
  - process/event timeline.

### Backend Layer
- **Runtime bootstrap:** `server.js`.
- **HTTP/API + streams:** `app-server.js`.
- **Trading engine core:** `trading-engine.js`.
- **Execution lifecycle:** fetch snapshot → decide → execute simulation → update metrics → persist → broadcast.

### Persistence Layer
- **File persistence:** `results.json` payload written every cycle (path from config).
- **Redis (optional):** caches state/results and bounded lists for decisions/trades/events.
- **Data lifecycle:**
  1. Tick mutates in-memory portfolio/snapshots.
  2. Engine writes payload to file + Redis cache.
  3. API routes read Redis first, then fallback to file/in-memory.

### Containerization Layer
- **Dockerfile:** single Node 20 Alpine image with backend + domain modules.
- **docker-compose:** one service (`mvp`) with environment overrides and host port mapping.

### Communication Layer
- **REST APIs:** `/api/*` resources for state, results, portfolio, decisions, analysis, health.
- **SSE:** `/events` stream (state/process channels).
- **WebSocket:** `/ws` for lower-latency state/process broadcast.

---

## 4) End-to-End Pipeline (Big Picture)

1. **Market ingestion**
   - Engine requests chart/quote data from Yahoo client.
   - If fetch fails, synthetic snapshot fallback keeps pipeline alive.
2. **Feature generation**
   - RSI, price, volume, plus deeper modules (fundamental/value/risk/dividend).
3. **Decisioning (AI/rules)**
   - LLM prompt path (Ollama) if enabled.
   - Else deterministic fallback thresholds:
     - RSI < 35 → BUY
     - RSI > 70 → SELL
     - else HOLD
4. **Execution simulation**
   - Size bounded by `maxPositionPct` and available cash/position inventory.
5. **Persistence**
   - Writes full payload with portfolio state, trades, signals, metrics.
   - Updates Redis caches/lists when configured.
6. **Visualization**
   - Frontend polls bootstrap/state endpoints and subscribes to realtime streams.
   - UI surfaces KPI cards, trades, decisions, and process logs.

---

## 5) Financial Metrics & Card Semantics

### Portfolio Value
**Definition:**
`cash + Σ(position.shares * mark_price)` where `mark_price` is latest snapshot price (fallback avg cost).

### Initial Value (`capital`, default `10000`)
- Represents **simulated starting cash**, not real broker capital.
- Configurable via `config.yaml` (`capital`).
- Used as baseline for `pnl` and `returnPct`.

### KPI card meanings
- **Portfolio Value:** current mark-to-market equity.
- **Net Profit:** `portfolioValue - initialCapital`.
- **Daily Change:** delta between last two equity-curve points.
- **Revenue:** cumulative signed operation value (SELL positive, BUY negative) from operation results.

> Note: this is simulation accounting (no slippage/spread/fees model by default).

---

## 6) AI System Transparency

### Current implementation
- **System type:** Hybrid (rule-based default + optional LLM decision wrapper).
- **Model options:**
  - `mock` provider → deterministic RSI-based fallback.
  - `ollama` provider → local/self-hosted LLM endpoint returns strict JSON decision.

### Inputs
- Snapshot-level market features: `price`, `volume`, `rsi`.
- Portfolio context: current `portfolioValue`, configured max position percent.

### Outputs
- `action`: BUY / SELL / HOLD
- `size_pct`: requested position sizing ratio (bounded in engine)
- `reason`: natural-language rationale for explainability

### Decision mechanics
- Prompt asks for JSON output.
- Engine parses JSON block; on malformed/failed call, it reverts to fallback rule.
- Risk/control constraints enforced post-decision:
  - clamp size to `[0, maxPositionPct]`
  - BUY constrained by available cash
  - SELL constrained by existing shares

### Assumptions and gaps
- No training loop, no online learning, no backtest calibration integrated in runtime.
- No probabilistic confidence interval yet.
- No transaction cost model yet.

---

## 7) Setup

### Prerequisites
- Node.js 20+
- npm 10+
- (Optional) Redis
- (Optional) Ollama-compatible endpoint

### Install
```bash
npm ci
```

### Run locally
```bash
npm run dev
```
Open `http://localhost:8080` (or `PORT` override).

### Run with Docker Compose
```bash
docker compose up --build
```

---

## 8) Configuration

Primary config is `config.yaml`.

Key fields:
- `symbols`
- `pollIntervalSeconds`
- `dailySchedule.hour/minute/timezone/enabled`
- `capital`
- `maxPositionPct`
- `rsiPeriod`
- `llm.provider/model/url`
- `outputPath`

Environment overrides supported for selected fields:
- `PORT`
- `POLL_INTERVAL_SECONDS`
- `LLM_PROVIDER`
- `OLLAMA_URL`
- `REDIS_URL`
- `REDIS_NAMESPACE`

---

## 9) API Quick Reference

- `GET /api/health` – runtime health status
- `GET /api/bootstrap` – state + results + decisions + events seed
- `GET /api/state` – live engine state
- `GET /api/results` – persisted results payload
- `GET /api/decisions` – recent decision records
- `POST /api/process/start` – manual trigger
- `GET /events` – SSE stream
- `GET /ws` – WebSocket stream

For complete endpoint details, see `docs/API_REFERENCE.md`.

---

## 10) UI/UX Notes

### Current strengths
- High transparency around engine lifecycle.
- Actionable KPI cards and event visibility.
- Decision/trade drill-down support.

### Recommended UX upgrades
- Split monolithic homepage into smaller reusable components.
- Add timezone-aware schedule display and run-history filters.
- Add explicit empty/error states for each panel.
- Add strategy/risk badges and tooltips on KPI cards.

---

## 11) Documentation Map

- `docs/SYSTEM_AUDIT_AND_ENHANCEMENT_PLAN.md` – full audit, architecture deep dive, risks, roadmap.
- `docs/API_REFERENCE.md` – endpoint contracts.
- `docs/BACKEND_ARCHITECTURE.md` – backend runtime and deployment health checks.
- `docs/CODEBASE_OVERVIEW.md` – code organization summary.

---

## 12) Testing

```bash
npm test
npm run build
```

Optional E2E:
```bash
npm run test:e2e
```
