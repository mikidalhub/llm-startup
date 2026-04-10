# Backend Deployment on GitHub-Centric Free Tier

## Simple architecture
- **Code** in GitHub repository
- **Container image** in GHCR (`ghcr.io/<owner>/<repo>-backend`)
- **Running app** on free runtime such as Render, Railway, or Fly.io
- **Frontend** on GitHub Pages

## Constraint you must know
GitHub Pages only serves static files. It cannot run `server.js`, SSE streams, or containerized backend processes.

## One-shot deployment path
Use `.github/workflows/deploy-full-stack.yml`:
1. Build + deploy frontend to GitHub Pages
2. Build + push backend image to GHCR
3. Trigger optional deploy hook for Render / Railway / Fly.io

This gives the closest possible “single push” full-stack deploy while remaining GitHub-centric.

## Configure provider hooks (optional but recommended)
Set any of these repository secrets:
- `RENDER_DEPLOY_HOOK_URL`
- `RAILWAY_DEPLOY_HOOK_URL`
- `FLY_DEPLOY_HOOK_URL`

When set, the one-shot workflow calls the webhook after publishing the new GHCR image.

Also set repository variable:
- `NEXT_PUBLIC_API_ORIGIN` (required by frontend workflow)

## Existing backend runtime in this repo
- Entry point: `server.js`
- API/SSE server: `app-server.js`
- Container spec: `Dockerfile`

## Runtime environment variables
- `PORT` (usually injected by platform)
- `CORS_ALLOWED_ORIGIN` (set to your GitHub Pages URL)
- Any strategy/runtime variables from `config.yaml`
