import test from 'node:test';
import assert from 'node:assert/strict';

import { LlmCacheManager } from '../../engine/llm-cache-manager.js';

test('LlmCacheManager.get evicts expired in-memory entries on lookup', async () => {
  const cache = new LlmCacheManager({
    clock: () => 10_000,
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

test('LlmCacheManager.get removes expired Redis entries before continuing lookup', async () => {
  const redisCalls = [];
  const cache = new LlmCacheManager({
    clock: () => 10_000,
    redisStore: {
      getJson: async () => ({ value: { answer: 'stale-redis' }, expiresAt: 9_999 }),
      deleteJson: async (key) => {
        redisCalls.push(key);
        return true;
      }
    }
  });

  const miss = await cache.get('redis-stale-key');

  assert.equal(miss, null);
  assert.deepEqual(redisCalls, ['redis-stale-key']);
});

test('LlmCacheManager.set derives createdAt and expiresAt from the same timestamp', async () => {
  const cache = new LlmCacheManager({
    ttlMs: 500,
    clock: () => 20_000,
    redisStore: { setJson: async () => true }
  });

  const entry = await cache.set('key', { answer: 'fresh' });

  assert.equal(entry.createdAt, 20_000);
  assert.equal(entry.expiresAt, 20_500);
});
