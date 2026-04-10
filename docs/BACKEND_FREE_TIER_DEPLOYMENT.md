# Backend Deployment on GitHub-Centric Free Tier

## Important constraint
GitHub Pages only serves static files. It cannot run `server.js`, SSE streams, or containerized backend processes.

## What we can do on free tier
1. **Frontend on GitHub Pages** (`deploy-pages.yml`) for zero-cost static hosting.
2. **Backend image on GHCR** (GitHub Container Registry) using GitHub Actions.
3. **Run container on a free compute host** (for example Cloud Run free tier, Fly.io trial/free allocations, Render free web service when available), while keeping source, CI, and image delivery GitHub-centric.

## Existing backend in this repo
- Entry point: `server.js`
- HTTP + SSE API server: `app-server.js`
- Docker build target: `Dockerfile`

## Recommended container flow
1. Push code to GitHub.
2. Action builds backend container and pushes to `ghcr.io/<owner>/<repo>-backend`.
3. External free compute pulls image from GHCR and runs it.
4. Set `NEXT_PUBLIC_API_ORIGIN` in frontend deploy workflow to that backend URL.

## Minimal environment variables for backend runtime
- `PORT` (usually injected by host)
- `CORS_ALLOWED_ORIGIN` (set to your Pages URL)
- Optional strategy settings from `config.yaml`

## Why this is still GitHub-friendly
- Source, PRs, Actions, package/image registry, and frontend hosting all stay on GitHub.
- Only stateless compute execution is external, which is unavoidable for a live Node backend.
