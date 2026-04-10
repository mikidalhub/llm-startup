# Value-Driven Trading Advisor (Free Tier)

A minimalist, Revolut-style trading and learning sandbox designed for zero-cost deployment.

## Core principles
- **Free-tier first**: runs on GitHub Pages static hosting.
- **Safe onboarding**: default is **Demo mode** with static JSON snapshots.
- **Value-driven workflow**: watchlist entries include valuation range, margin of safety, position size, and risk band.

## Repo structure
- `src/app` — Next.js UI (Dashboard, Watchlist, KPIs, Learn)
- `public/data` — static JSON snapshots used by the frontend
- `scripts` — data refresh scripts for scheduled updates
- `.github/workflows/deploy-pages.yml` — build + deploy to GitHub Pages
- `.github/workflows/update-demo-data.yml` — daily JSON refresh cron
- `docs/GITHUB_FREE_TIER_IMPLEMENTATION_PLAN.md` — step-by-step build plan from empty repo

## Quick start
```bash
npm ci
npm run dev
```
Open `http://localhost:3000`.

## Static-host deployment (GitHub Pages)
1. Push to `main`.
2. Workflow builds static output and deploys to Pages.
3. Open your repo Pages URL.

## Refresh demo snapshots locally
```bash
npm run data:refresh
```

## Notes
- Demo mode is intentionally the default in free-tier setups.
- You can later add broker/WebSocket integrations behind feature flags without changing the free core path.
