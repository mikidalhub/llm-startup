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

const emitOllamaState = (emit, status, payload = {}) => {
  emit?.({
    type: 'OLLAMA_STATE',
    node: 'AGGREGATOR',
    status,
    payload,
    timestamp: new Date().toISOString()
  });
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
  const { llm, fetchFn = fetch, timeoutMs = REQUEST_TIMEOUT_MS, llmCache = null, mlflowManager = null } = context;
  if (llm?.provider !== 'ollama' || !llm?.url) {
    return conservativeFallback(state, 'Ollama unavailable; conservative HOLD fallback.');
  }

  const payload = buildPromptPayload(state);
  const cacheKey = llmCache?.makeKey?.({
    promptTemplate: AGGREGATOR_SYSTEM_PROMPT,
    contextSnapshot: { payload, model: llm.model, symbol: state.symbol }
  });

  const executeRequest = async () => {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const userPrompt = JSON.stringify(payload);
    const runId = await mlflowManager?.start_prompt_run?.({
      endpointName: '/api/process/start',
      userPrompt,
      selectedModel: llm.model || ''
    });

    try {
      emitOllamaState(emit, 'REQUEST_STARTED', { model: llm.model, endpoint: llm.url, symbol: state.symbol });
      const response = await fetchFn(llm.url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: llm.model,
          stream: true,
          messages: [
            { role: 'system', content: AGGREGATOR_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Aggregator request failed (${response.status})`);
      }

      const raw = await readOllamaStream({ response, emit });
      emitOllamaState(emit, 'RESPONSE_STREAM_DONE', { chars: raw.length, symbol: state.symbol });
      const parsed = parseJsonBlock(raw);
      const normalized = normalizeDecision(parsed);

      if (!normalized) {
        throw new Error('Aggregator returned non-compliant JSON decision payload.');
      }

      const latencyMs = Date.now() - startedAt;
      const promptTokens = Math.ceil((AGGREGATOR_SYSTEM_PROMPT.length + userPrompt.length) / 4);
      const completionTokens = Math.ceil(raw.length / 4);
      const estimatedUsd = Number((((promptTokens * 0.0000005) + (completionTokens * 0.0000015))).toFixed(6));
      llmCache?.trackCost?.({
        strategy: 'aggregator',
        promptTokens,
        completionTokens,
        estimatedUsd
      });
      const metadata = { latencyMs, promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, estimatedUsd };
      await mlflowManager?.log_prompt_response?.({
        responseText: raw,
        latencySeconds: Number((latencyMs / 1000).toFixed(6)),
        runId
      });
      await mlflowManager?.log_prompt_success?.({ runId });
      emitOllamaState(emit, 'RESPONSE_VALIDATED', { action: normalized.action, confidence: normalized.confidence, symbol: state.symbol });
      const responsePayload = { ...normalized, metadata, mlflowRunId: runId || null, cache: { hit: false } };
      if (cacheKey) await llmCache?.set?.(cacheKey, responsePayload, metadata);
      return responsePayload;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      emitFallback(emit, reason);
      emitOllamaState(emit, 'REQUEST_FAILED', { reason, symbol: state.symbol });
      await mlflowManager?.log_prompt_error?.({ errorMessage: reason, runId });
      return { ...conservativeFallback(state, `Aggregator failed validation: ${reason}`), mlflowRunId: runId || null };
    } finally {
      clearTimeout(timeout);
      await mlflowManager?.end_prompt_run?.({ runId });
      emitOllamaState(emit, 'REQUEST_FINISHED', { runId: runId || null, symbol: state.symbol });
    }
  };

  if (!cacheKey || !llmCache) {
    return executeRequest();
  }

  return llmCache.dedupe(cacheKey, executeRequest);
};
