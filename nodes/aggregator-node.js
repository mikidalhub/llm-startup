import { buildDeterministicTeacherFallback, buildTeacherPrompt } from '../app/core/teacher-explainer.js';

const MAX_STREAM_CHARS = 8_000;
const REQUEST_TIMEOUT_MS = 10_000;

const TEACHER_SYSTEM_PROMPT = `You are an investing mentor for beginners.
You MUST NOT change the recommendation.
You MUST explain only the deterministic thesis that is provided.
Use simple language, short steps, and confidence-building tone.
Return strict JSON only:
{
  "summary": "...",
  "stepByStep": ["...", "..."],
  "fullText": "..."
}`;

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

const normalizeTeacherExplanation = (candidate) => {
  const summary = String(candidate?.summary || '').trim();
  const fullText = String(candidate?.fullText || '').trim();
  const stepByStep = Array.isArray(candidate?.stepByStep)
    ? candidate.stepByStep.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  if (!summary || !fullText || !stepByStep.length) return null;
  return { summary, fullText, stepByStep, source: 'ollama' };
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
        // ignore malformed streaming chunks
      }
    }
  }

  return text;
};

const buildFallbackDecision = (state, reason) => {
  const thesis = state.investmentThesis || {};
  const fallbackExplanation = buildDeterministicTeacherFallback(thesis);
  return {
    action: thesis.finalRecommendation || 'HOLD',
    confidence: Number(thesis.recommendationConfidence ?? 0.35),
    reasoning: fallbackExplanation.summary,
    final_reasoning: fallbackExplanation.fullText,
    teacherExplanation: fallbackExplanation,
    source: 'fallback',
    fallbackReason: reason
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
  const { llm, fetchFn = fetch, timeoutMs = REQUEST_TIMEOUT_MS, llmCache = null } = context;
  const thesis = state.investmentThesis;

  if (!thesis) {
    return buildFallbackDecision(state, 'Missing deterministic thesis payload.');
  }

  if (llm?.provider !== 'ollama' || !llm?.url) {
    return buildFallbackDecision(state, 'Ollama unavailable; deterministic teacher fallback used.');
  }

  const prompt = buildTeacherPrompt({ thesis, symbol: state.symbol, snapshot: state.snapshot });
  const cacheKey = llmCache?.makeKey?.({
    promptTemplate: TEACHER_SYSTEM_PROMPT,
    contextSnapshot: { thesis, model: llm.model, symbol: state.symbol }
  });

  const executeRequest = async () => {
    const startedAt = Date.now();
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
          messages: [{ role: 'system', content: TEACHER_SYSTEM_PROMPT }, prompt]
        })
      });

      if (!response.ok) throw new Error(`Teacher explainer request failed (${response.status})`);

      const raw = await readOllamaStream({ response, emit });
      const parsed = parseJsonBlock(raw);
      const teacherExplanation = normalizeTeacherExplanation(parsed);
      if (!teacherExplanation) throw new Error('Teacher explainer returned malformed JSON.');

      const latencyMs = Date.now() - startedAt;
      const promptTokens = Math.ceil((TEACHER_SYSTEM_PROMPT.length + JSON.stringify(prompt).length) / 4);
      const completionTokens = Math.ceil(raw.length / 4);
      const estimatedUsd = Number((((promptTokens * 0.0000005) + (completionTokens * 0.0000015))).toFixed(6));
      llmCache?.trackCost?.({ strategy: 'teacher-explainer', promptTokens, completionTokens, estimatedUsd });

      const metadata = { latencyMs, promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, estimatedUsd };
      const responsePayload = {
        action: thesis.finalRecommendation,
        confidence: thesis.recommendationConfidence,
        reasoning: teacherExplanation.summary,
        final_reasoning: teacherExplanation.fullText,
        teacherExplanation,
        source: 'ollama',
        metadata,
        cache: { hit: false }
      };
      if (cacheKey) await llmCache?.set?.(cacheKey, responsePayload, metadata);
      return responsePayload;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      emitFallback(emit, reason);
      return buildFallbackDecision(state, `Aggregator failed: ${reason}`);
    } finally {
      clearTimeout(timeout);
    }
  };

  if (!cacheKey || !llmCache) return executeRequest();
  return llmCache.dedupe(cacheKey, executeRequest);
};
