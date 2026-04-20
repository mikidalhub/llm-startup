import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const DEFAULT_TTL_MS = 1000 * 60 * 20;

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export class LlmCacheManager {
  constructor({
    redisStore = null,
    namespace = 'llm-cache',
    coldStoragePath = './data/llm-cache.json',
    ttlMs = DEFAULT_TTL_MS,
    clock = () => Date.now()
  } = {}) {
    this.redisStore = redisStore;
    this.namespace = namespace;
    this.coldStoragePath = coldStoragePath;
    this.ttlMs = ttlMs;
    this.clock = clock;
    this.memory = new Map();
    this.inFlight = new Map();
    this.cost = {
      session: { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedUsd: 0 },
      byStrategy: {}
    };
  }

  makeKey({ promptTemplate, contextSnapshot }) {
    const digest = createHash('sha256')
      .update(`${promptTemplate}::${JSON.stringify(contextSnapshot)}`)
      .digest('hex');
    return `${this.namespace}:${digest}`;
  }

  async get(key) {
    const now = this.clock();
    const cached = this.memory.get(key);
    if (cached && cached.expiresAt > now) return { ...cached, layer: 'memory' };

    const redisEntry = await this.redisStore?.getJson?.(key, null);
    if (redisEntry?.expiresAt > now) {
      this.memory.set(key, redisEntry);
      return { ...redisEntry, layer: 'redis' };
    }

    const coldEntry = await this.readColdEntry(key);
    if (coldEntry?.expiresAt > now) {
      this.memory.set(key, coldEntry);
      await this.redisStore?.setJson?.(key, coldEntry, Math.ceil((coldEntry.expiresAt - now) / 1000));
      return { ...coldEntry, layer: 'cold' };
    }

    return null;
  }

  async set(key, value, metadata = {}) {
    const entry = {
      value,
      metadata,
      createdAt: this.clock(),
      expiresAt: this.clock() + this.ttlMs
    };
    this.memory.set(key, entry);
    await this.redisStore?.setJson?.(key, entry, Math.ceil(this.ttlMs / 1000));
    await this.writeColdEntry(key, entry);
    return entry;
  }

  async dedupe(key, producer) {
    const hit = await this.get(key);
    if (hit?.value) return { ...hit.value, cache: { hit: true, layer: hit.layer, key } };

    if (this.inFlight.has(key)) {
      const waited = await this.inFlight.get(key);
      return { ...waited, cache: { ...(waited.cache || {}), deduped: true, key } };
    }

    const task = (async () => {
      const produced = await producer();
      return produced;
    })();
    this.inFlight.set(key, task);

    try {
      const produced = await task;
      return produced;
    } finally {
      this.inFlight.delete(key);
    }
  }

  trackCost({
    strategy = 'default',
    promptTokens = 0,
    completionTokens = 0,
    estimatedUsd = 0
  }) {
    const totalTokens = Number(promptTokens || 0) + Number(completionTokens || 0);
    const patch = {
      calls: 1,
      promptTokens: Number(promptTokens || 0),
      completionTokens: Number(completionTokens || 0),
      totalTokens,
      estimatedUsd: Number(estimatedUsd || 0)
    };
    const add = (target) => {
      target.calls += patch.calls;
      target.promptTokens += patch.promptTokens;
      target.completionTokens += patch.completionTokens;
      target.totalTokens += patch.totalTokens;
      target.estimatedUsd = Number((target.estimatedUsd + patch.estimatedUsd).toFixed(6));
    };

    add(this.cost.session);
    if (!this.cost.byStrategy[strategy]) {
      this.cost.byStrategy[strategy] = { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedUsd: 0 };
    }
    add(this.cost.byStrategy[strategy]);
    return this.getCostSummary();
  }

  getCostSummary() {
    return { session: this.cost.session, byStrategy: this.cost.byStrategy };
  }

  async readColdEntry(key) {
    try {
      const file = safeParse(await readFile(this.coldStoragePath, 'utf-8'), {});
      return file.entries?.[key] || null;
    } catch {
      return null;
    }
  }

  async writeColdEntry(key, entry) {
    try {
      const file = safeParse(await readFile(this.coldStoragePath, 'utf-8'), {});
      const next = { ...file, entries: { ...(file.entries || {}), [key]: entry } };
      await writeFile(this.coldStoragePath, JSON.stringify(next, null, 2), 'utf-8');
    } catch {
      // best effort cold-storage fallback
    }
  }
}
