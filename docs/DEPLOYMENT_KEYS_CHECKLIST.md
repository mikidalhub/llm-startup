# Deployment Keys / GitHub Setup Checklist

Use this checklist before first deploy.

## 1) GitHub Pages setup
- Repository → Settings → Pages
- Source: **GitHub Actions**

## 2) Required repository variable
- `NEXT_PUBLIC_API_ORIGIN` = your backend URL
  - Example: `https://my-backend.onrender.com`

Without this, frontend deploy workflow fails by design.

## 3) Optional repository secrets (for one-shot backend rollout)
- `RENDER_DEPLOY_HOOK_URL`
- `RAILWAY_DEPLOY_HOOK_URL`
- `FLY_DEPLOY_HOOK_URL`

If omitted, backend image is still published to GHCR, but provider rollout is manual.

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
