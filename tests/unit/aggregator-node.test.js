import test from 'node:test';
import assert from 'node:assert/strict';
import { runAggregatorNode } from '../../nodes/aggregator-node.js';

const baseState = {
  symbol: 'AAPL',
  snapshot: { symbol: 'AAPL', price: 190, rsi: 52, volume: 1000 },
  investmentThesis: {
    finalRecommendation: 'BUY',
    recommendationConfidence: 0.74,
    valuationScore: 78,
    businessQualityScore: 70,
    financialHealthScore: 72,
    growthScore: 60,
    riskScore: 66,
    fairValueEstimate: 220,
    marginOfSafety: 0.157,
    autopilotAction: 'BUY_NOW'
  }
};

const streamResponse = (chunks) => {
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    }
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/json' } });
};

test('aggregator returns teacher explanation JSON from Ollama stream', async () => {
  const response = streamResponse([
    '{"message":{"content":"{\\"summary\\":\\"Good business at reasonable value\\",\\"stepByStep\\":[\\"Step 1\\",\\"Step 2\\"],\\"fullText\\":\\"Step 1 then Step 2\\"}"}}\n'
  ]);

  const events = [];
  const decision = await runAggregatorNode(
    structuredClone(baseState),
    (event) => events.push(event),
    {
      llm: { provider: 'ollama', model: 'llama3.1:8b', url: 'http://ollama.local/api/chat' },
      fetchFn: async () => response
    }
  );

  assert.equal(decision.action, 'BUY');
  assert.equal(decision.confidence, 0.74);
  assert.equal(decision.teacherExplanation.summary, 'Good business at reasonable value');
  assert.equal(events.some((event) => event.type === 'LLM_STREAM'), true);
});

test('aggregator falls back to deterministic explanation on malformed JSON', async () => {
  const response = streamResponse([
    '{"message":{"content":"not-json-output"}}\n'
  ]);

  const decision = await runAggregatorNode(
    structuredClone(baseState),
    () => {},
    {
      llm: { provider: 'ollama', model: 'llama3.1:8b', url: 'http://ollama.local/api/chat' },
      fetchFn: async () => response
    }
  );

  assert.equal(decision.action, 'BUY');
  assert.equal(decision.source, 'fallback');
  assert.equal(Array.isArray(decision.teacherExplanation.stepByStep), true);
});
