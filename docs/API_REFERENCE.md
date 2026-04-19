# Trading API Reference

This backend now exposes a machine-readable OpenAPI document at:

- `GET /api/docs` (JSON, OpenAPI 3.1)

## Core Endpoints

### System
- `GET /api/health` — runtime and liveness information.
- `GET /api/docs` — OpenAPI schema for integrations.

### Trading Lifecycle
- `GET /api/state` — in-memory runtime state.
- `POST /api/process/start` — manual trigger (`{ "reason": "MANUAL_UI" }`).
- `GET /api/bootstrap` — Redis-first preload of state/results/decisions/events/trades.

### Analytics
- `GET /api/results` — latest persisted result payload.
- `GET /api/trades?date=YYYY-MM-DD` — trade history with optional date filtering.
- `GET /api/decisions` — recent model decisions.
- `GET /api/signals` — latest buy/sell/hold signals.

### Stocks
- `GET /api/stocks` — tracked stock list + derived details.
- `GET /api/stocks/:symbol` — stock detail. If the symbol is not currently tracked, the backend tries a live lookup before returning 404.

## Scheduler and Persistence Notes

- Daily trading scheduling is configurable from `config.yaml` with `dailySchedule.hour`, `dailySchedule.minute`, and `dailySchedule.enabled`.
- After each trading cycle, the engine persists results to file and Redis, including per-operation outcomes and cumulative revenue.
- UI bootstrap should always call `/api/bootstrap` first for best user experience in restart/reconnect scenarios.
