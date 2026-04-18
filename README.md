# Value-Driven Trading Advisor (Free Tier)

A minimal, real-time trading monitor focused on **state transparency** and **execution visibility**.

## What’s New in This Iteration
- **Lifecycle-first UI** with explicit states: `Reset/Idle`, `Started`, `Active`, `Completed`.
- **Thin SVG process wheel** with dynamic center text and smooth transition feedback.
- **Execution badge** (`Executions: #X`) that increments on each full trading cycle.
- **Full-width, scrollable realtime log stream** with clickable entries.
- **Detail modal** for every event (request/result/decision/system), showing timestamped payloads and outcomes.
- **Realtime WebSocket + throttled rendering** for responsive updates under burst traffic.

## UI Features
- **Rounded, flat cards** (12px radius, subtle shadow) for low-noise readability.
- **Start + Reset controls** for quick lifecycle control.
- **Central status messaging** inside the wheel for at-a-glance operator understanding.
- **Clickable step list + log entries** for drill-down inspection.
- **Keyboard/ARIA-aware controls** across interaction points.

## Realtime Data Flow
1. Frontend opens `ws://.../ws` (or `wss://.../ws`) for state + process events.
2. Backend emits process events:
   - `tick-started`
   - `symbol-fetch-started`
   - `symbol-fetched`
   - `decision-made`
   - `trade-processed`
   - `tick-finished`
3. UI maps events into:
   - process wheel state transitions,
   - execution counter updates,
   - clickable, timestamped log timeline,
   - decision and execution transparency records.
4. If WebSocket is unavailable, frontend falls back to `/events` SSE.

## API Event Examples

### Yahoo Request (UI-composed view)
```json
{
  "method": "GET",
  "url": "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=5m",
  "payload": {
    "range": "1d",
    "interval": "5m"
  }
}
```

### Yahoo Result (event-derived)
```json
{
  "symbol": "AAPL",
  "stockName": "Apple Inc.",
  "price": 199.25,
  "rsi": 58.44,
  "state": "Bullish trend"
}
```

### Decision Snapshot (UI transparency view)
```json
{
  "output": {
    "action": "BUY",
    "size_pct": 0.07,
    "reason": "RSI indicates oversold conditions."
  },
  "marketState": "Oversold"
}
```

## Screenshots & Demo
> Add generated artifacts under `docs/assets/` when running local demo captures.

- App screenshot: `docs/assets/realtime-dashboard.png`
- Demo GIF: `docs/assets/realtime-flow.gif`

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
npm run build
```

## Browser Compatibility
- ✅ Chrome (latest stable)
- ✅ Firefox (latest stable)
- ✅ Safari (latest stable)

The UI uses React + MUI + SVG primitives for broad compatibility on modern browsers.

## Deployment Notes
- This repo supports free-tier deployment with static frontend hosting + containerized backend.
- See `/docs` for deeper architecture and deployment guides.
