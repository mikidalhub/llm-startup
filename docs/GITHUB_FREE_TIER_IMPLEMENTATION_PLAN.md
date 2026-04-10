# GitHub Free-Tier Implementation Plan

This plan starts from an empty repository and produces a Revolut-style, value-first trading sandbox hosted on GitHub Pages.

## Step 1 — Bootstrap repository and frontend shell
- Create `package.json` with Next.js static export scripts (`build`, `start`, `test`, `data:refresh`).
- Create `next.config.js` with `output: 'export'` and repository-aware `basePath` for GitHub Pages.
- Create `src/app/layout.tsx` and `src/app/page.tsx` for a minimalist dashboard shell with tab navigation.

## Step 2 — Build UI structure (Revolut-style minimalism)
- In `src/app/page.tsx` add tabs: `Dashboard`, `Watchlist`, `KPIs`, `Learn`.
- Add one-tap mode switch (`Real` / `Demo`) and clear labels:
  - `Free Tier – Demo Mode`
  - `Real-time Live Data`
  - `Next Trade: 2026-04-15 09:30 EEST`
- Keep visual language lightweight: whitespace, neutral cards, low-noise metrics.

## Step 3 — Establish static JSON data-flow
- Create `/public/data/dashboard.json` for account snapshot and scheduling info.
- Create `/public/data/watchlist.json` for valuation-driven ideas:
  - valuation range
  - margin of safety
  - position size
  - risk band
- Create `/public/data/kpis.json` and `/public/data/learn.json`.
- Frontend fetches these files at runtime and renders “real-time-style” behavior.

## Step 4 — Add free-tier automation scripts
- Create `/scripts/generate-demo-data.mjs`.
- Script updates snapshot timestamps and lightweight simulated KPI drift.
- Use this script to mimic real-time updates without paid infrastructure.

## Step 5 — GitHub Actions workflows
- Use `/.github/workflows/deploy-full-stack.yml` for one-shot FE+BE deployment on each push.
- Keep `/.github/workflows/update-demo-data.yml` to run daily on cron and update JSON snapshots.
- Push commits from workflow only when data changed.

## Step 6 — Repository structure target
- `/src/app` — UI pages and layout.
- `/public/data` — static JSON snapshots.
- `/scripts` — refresh and analytics scripts.
- `/.github/workflows` — one-shot FE+BE deploy + scheduled automation.
- `/docs` — architecture and onboarding runbooks.

## Step 7 — User path (zero-cost start)
1. Fork repository.
2. Toggle default mode in `src/app/page.tsx` or config file.
3. Customize watchlist and KPI targets in `/public/data/*.json`.
4. Enable GitHub Pages in repository settings.
5. Verify live URL and iterate strategy in Demo mode.

## Step 8 — Optional upgrade path
- Add broker APIs behind feature flags while keeping free-tier core unchanged.
- Add premium analytics while preserving free simulator and baseline KPIs forever.
