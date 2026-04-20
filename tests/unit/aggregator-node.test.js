import test from 'node:test';
import assert from 'node:assert/strict';
import { runAggregatorNode } from '../../nodes/aggregator-node.js';

const baseState = {
  symbol: 'AAPL',
  snapshot: { symbol: 'AAPL', price: 190, rsi: 52, volume: 1000 },
  position: { shares: 2, avgCost: 180 },
  portfolioValue: 10000,
  agentOutputs: {
    technical: { action: 'HOLD', confidence: 0.5, reasoning: 'Neutral.' },
    fundamental: { action: 'BUY', confidence: 0.6, reasoning: 'Value support.' },
    sentiment: { action: 'HOLD', confidence: 0.4, reasoning: 'No catalyst.' }
  },
  memory: {
    recentDecisions: [{ action: 'BUY', confidence: 0.7, reason: 'prior' }],
    recentTrades: [{ symbol: 'AAPL', action: 'BUY', status: 'FILLED', price: 180 }],
    metrics: { pnl: 123 }
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

test('aggregator returns validated JSON from Ollama stream', async () => {
  const response = streamResponse([
    '{"message":{"content":"{\\"action\\":\\"BUY\\",\\"confidence\\":0.72,\\"reasoning\\":\\"Consensus bullish\\"}"}}\n'
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
  assert.equal(decision.confidence, 0.72);
  assert.equal(decision.reasoning, 'Consensus bullish');
  assert.equal(events.some((event) => event.type === 'LLM_STREAM'), true);
});

test('aggregator falls back to HOLD on invalid JSON', async () => {
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

  assert.equal(decision.action, 'HOLD');
  assert.equal(decision.source, 'fallback');
});
