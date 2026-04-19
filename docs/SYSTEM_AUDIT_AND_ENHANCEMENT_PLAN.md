# System Audit, Documentation, and Enhancement Plan

## Executive Summary

The application is a solid **agentic trading simulator MVP** with strong transparency mechanics (event streams, lifecycle states, decision logging). The core technical risk is not raw functionality—it is **production-hardening maturity**: reliability controls, observability depth, and architecture modularity need upgrades for scale and investor-grade confidence.

---

## 1) Current State Assessment

### What exists today
- End-to-end agent loop from market data fetch to simulated execution.
- Config-driven schedule and symbol universe.
- REST + SSE + WebSocket interfaces.
- Hybrid decision layer (rule fallback + optional LLM).
- Portfolio metric computation and persisted snapshots.
- Optional Redis cache for hot state and event/history buffers.

### What is missing or unclear
- No explicit transaction-cost/slippage model in pnl accounting.
- Limited runtime guardrails (no circuit breakers/rate limiter/retry budget policy).
- No formal backtesting framework in main runtime.
- Frontend composition centralized in one large page file (maintainability risk).
- No explicit auth/multi-user tenancy model.
- Limited structured metrics/alerting (Prometheus/OpenTelemetry absent).

### Primary risks and bottlenecks
1. **Data dependency fragility:** Yahoo failures rely on synthetic fallback, which can distort perceived strategy behavior.
2. **Decision confidence opacity:** decisions include reason text but no confidence/probability.
3. **Simulation realism gap:** no broker latency/fills model and no fee/slippage impact.
4. **Scalability risk:** single-process runtime with in-memory state coupling.
5. **Observability gap:** logs/events exist, but not yet centralized with SLO dashboards.

---

## 2) Architecture Deep Dive

### Frontend
- Next.js App Router + React hooks for polling/event hydration.
- KPI/value cards and drill-down views are implemented in the homepage container.
- Event stream ingestion via EventSource; optional WS support available from backend.

### Backend
- `server.js`: config + dependency wiring + lifecycle.
- `app-server.js`: HTTP routing, CORS, stream endpoints, static serving.
- `trading-engine.js`: orchestration and business logic.
- Domain modules: valuation/fundamentals/risk/dividends/portfolio/scanner/explainer.

### Persistence
- Primary persistence: JSON result payload file.
- Redis role: cache + append-only recent list buffers for decisions/trades/events.
- Recovery path: bootstrap from Redis latest state when available.

### Containerization
- Single image, backend-centric runtime.
- Compose runs one service by default; no sidecar services bundled.

### Communication
- REST for query/command APIs.
- SSE and WebSocket for real-time updates.
- No queue broker presently.

---

## 3) End-to-End Flow (Business-Friendly)

1. Market prices are fetched for tracked symbols.
2. Indicators and analytics are computed (e.g., RSI and quality/value/risk views).
3. The AI decision engine proposes BUY/SELL/HOLD and position size.
4. The execution simulator applies capital and position constraints.
5. Portfolio metrics are recomputed and persisted.
6. UI updates in near real time so operators can inspect both decisions and outcomes.

---

## 4) Financial Metric Semantics

### Portfolio Value formula
`Portfolio Value = Cash + Σ(Shares × Mark Price)`

### Initial value (`capital`)
- Default `10,000` from config.
- Serves as baseline for pnl and return calculations.
- Treated as simulated starting capital and is configurable.

### Card interpretation
- Portfolio Value: live net equity.
- Net Profit: cumulative pnl vs initial capital.
- Daily Change: step-over-step equity difference.
- Revenue: signed gross flow from operation results.

---

## 5) AI Transparency (Technical)

### System type
Hybrid decisioning:
- Rule fallback (RSI thresholds), and
- Optional LLM inference path (Ollama endpoint).

### Inputs
- Symbol snapshot: price, volume, RSI.
- Portfolio context: current portfolio value.
- Risk constraint: max position size.

### Outputs
- Structured decision JSON (`action`, `size_pct`, `reason`).
- Engine-level clamps ensure policy compliance.

### Risk management currently enforced
- Position sizing cap via `maxPositionPct`.
- Buy limited by available cash.
- Sell limited by owned shares.

### Assumptions to call out
- This is strategy execution simulation, not broker-executed live trading.
- No reinforcement learning loop implemented yet.

---

## 6) Documentation Synchronization Status

- README has been upgraded for investor/demo readiness.
- This audit document becomes the canonical source for architecture and roadmap.
- Existing backend and API docs remain valid and should cross-link this file.

---

## 7) Prioritized Improvement Plan

### Short-term (0–4 weeks)
1. **Reliability controls**
   - Add retry/backoff + explicit stale-data flags.
   - Add per-symbol fetch timeout and degraded-mode status.
2. **Observability uplift**
   - Structured logging schema (cycle_id, symbol, stage, latency_ms).
   - Add `/api/metrics` and expose core counters/gauges.
3. **UI maintainability**
   - Refactor homepage into components/hooks.
4. **Risk realism**
   - Add configurable slippage/fee model.

### Mid-term (1–3 months)
1. Backtesting engine with walk-forward splits and benchmark comparison.
2. Strategy abstraction (pluggable policies) + experiment registry.
3. Multi-tenant auth and isolated portfolios.
4. Alerting stack (latency spikes, failed ticks, drawdown breaches).

### Long-term (3–12 months)
1. Event-driven microservices (ingestion, decision, execution, reporting).
2. Real-time streaming market feeds + durable event bus.
3. Advanced AI strategies (ensemble, RL policy optimization).
4. Strategy marketplace and managed model governance.

---

## 8) UI/UX Professionalization Recommendations

- Replace generic branding with finance-native identity (title, favicon, social metadata).
- Add semantic color legend and hover definitions for every KPI.
- Add strategy mode selector and historical replay controls.
- Add confidence/risk badges beside each decision.
- Add portfolio allocation donut + sector exposure chart.

---

## 9) Scalability Roadmap (Target State)

### Suggested target architecture
- **Ingestion service** (quotes/features)
- **Decision service** (model inference + policy checks)
- **Execution simulator / broker adapter**
- **Portfolio service** (ledger + PnL)
- **Realtime gateway** (SSE/WS fan-out)
- **Analytics service** (backtest, attribution, risk reports)

### Data platform evolution
- Move from JSON file to PostgreSQL (source of truth).
- Keep Redis as low-latency cache + pub/sub + recent buffers.
- Add object storage for artifacts (backtests, model snapshots, reports).

---

## 10) Success Metrics for Next Phase

- Tick success rate > 99.5%.
- Median cycle latency < 3s for configured symbol set.
- Data freshness lag < 60s on normal conditions.
- Alert MTTR < 15 minutes.
- Backtest-to-live drift reporting available per strategy.

