# Codebase Overview and Duplication Audit

## 1) High-level architecture
- **Frontend (FE):** Next.js app in `src/app` renders dashboard, watchlist, KPIs, and learning views.
- **Backend:** Node.js HTTP server (`server.js` + `app-server.js`) exposes JSON APIs and serves static files.
- **Trading domain logic:** Core engine in `trading-engine.js` plus focused modules:
  - `analysis/` (valuation),
  - `fundamentals/`,
  - `risk/`,
  - `dividends/`,
  - `portfolio/`,
  - `scanner/`,
  - `explainer/`.
- **Deployment:** single one-shot workflow `.github/workflows/deploy-full-stack.yml` deploys FE + BE.

## 2) FE structure review
- `src/app/page.tsx` is currently a large "orchestration page" that:
  - loads static demo JSON from `public/data/*`,
  - attempts backend hydration via `/api/state`,
  - triggers backend process via `/api/process/start`,
  - owns most UI rendering.
- Additional pages:
  - `src/app/readme/page.tsx`
  - `src/app/user-guide/page.tsx`

### FE duplication check
- **No duplicated FE deployment workflow** remains (single full-stack deploy flow).
- Potential code duplication risk exists in UI composition because `src/app/page.tsx` mixes data loading + presentation in one file.
- Recommended follow-up (non-breaking refactor): split `page.tsx` into `components/`, `hooks/`, and `api-client` helpers.

## 3) Backend structure review
- `server.js` handles startup, config loading, and lifecycle.
- `app-server.js` handles HTTP routing and response formatting.
- `trading-engine.js` encapsulates portfolio state, market fetches, analysis, and execution decisions.

### Backend duplication check
- API routes are centralized in `app-server.js`; no duplicate backend route files detected.
- The trading logic is modularized by concern, reducing algorithm duplication across files.

## 4) Important duplication/config mismatch fixed
- **Fixed:** frontend API base URL resolution now supports `NEXT_PUBLIC_API_ORIGIN` (primary) and keeps `NEXT_PUBLIC_API_BASE_URL` as fallback.
- Why this matters:
  - workflows and docs consistently configure `NEXT_PUBLIC_API_ORIGIN`,
  - frontend now uses the same variable, avoiding FE/CI config drift.

## 5) Current verdict
- **Deploy workflows:** deduplicated (single full-stack deploy).
- **Backend architecture:** reasonably well-separated and not duplicated.
- **Frontend architecture:** functional but monolithic in `src/app/page.tsx`; can be improved with component extraction.
