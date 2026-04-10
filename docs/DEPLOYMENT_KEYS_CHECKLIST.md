# Deployment Keys / GitHub Setup Checklist

Use this checklist before first deploy.

## 1) GitHub Pages setup
- Repository → Settings → Pages
- Source: **GitHub Actions**

## 2) Required backend URL (choose one location)
- Repository variable: `NEXT_PUBLIC_API_ORIGIN`
- or Repository secret: `NEXT_PUBLIC_API_ORIGIN`
  - Render example: `https://my-backend.onrender.com`
  - Railway example: `https://my-backend.up.railway.app`
  - Fly.io example: `https://my-backend.fly.dev`

Without this, frontend deploy workflow fails by design.

Where to set it in GitHub:
- Open your repo on GitHub.
- Go to **Settings → Secrets and variables → Actions**.
- For a variable:
  - Open the **Variables** tab → **New repository variable**
  - Name: `NEXT_PUBLIC_API_ORIGIN`
  - Value example: `https://my-backend.onrender.com`
- For a secret:
  - Open the **Secrets** tab → **New repository secret**
  - Name: `NEXT_PUBLIC_API_ORIGIN`
  - Value example: `https://my-backend.onrender.com`

Tip:
- Use **variable** for non-sensitive public backend URLs.
- Use **secret** only if you intentionally do not want the value visible in repo settings.

## 3) Optional repository secrets (for one-shot backend rollout)
- `RENDER_DEPLOY_HOOK_URL`
- `RAILWAY_DEPLOY_HOOK_URL`
- `FLY_DEPLOY_HOOK_URL`

If omitted, backend image is still published to GHCR, but provider rollout is manual.
This means the repo is provider-agnostic by default (no single provider is preselected).

What to put in each:
- `RENDER_DEPLOY_HOOK_URL`
  - In Render: **Dashboard → Service → Settings → Deploy Hook → Create Hook**
  - Paste the full hook URL (usually starts with `https://api.render.com/deploy/...`).
- `RAILWAY_DEPLOY_HOOK_URL`
  - In Railway: create a deployment webhook for your service/project (Settings/Deployments).
  - Paste the full Railway webhook URL.
- `FLY_DEPLOY_HOOK_URL`
  - If you use a webhook relay in front of Fly deploy commands, paste that URL.
  - If not using webhook-based Fly deploy, leave this secret unset and deploy Fly manually.

## 4) Package permissions
The workflow requires `packages: write` permission to push backend images to GHCR.

## 5) What is NOT needed
- No paid GitHub plan required for public repos.
- No cloud keys required if you only use deploy hooks + GHCR.

## 6) First deploy flow
1. Push to `main`.
2. `deploy-full-stack.yml` runs tests, deploys frontend, pushes backend image.
3. If provider hook is set, backend redeploy is triggered automatically.
4. Open GitHub Pages URL for FE and verify API calls hit `NEXT_PUBLIC_API_ORIGIN`.
