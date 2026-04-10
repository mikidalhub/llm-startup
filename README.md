# Value-Driven Trading Advisor (Free Tier)

A minimalist, Revolut-style trading and learning sandbox designed for zero-cost deployment.

## The architecture (simple view)
- **Code** → stored on GitHub
- **Image** → built & stored in GitHub Container Registry (GHCR)
- **App runs** → on a free platform like **Render**, **Railway**, or **Fly.io**
- **Frontend** → hosted on GitHub Pages

## Easiest one-shot deployment from GitHub
Use `/.github/workflows/deploy-full-stack.yml`.

On each push to `main`, this workflow does everything:
1. Installs dependencies
2. Runs tests
3. Builds and deploys frontend to GitHub Pages
4. Builds backend Docker image and pushes to GHCR
5. Optionally triggers backend deploy webhook for Render/Railway/Fly.io

## Required configuration (minimum)
- **One backend URL config (choose one)**
  - Repository Variable: `NEXT_PUBLIC_API_ORIGIN`
  - or Repository Secret: `NEXT_PUBLIC_API_ORIGIN`
- **Optional secrets for backend auto-deploy**
  - `RENDER_DEPLOY_HOOK_URL`
  - `RAILWAY_DEPLOY_HOOK_URL`
  - `FLY_DEPLOY_HOOK_URL`

If webhook secrets are missing, workflow still deploys FE + pushes BE image.
Typical backend URLs:
- Render: `https://<service>.onrender.com`
- Railway: `https://<service>.up.railway.app`
- Fly.io: `https://<app>.fly.dev`

Webhook secret values:
- `RENDER_DEPLOY_HOOK_URL`: Render deploy hook URL from Service Settings.
- `RAILWAY_DEPLOY_HOOK_URL`: Railway deployment webhook URL.
- `FLY_DEPLOY_HOOK_URL`: only if you have a webhook endpoint that triggers `fly deploy`.

## Missing items? Quick checklist
See `docs/DEPLOYMENT_KEYS_CHECKLIST.md` for exact GitHub variables, optional secrets, and Pages setup.

## Core principles
- **Free-tier first**: frontend on GitHub Pages static hosting.
- **Safe onboarding**: default is **Demo mode** with static JSON snapshots.
- **Value-driven workflow**: watchlist entries include valuation range, margin of safety, position size, and risk band.

## Repo structure
- `src/app` — Next.js UI (Dashboard, Watchlist, KPIs, Learn)
- `public/data` — static JSON snapshots used by the frontend
- `scripts` — data refresh scripts for scheduled updates
- `.github/workflows/deploy-full-stack.yml` — one-shot FE + BE GitHub-centric deploy
- `.github/workflows/update-demo-data.yml` — daily JSON refresh cron
- `docs/GITHUB_FREE_TIER_IMPLEMENTATION_PLAN.md` — implementation blueprint
- `docs/BACKEND_FREE_TIER_DEPLOYMENT.md` — backend runtime constraints and options

## Local quick start
```bash
npm ci
npm run dev
```
Open `http://localhost:3000`.

## Refresh demo snapshots locally
```bash
npm run data:refresh
```

## Backend deployment reality check (free tier)
GitHub Pages cannot run Node.js servers or containers. It only hosts static files.

Container-based free-tier path:
1. Build/push backend image to GHCR from GitHub Actions.
2. Run that image on free compute (Render, Railway, Fly.io, Cloud Run free tier).
3. Point frontend to backend with `NEXT_PUBLIC_API_ORIGIN`.
