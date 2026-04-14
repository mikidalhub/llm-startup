# Deployment Strategy Plan (GitHub Pages FE + Render Backend)

## Why UI differs between GitHub and Render
- `https://mikidalhub.github.io/...` serves the **Next.js static frontend** built by GitHub Pages workflow.
- `https://llm-startup.onrender.com/` serves files from backend `public/` as a fallback static site.
- Backend static fallback is implemented in `app-server.js` by reading files from `public/` when route is not an API route.

So you are currently seeing two different UIs from two different hosts.

## Recommended target architecture
1. **Frontend host:** GitHub Pages only.
2. **Backend host:** Render only (API + event stream endpoints).
3. **Frontend API origin:** `NEXT_PUBLIC_API_ORIGIN=https://llm-startup.onrender.com`.
4. **No product UI on backend root** (optional but recommended): set `SERVE_STATIC_UI=false` on Render.

## Implementation plan

### Phase 1 — Lock routing boundaries
- Keep FE URL as GitHub Pages.
- Keep BE URL as Render.
- Verify backend endpoints:
  - `/api/health`
  - `/api/state`
  - `/api/process/start`
  - `/events`

### Phase 2 — Remove UI ambiguity on backend host
- In Render Environment Variables set:
  - `SERVE_STATIC_UI=false`
- Result: backend root (`/`) returns a JSON service response instead of legacy static UI.

### Phase 3 — Validate end-to-end deployment
1. Push to `main`.
2. `deploy-full-stack.yml` builds Pages FE and backend image.
3. Workflow triggers Render deploy hook (if configured).
4. Workflow health-check validates `${NEXT_PUBLIC_API_ORIGIN}/api/health`.
5. Open GitHub Pages FE and confirm live calls hit Render backend.

### Phase 4 — Optional hardening
- Add custom subdomains:
  - `app.<domain>` → GitHub Pages
  - `api.<domain>` → Render
- Add CORS restriction (`CORS_ALLOWED_ORIGIN`) to FE domain only.
- Add uptime ping to `/api/health`.
