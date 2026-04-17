# Value-Driven Trading Advisor (Free Tier)

A super-simple, transparent trading monitor that shows:
- Yahoo Finance data requests and response snippets.
- Plain-language market states (Bullish trend, Overbought, Oversold, etc.).
- LLM trading decisions with reasoning.
- A 4-step realtime process wheel powered by WebSocket updates.

## Key UI Features
- **Transparent Trading Monitor**: one-screen layout for non-experts.
- **Realtime Logs panel**: request + result stream with timestamps.
- **Decision Transparency panel**: action, market state, and clear reason.
- **4-step Process Wheel**:
  1. Fetch Data
  2. Analyze
  3. Decide
  4. Execute
- **README-style explainer panel** directly in the app for quick onboarding.

## Realtime Data Flow
1. Frontend opens `ws://.../ws` (or `wss://.../ws`) to receive state and process events.
2. Backend emits process events (`tick-started`, `symbol-fetch-started`, `symbol-fetched`, `decision-made`, `trade-processed`, `tick-finished`).
3. UI maps those events to step-by-step logs, wheel progress, and decision cards.
4. If WebSocket is unavailable, the app falls back to `/events` server-sent events (SSE).

## Local Setup
```bash
npm ci
npm run dev
```
Open: `http://localhost:8080`.

## Environment Variables
- `NEXT_PUBLIC_API_ORIGIN` (optional): backend URL base, e.g. `https://trade-app.onrender.com`.
- `NEXT_PUBLIC_API_BASE_URL` (optional alternative): backend URL base.
- `NEXT_PUBLIC_BASE_PATH` (optional): sub-path hosting support.

## Useful Endpoints
- Health: `GET /api/health`
- Engine state: `GET /api/state`
- Start one cycle: `POST /api/process/start`
- SSE fallback stream: `GET /events`
- WebSocket stream: `GET /ws` (upgrade)

## Testing
```bash
npm test
npm run test:e2e
```

## Browser Compatibility
- ✅ Chrome (latest stable)
- ✅ Firefox (latest stable)

The UI uses standard React + MUI + SVG features for broad compatibility on modern browsers.

## Deployment Notes
- This repo supports free-tier deployment with static frontend hosting + containerized backend.
- See `/docs` for deeper architecture and deployment guides.
