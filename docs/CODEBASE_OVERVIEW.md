# Codebase Overview

## Repository layout

- `src/app/` – Next.js frontend routes and UI composition.
- `server.js` – backend bootstrap and process lifecycle.
- `app-server.js` – API routing, SSE/WS streaming, static asset serving.
- `trading-engine.js` – core decision/execution/portfolio orchestration.
- Domain modules:
  - `analysis/`
  - `fundamentals/`
  - `risk/`
  - `dividends/`
  - `portfolio/`
  - `scanner/`
  - `explainer/`
- `data/yahoo-client.js` – external market data adapter.
- `redis-store.js` – optional cache + lightweight event/trade/decision history persistence.
- `docs/` – architecture, API, deployment, and audit documentation.

## Runtime composition

- Single Node.js service hosting backend APIs and (optionally) static frontend assets.
- Frontend can be hosted independently and consume backend via `NEXT_PUBLIC_API_ORIGIN`.

## Current engineering notes

- The homepage (`src/app/page.tsx`) is currently feature-rich but monolithic; component extraction is the highest-impact maintainability improvement.
- Core trading and analysis logic is modularized and separated from transport concerns.

## Canonical deep-dive docs

- Full audit + roadmap: `docs/SYSTEM_AUDIT_AND_ENHANCEMENT_PLAN.md`
- Backend runtime details: `docs/BACKEND_ARCHITECTURE.md`
- Endpoint contracts: `docs/API_REFERENCE.md`
