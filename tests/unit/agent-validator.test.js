import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentFallback, validateAgentOutput } from '../../app/core/agent-validator.js';

test('validateAgentOutput clamps confidence and sanitizes payload', () => {
  const output = validateAgentOutput('technical-agent', {
    name: ' technical-agent ',
    confidence: 4,
    data: { rsi: 40 },
    warnings: ['  note  ', '', null]
  });

  assert.equal(output.name, 'technical-agent');
  assert.equal(output.confidence, 1);
  assert.deepEqual(output.data, { rsi: 40 });
  assert.deepEqual(output.warnings, ['note']);
});

test('validateAgentOutput falls back on malformed output', () => {
  const output = validateAgentOutput('sentiment-agent', null);
  assert.equal(output.name, 'sentiment-agent');
  assert.equal(output.confidence, 0);
  assert.deepEqual(output.data, {});
  assert.equal(output.warnings.length > 0, true);
});

test('createAgentFallback creates safe contract payload', () => {
  const fallback = createAgentFallback('risk-agent', 'bad output');
  assert.deepEqual(fallback, {
    name: 'risk-agent',
    confidence: 0,
    data: {},
    warnings: ['bad output']
  });
});
