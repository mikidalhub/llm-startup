# AI Driven Stock Market Autonomous

This project is like a robot that **pretends to trade stocks**.
It watches market prices, checks a simple signal called RSI, and decides if it would BUY, SELL, or HOLD.

✅ It uses **fake money only**.

✅ It is for **learning and experiments**, not real investing.

## What this app does

- Gets market prices from Yahoo Finance (example symbols: `AAPL`, `BTC-USD`)
- Calculates RSI(14) using 5-minute candles
- Runs an automated trading loop every 1–5+ minutes (configurable)
- Simulates trades with virtual capital
- Saves the latest simulation state to `results.json`
- Shows a very simple dashboard UI
- Includes beginner-friendly traffic lights:
  - Value
  - Quality
  - Risk
  - Income

## What AI does here

- By default, the app uses a simple built-in decision fallback.
- You can optionally connect Ollama for LLM decisions.
- If the LLM fails, the app safely falls back to `HOLD` logic.

## API endpoints

- `GET /api/results` → latest data from `results.json`
- `GET /api/portfolio` → portfolio snapshot
- `GET /api/signals` → latest signal list
- `GET /api/state` → full in-memory state

## How to run

```bash
git clone <your-repo-url>
cd llm-startup
npm install
npm start
```

Then open:

`http://localhost:3000`

## Notes

- If `results.json` does not exist yet, APIs return safe default data.
- This is a simulator for education. Do not use it for real-money trading decisions.

## Deploy to Google Cloud Run

### One-time setup

Set your project ID, then run the deployment script:

```bash
# Optional if you use the default already configured in deploy.sh
export PROJECT_ID=ltcc-492815
# Optional if you use the default FE origin already configured in deploy.sh
export FRONTEND_URL=https://mikidalhub.github.io/llm-startup
./deploy.sh
```

The script performs:

- `gcloud config set project $PROJECT_ID`
- enabling required services (`run`, `artifactregistry`, `cloudbuild`)
- Artifact Registry repository creation (if missing)
- Docker auth configuration for Artifact Registry
- image build and push
- Cloud Run deployment

### Defaults used by `deploy.sh`

- `REGION=us-central1`
- `REPOSITORY=myrepo`
- `SERVICE_NAME=myapp`
- `IMAGE_NAME=myapp`
- `PROJECT_ID=ltcc-492815` (default)
- `FRONTEND_URL=https://mikidalhub.github.io/llm-startup` (default; used to set backend CORS)

You can override them for CI or different environments:

```bash
PROJECT_ID=my-project REGION=us-central1 REPOSITORY=myrepo SERVICE_NAME=myapp IMAGE_NAME=myapp FRONTEND_URL=https://my-frontend.vercel.app ./deploy.sh
```

After deployment, Cloud Run prints a URL similar to:

`https://SERVICE_NAME-xxxxx-REGION.a.run.app`

The server reads `PORT` from environment and defaults to `8080` for Cloud Run.
The deployment script also sets `CORS_ALLOWED_ORIGIN` on Cloud Run so your deployed GitHub frontend can call backend APIs without browser CORS errors.

## Connect GitHub Pages frontend to Cloud Run backend

When frontend and backend run on different domains (for example, `https://mikidalhub.github.io/llm-startup` for frontend and `https://SERVICE-NAME-xxxxx-uc.a.run.app` for backend), configure the frontend with:

```bash
NEXT_PUBLIC_API_ORIGIN=https://SERVICE-NAME-xxxxx-uc.a.run.app
```

Without this variable, the frontend uses same-origin calls (for example `/api/process/start`), which on GitHub Pages resolves to the GitHub Pages domain and not to Cloud Run.
