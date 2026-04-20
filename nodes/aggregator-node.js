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

const buildFallbackDecision = (snapshot) => {
  if ((snapshot?.rsi ?? 50) < 35) return { action: 'BUY', size_pct: 0.07, reason: 'RSI indicates oversold conditions.' };
  if ((snapshot?.rsi ?? 50) > 70) return { action: 'SELL', size_pct: 0.07, reason: 'RSI indicates overbought conditions.' };
  return { action: 'HOLD', size_pct: 0, reason: 'Momentum is neutral.' };
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const summarizeMemory = (memory) => {
  if (!memory) return 'No memory available.';
  const recentActions = (memory.recentDecisions || []).slice(-3).map((item) => item.action).join(', ') || 'none';
  const lastTrades = (memory.recentTrades || []).slice(-3).map((item) => item.action).join(', ') || 'none';
  return `Recent actions: ${recentActions}. Recent trades: ${lastTrades}. PnL: ${memory.metrics?.pnl ?? 0}.`;
};

const buildFallbackAggregate = (state) => {
  const technical = state.agentOutputs?.technical;
  if (technical?.action) {
    return {
      action: technical.action,
      confidence: clamp01(technical.confidence ?? 0.5),
      final_reasoning: `Fallback aggregator used technical agent: ${technical.reasoning}`
    };
  }

  const fallback = buildFallbackDecision(state.snapshot || {});
  return {
    action: fallback.action,
    confidence: 0.45,
    final_reasoning: fallback.reason
  };
};

const parseOllamaStream = async ({ response, onToken }) => {
  const reader = response.body?.getReader?.();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

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
        const token = chunk.message?.content || '';
        if (token) {
          fullText += token;
          onToken?.(token);
        }
      } catch {
        // ignore malformed stream chunks
      }
    }
  }

  return fullText;
};

export const runAggregatorNode = async (state, emit, context = {}) => {
  const { llm, fetchFn = fetch } = context;
  const memorySummary = summarizeMemory(state.memory);
  state.memorySummary = memorySummary;

  if (llm?.provider !== 'ollama' || !llm?.url) {
    return buildFallbackAggregate(state);
  }

  const prompt = `You are an aggregation node for a trading graph.\nOutput strict JSON only: {"action":"BUY|SELL|HOLD","confidence":0-1,"final_reasoning":"..."}.\nTechnical: ${JSON.stringify(state.agentOutputs?.technical || {})}\nFundamental: ${JSON.stringify(state.agentOutputs?.fundamental || {})}\nSentiment: ${JSON.stringify(state.agentOutputs?.sentiment || {})}\nPortfolio: ${JSON.stringify({ value: state.portfolioValue, position: state.position })}\nMemory: ${memorySummary}`;

  try {
    const response = await fetchFn(llm.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: llm.model,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`Aggregator LLM request failed (${response.status})`);

    let streamText = '';
    streamText = await parseOllamaStream({
      response,
      onToken: (token) => emit?.({
        type: 'LLM_STREAM',
        node: 'AGGREGATOR',
        status: 'PROCESSING',
        payload: { token },
        timestamp: new Date().toISOString()
      })
    });

    const parsed = parseJsonBlock(streamText);
    if (!parsed?.action) throw new Error('Aggregator returned invalid JSON payload');

    return {
      action: String(parsed.action).toUpperCase(),
      confidence: clamp01(parsed.confidence),
      final_reasoning: parsed.final_reasoning || 'No final reasoning provided.'
    };
  } catch (error) {
    emit?.({
      type: 'AGGREGATOR_FALLBACK',
      node: 'AGGREGATOR',
      status: 'DONE',
      payload: { reason: error instanceof Error ? error.message : String(error) },
      timestamp: new Date().toISOString()
    });
    return buildFallbackAggregate(state);
  }
};
