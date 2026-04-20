import test from 'node:test';
import assert from 'node:assert/strict';

import { LlmCacheManager } from '../../engine/llm-cache-manager.js';

test('LlmCacheManager.get evicts expired in-memory entries on lookup', async () => {
  let now = 10_000;
  const cache = new LlmCacheManager({
    clock: () => now,
    redisStore: { getJson: async () => null }
  });

  cache.memory.set('stale-key', {
    value: { answer: 'stale' },
    metadata: {},
    createdAt: 0,
    expiresAt: 9_999
  });

  const miss = await cache.get('stale-key');

  assert.equal(miss, null);
  assert.equal(cache.memory.has('stale-key'), false);
});
