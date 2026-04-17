# FE-BE Communication Strategy (WebSocket-first, SSE fallback)

## Goal
Provide low-latency, resilient communication between frontend (GitHub Pages) and backend (Render container) with the least operational complexity.

## Transport strategy
1. **Primary:** WebSocket (`/ws`)
   - bidirectional channel for live state/process events
   - lower overhead for frequent updates
2. **Fallback:** Server-Sent Events (`/events`)
   - automatic browser reconnect behavior
   - simple one-way stream when WebSocket upgrade fails
3. **Request/response APIs:** REST endpoints (`/api/*`) for snapshots and commands

## Message contract
- `channel: "state"` → engine state payload
- `channel: "process"` → process lifecycle event payload
- FE updates:
  - running/idle status
  - phase progression
  - process message feed

## Frontend behavior
1. Open WebSocket to `${NEXT_PUBLIC_API_ORIGIN}/ws`.
2. If WebSocket errors or closes unexpectedly, attach SSE `EventSource` to `/events`.
3. Continue using REST for:
   - hydration (`/api/state`)
   - manual trigger (`/api/process/start`)

## Backend behavior
- Broadcast both state and process events to:
  - WebSocket clients (`/ws`)
  - SSE clients (`/events`)
- Keep health endpoint (`/api/health`) as deploy/runtime readiness signal.

## Deployment/ops checklist
- `NEXT_PUBLIC_API_ORIGIN` points to Render backend origin.
- Render has HTTPS enabled (required for `wss://` from Pages).
- If backend host should be API-only, set `SERVE_STATIC_UI=false`.
- Keep CORS restricted to frontend origin with `CORS_ALLOWED_ORIGIN`.

## Validation checklist
- REST:
  - `GET /api/health`
  - `GET /api/state`
  - `POST /api/process/start`
- SSE:
  - `curl -N https://<backend>/events` receives `event: state` and `event: process`
- WebSocket:
  - browser devtools confirms successful `wss://<backend>/ws` upgrade
  - UI reflects live status changes without manual refresh
