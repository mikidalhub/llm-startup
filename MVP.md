# Local MVP (Backend + FE)

This MVP runs a lightweight backend with Server-Sent Events (SSE) and a simple frontend dashboard that updates automatically.

## Quick Start (Local)
```bash
npm install
node server.js
```
Open http://localhost:3000 to view the live dashboard.

## Quick Start (Docker)
```bash
docker compose up --build
```
Open http://localhost:3000 to view the live dashboard.

## What It Does
- Generates a synthetic market snapshot, macro signals, and a risk-aware portfolio recommendation.
- Streams updates via SSE every 5 seconds.
- Displays LLM-style macro commentary (mocked by default).

## Free LLM Options (Optional)
The default LLM provider is a **mock** summary. To use a free local model instead:

### Option A: Ollama (recommended, free local)
1. Install and run Ollama: https://ollama.com
2. Pull a model (example):
   ```bash
   ollama pull llama3
   ```
3. Run the stack with:
   ```bash
   LLM_PROVIDER=ollama docker compose up --build
   ```

**Is this free?** Ollama runs models locally on your machine, so there is no paid API usage. You only pay for your own
compute resources (CPU/GPU).

### Option B: LM Studio / Local APIs
You can expose a local OpenAI-compatible endpoint and point `OLLAMA_URL` to it (or update the code to match your provider).

## Environment Variables
- `PORT` (default: 3000)
- `UPDATE_INTERVAL_MS` (default: 5000)
- `LLM_PROVIDER` (`mock` or `ollama`)
- `OLLAMA_URL` (default: `http://localhost:11434/api/generate`)

## Notes
- This MVP is intentionally minimal for speed and clarity.
- The backend is `server.js` and the UI is in `public/index.html` (served as static HTML for the demo).
