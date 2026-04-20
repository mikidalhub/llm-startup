const ACTIONS = new Set(['BUY', 'SELL', 'HOLD']);
const MAX_STREAM_CHARS = 6_000;
const REQUEST_TIMEOUT_MS = 10_000;

const AGGREGATOR_SYSTEM_PROMPT = `You are the LLM Aggregator in a multi-agent trading system running via Ollama.

Your role is to analyze structured outputs from multiple agents (technical, fundamental, sentiment) and produce a single, final trading decision.

Input:
- Structured JSON outputs from multiple agents
- Current portfolio state
- Optional summarized recent performance/memory

Task:
- Evaluate all agent signals
- Resolve conflicts (weigh confidence and reasoning)
- Produce ONE final decision

Rules (CRITICAL):
- DO NOT explain outside JSON
- DO NOT add comments or text
- DO NOT include markdown
- Output MUST be valid JSON only
- If uncertain -> return HOLD

Output format (STRICT):
{
  "action": "BUY | SELL | HOLD",
  "confidence": 0.0,
  "reasoning": "Concise explanation of why this decision was made based on agent inputs"
}

Decision guidelines:
- Favor consensus across agents
- Penalize low-confidence or conflicting signals
- Be conservative in uncertain conditions
- Prioritize risk-aware decisions

Reminder:
You are NOT generating signals — you are aggregating and validating them.`;

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const parseJsonBlock = (rawText) => {
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const summarizeMemory = (memory) => {
  if (!memory) return { summary: 'No memory available.', sample: [] };

  const recentDecisions = (memory.recentDecisions || []).slice(-5).map((item) => ({
    action: item.action,
    confidence: item.confidence,
    reason: item.reason,
    riskStatus: item.riskStatus
  }));
  const recentTrades = (memory.recentTrades || []).slice(-5).map((item) => ({
    symbol: item.symbol,
    action: item.action,
    status: item.status,
    price: item.price
  }));

  return {
    summary: `Recent decisions=${recentDecisions.length}, trades=${recentTrades.length}, pnl=${memory.metrics?.pnl ?? 0}`,
    sample: { recentDecisions, recentTrades }
  };
};

const conservativeFallback = (state, reason = 'Aggregator fallback to HOLD for safety.') => ({
  action: 'HOLD',
  confidence: 0.25,
  reasoning: reason,
  final_reasoning: reason,
  source: 'fallback'
});

const normalizeDecision = (candidate) => {
  const action = String(candidate?.action || '').toUpperCase();
  const confidence = clamp01(candidate?.confidence);
  const reasoning = String(candidate?.reasoning || '').trim();

  if (!ACTIONS.has(action)) return null;
  if (!Number.isFinite(confidence)) return null;
  if (!reasoning) return null;

  return {
    action,
    confidence,
    reasoning,
    final_reasoning: reasoning,
    source: 'ollama'
  };
};

const emitToken = (emit, token) => {
  emit?.({
    type: 'LLM_STREAM',
    node: 'AGGREGATOR',
    status: 'PROCESSING',
    payload: { token },
    timestamp: new Date().toISOString()
  });
};

const readOllamaStream = async ({ response, emit }) => {
  const reader = response.body?.getReader?.();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line);
        const token = String(chunk.message?.content || '');
        if (!token) continue;

        text += token;
        if (text.length > MAX_STREAM_CHARS) text = text.slice(-MAX_STREAM_CHARS);
        emitToken(emit, token);
      } catch {
        // ignore malformed chunks
      }
    }
  }

  return text;
};

const buildPromptPayload = (state) => {
  const memory = summarizeMemory(state.memory);
  state.memorySummary = memory.summary;

  return {
    technical_agent: state.agentOutputs?.technical || {},
    fundamental_agent: state.agentOutputs?.fundamental || {},
    sentiment_agent: state.agentOutputs?.sentiment || {},
    portfolio: {
      symbol: state.symbol,
      portfolioValue: state.portfolioValue,
      position: state.position || { shares: 0, avgCost: 0 },
      latestSnapshot: state.snapshot || {}
    },
    memory
  };
};

const emitFallback = (emit, reason) => {
  emit?.({
    type: 'AGGREGATOR_FALLBACK',
    node: 'AGGREGATOR',
    status: 'DONE',
    payload: { reason },
    timestamp: new Date().toISOString()
  });
};

export const runAggregatorNode = async (state, emit, context = {}) => {
  const { llm, fetchFn = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = context;
  if (llm?.provider !== 'ollama' || !llm?.url) {
    return conservativeFallback(state, 'Ollama unavailable; conservative HOLD fallback.');
  }

  const payload = buildPromptPayload(state);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(llm.url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: llm.model,
        stream: true,
        messages: [
          { role: 'system', content: AGGREGATOR_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload) }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Aggregator request failed (${response.status})`);
    }

    const raw = await readOllamaStream({ response, emit });
    const parsed = parseJsonBlock(raw);
    const normalized = normalizeDecision(parsed);

    if (!normalized) {
      throw new Error('Aggregator returned non-compliant JSON decision payload.');
    }

    return normalized;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    emitFallback(emit, reason);
    return conservativeFallback(state, `Aggregator failed validation: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
};
