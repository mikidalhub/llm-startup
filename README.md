# Autonomous Markets Control Deck

## Goal
Build a local-first, fully automated system that monitors global market signals, summarizes macro context with an optional local LLM, and streams a risk-aware portfolio stance to a realtime dashboard.

## Tech Stack
- **Next.js + React**: Frontend framework and UI rendering.
- **MUI (Material UI)** + **Emotion**: UI component system and styling.
- **Node.js**: Single service backend that generates the demo state and emits Server-Sent Events.
- **SSE (Server-Sent Events)**: Pushes live updates to the UI without user input.
- **Docker**: Optional containerization for portable runs.
- **Ollama (optional)**: Free, local LLM runtime for summarization.

## Business Context
- **Use case**: Automated market intelligence and portfolio guidance.
- **Value**: Continuous, explainable signals with disciplined risk framing.
- **Audience**: Founders, PMs, and investment teams needing a clear, live operational view.

## App Start Guide
### Option A: Local Node
```bash
git checkout feature/project-readme
npm install
node server.js
```
Open **http://localhost:3000** to view the live dashboard.

### Option B: Docker
```bash
git checkout feature/project-readme
docker compose up --build
```
Open **http://localhost:3000** to view the live dashboard.

### Optional: Local LLM (Ollama)
```bash
ollama pull llama3
LLM_PROVIDER=ollama docker compose up --build
```
The UI will display **Local Ollama** as the LLM source when enabled.
