# Beginner Guide: How the Trading Agents Work

This guide explains, in plain language, how data moves through the system, where LLM calls happen, and what prompt is used.

---

## 1) One-cycle flow (high level)

For each symbol (example: `AAPL`), one cycle does this:

1. **Fetch market snapshot** (price, volume, RSI).
2. **Run a mini graph** of agents and nodes.
3. **Build a deterministic investment thesis** (BUY/HOLD/SELL + confidence).
4. **Optionally call Ollama LLM** to produce a beginner-friendly explanation.
5. **Apply risk rules** (can modify action to protect capital).
6. **Execute simulated trade**.
7. **Persist + stream state/events/results to UI clients**.

Source entrypoints:
- Trading loop: `trading-engine.js` (`tick` method).
- Graph runner: `engine/mini-graph-runner.js`.

---

## 2) Agent communication model (how they “talk”)

Agents **do not call each other directly**.  
They communicate through a shared in-memory graph state object:

- `state.snapshot`
- `state.position`
- `state.agentOutputs`
- `state.investmentThesis`
- `state.aggregatedDecision`
- `state.riskDecision`
- `state.execution`

Each node writes output back into `state`; downstream nodes read from that state.

In addition, each node emits lifecycle events (`START`, `PROCESSING`, `DONE`) and domain events (`THESIS_BUILT`, `LLM_STREAM`, etc.), which are broadcast to:
- Server-Sent Events (`/events`)
- WebSocket (`/ws`)

So communication is:
- **Data path:** shared graph state.
- **Observability path:** emitted events.

---

## 3) Exact graph order

The graph runs in this sequence:

1. `DATA`
2. Parallel fan-out:
   - `TECHNICAL_AGENT`
   - `FUNDAMENTAL_AGENT`
   - `SENTIMENT_AGENT`
   - `RISK_AGENT`
3. `INVESTMENT_THESIS`
4. `AGGREGATOR`
5. `RISK`
6. `EXECUTION`

Important beginner note:
- The **final recommendation logic is deterministic** in `INVESTMENT_THESIS`.
- The LLM is used in `AGGREGATOR` to explain that recommendation in simple language.

---

## 4) Where LLM calls happen

## Active LLM call in production flow

Location: `nodes/aggregator-node.js`

The node calls Ollama only when:
- `llm.provider === "ollama"`
- `llm.url` is configured

It posts to `llm.url` with:
- system prompt (`TEACHER_SYSTEM_PROMPT`)
- user prompt from `buildTeacherPrompt(...)`
- `stream: true`

If call fails or JSON is malformed, it falls back to deterministic explanation text.

## Legacy helper in engine

`trading-engine.js` still contains `llmDecide(snapshot)` with a direct BUY/SELL/HOLD prompt.  
Current graph-driven trading path uses `runTradingGraph(...)`; the explanation LLM call happens in `AGGREGATOR`.

---

## 5) Prompt used (human-readable)

There are two prompt pieces used by the active `AGGREGATOR` call:

### System prompt
- Role: beginner investing mentor
- Hard rule: **must not change recommendation**
- Output format: strict JSON
- Required fields: `summary`, `stepByStep[]`, `fullText`

### User prompt payload
`buildTeacherPrompt(...)` sends JSON including:
- objective
- style constraints (`calm`, `simple`, etc.)
- required sections
- `symbol`, `currentPrice`
- full deterministic thesis
- agent signals

This gives the LLM full context for explanation while keeping decision logic deterministic.

---

## 6) “Who decides the trade?”

Short answer:
- **Decision:** deterministic thesis + deterministic risk rules.
- **LLM:** explanatory layer (teaching output), not the core decision-maker in the current graph flow.

Decision chain:
1. `INVESTMENT_THESIS` computes recommendation.
2. `RISK` may override (e.g., stop-loss/take-profit).
3. `EXECUTION` performs simulated trade.

---

## 7) Where to inspect live behavior

- SSE stream: `GET /events`
  - `state` events
  - `process` events (includes graph and stream tokens)
  - `results` events
- WebSocket: `GET /ws`
  - channels: `state`, `process`, `results`

For beginners, this means you can watch each cycle as it happens rather than guessing what the agents did.
