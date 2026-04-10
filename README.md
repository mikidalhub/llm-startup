# Value-Driven Trading Advisor (Free Tier)

A minimalist, Revolut-style trading and learning sandbox designed for zero-cost deployment.

## The architecture (simple view)
- **Code** → stored on GitHub
- **Image** → built & stored in GitHub Container Registry (GHCR)
- **App runs** → on a free platform like **Render**, **Railway**, or **Fly.io**
- **Frontend** → hosted on GitHub Pages

## Which backend provider is this repo using?
- This repo is **provider-agnostic by default**.
- There is **no single hardcoded provider** (not locked to Render, Railway, or Fly.io).
- Backend deploy hooks are optional and selected by whichever secret(s) you set:
  - `RENDER_DEPLOY_HOOK_URL`
  - `RAILWAY_DEPLOY_HOOK_URL`
  - `FLY_DEPLOY_HOOK_URL`

If none are set, workflows still build/push the backend image to GHCR; provider rollout is manual.

## Easiest one-shot deployment from GitHub
Use `/.github/workflows/deploy-full-stack.yml`.

On each push to `main`, this workflow does everything:
1. Installs dependencies
2. Runs tests
3. Builds and deploys frontend to GitHub Pages
4. Builds backend Docker image and pushes to GHCR
5. Optionally triggers backend deploy webhook for Render/Railway/Fly.io

## Deploy workflow policy
This repo uses a single deployment workflow on push: `deploy-full-stack.yml` (FE + BE in one shot).

## Required configuration (minimum)
- **One backend URL config (choose one)**
  - Repository Variable: `NEXT_PUBLIC_API_ORIGIN`
  - or Repository Secret: `NEXT_PUBLIC_API_ORIGIN`
- **Optional secrets for backend auto-deploy**
  - `RENDER_DEPLOY_HOOK_URL`
  - `RAILWAY_DEPLOY_HOOK_URL`
  - `FLY_DEPLOY_HOOK_URL`

If webhook secrets are missing, workflow still deploys FE + pushes BE image.
Where to set variable/secret in GitHub:
- **Settings → Secrets and variables → Actions** (Variables tab or Secrets tab).
- Value format for `NEXT_PUBLIC_API_ORIGIN`:
  - Use the backend base URL only (example: `https://trade-app.onrender.com`)
  - Do **not** append `/api`

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
See `docs/BACKEND_ARCHITECTURE.md` for backend internals, request flow, and health-check operations.

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
2. Run that image on free compute (Render, Railway, Fly.io).
3. Point frontend to backend with `NEXT_PUBLIC_API_ORIGIN`.

## Backend health checks
After deploy, verify container status:
```bash
curl -fsS https://<your-backend>/api/health
```
Trigger process start manually:
```bash
curl -fsS -X POST https://<your-backend>/api/process/start -H "Content-Type: application/json" -d '{"reason":"MANUAL_CHECK"}'
```
