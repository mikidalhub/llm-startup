# Autonomous Markets Control Deck

## Goal
Build a step-by-step, capital-efficient trading startup that ingests data from major exchanges and platforms (e.g., Nasdaq and large marketplaces), analyzes global market conditions, and executes disciplined buy/sell decisions. The initial objective is to prove profitability with tiny capital (start at $10, target ~$1/week), then scale cautiously as performance and risk controls mature.

## Tech Stack
- **Next.js + React**: Frontend framework and UI rendering.
- **MUI (Material UI)** + **Emotion**: UI component system and styling.
- **Node.js**: Single service backend that generates the demo state and emits Server-Sent Events.
- **SSE (Server-Sent Events)**: Pushes live updates to the UI without user input.
- **Docker**: Optional containerization for portable runs.
- **Ollama (optional)**: Free, local LLM runtime for summarization.

## Business Context
- **Use case**: Automated trading that turns small capital into consistent, measurable gains.
- **Value**: Stepwise growth, tight risk controls, and transparent decision logic while learning from real market data.
- **Audience**: Builders and early operators focused on compounding returns from small starting balances.

## App Start Guide
### Option A: Local Node
```bash
npm install
node server.js
```
Open **http://localhost:3000** to view the live dashboard.

### Option B: Docker
```bash
docker compose up --build
```
Open **http://localhost:3000** to view the live dashboard.

### Optional: Local LLM (Ollama)
```bash
ollama pull llama3
LLM_PROVIDER=ollama docker compose up --build
```
The UI will display **Local Ollama** as the LLM source when enabled.
