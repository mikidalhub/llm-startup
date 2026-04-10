# Backend Architecture

This document explains how the backend is structured, how requests flow through the system, and how to verify container health after deployment.

## Runtime components

1. **`server.js`**
   - Loads config (`config.yaml`) and optional env overrides.
   - Starts the `TradingEngine`.
   - Starts the HTTP server on `PORT` (default `8080`).

2. **`app-server.js`**
   - Defines API routes (`/api/*`).
   - Handles CORS for frontend calls.
   - Streams events with SSE (`/events`).
   - Triggers trading process runs via `/api/process/start`.
   - Provides runtime/container health endpoint `/api/health` (`/health`, `/healthz` aliases).

3. **`trading-engine.js` and modules**
   - Fetches market data.
   - Runs analysis/risk/dividend modules.
   - Updates internal state and emits events.

## Request flow

1. Frontend sends request to backend URL (for example from GitHub Pages).
2. `app-server.js` normalizes path and matches route.
3. For `/api/process/start`, backend accepts both:
   - `POST` with optional JSON body (`{ "reason": "..." }`)
   - `GET` for simple/manual trigger checks
4. Backend calls `engine.tick(...)` and returns a JSON acceptance response.

## Health checks (container running verification)

Use any of:

- `GET /api/health`
- `GET /health`
- `GET /healthz`

Example:

```bash
curl -fsS https://<your-backend>/api/health
```

Expected shape:

```json
{
  "status": "ok",
  "container": "running",
  "uptimeSeconds": 123,
  "startedAt": "...",
  "now": "...",
  "checks": {
    "engineStateAvailable": true,
    "portfolioAvailable": true
  }
}
```

If this endpoint responds with HTTP 200 and `"status":"ok"`, the container and backend server are running.

## Deployment visibility

`deploy.sh` now:
1. Deploys the service to Cloud Run.
2. Prints the service URL.
3. Calls `/api/health` to confirm runtime health.
4. Calls `/api/process/start` with reason `DEPLOY_CHECK` to confirm start-trigger path works.

This gives immediate post-deploy proof that:
- the container is reachable,
- the backend process is healthy,
- and process triggering is accepted.
