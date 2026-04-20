const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export class RedisStore {
  constructor({ url, namespace = 'trading' } = {}) {
    this.url = url;
    this.namespace = namespace;
    this.client = null;
    this.connected = false;
  }

  key(suffix) {
    return `${this.namespace}:${suffix}`;
  }

  async init() {
    if (!this.url || this.client) return;

    let createClient;
    try {
      ({ createClient } = await import('redis'));
    } catch {
      throw new Error('redis package is not installed.');
    }

    this.client = createClient({ url: this.url });
    this.client.on('error', () => {
      this.connected = false;
    });
    await this.client.connect();
    this.connected = true;
  }

  async close() {
    if (this.client?.isOpen) await this.client.quit();
    this.connected = false;
  }

  async cacheState(state) {
    if (!this.connected) return;
    await this.client.set(this.key('state'), JSON.stringify(state));
  }

  async cacheResults(results) {
    if (!this.connected) return;
    await this.client.set(this.key('results'), JSON.stringify(results));
  }

  async appendDecision(decision) {
    if (!this.connected) return;
    await this.client.lPush(this.key('decisions'), JSON.stringify(decision));
    await this.client.lTrim(this.key('decisions'), 0, 249);
  }

  async appendTrade(trade) {
    if (!this.connected) return;
    await this.client.lPush(this.key('trades'), JSON.stringify(trade));
    await this.client.lTrim(this.key('trades'), 0, 499);
  }

  async appendEvent(event) {
    if (!this.connected) return;
    await this.client.lPush(this.key('events'), JSON.stringify(event));
    await this.client.lTrim(this.key('events'), 0, 799);
  }

  async readResultsPayload() {
    if (!this.connected) return null;
    const raw = await this.client.get(this.key('results'));
    return safeParse(raw, null);
  }

  async readLatestState() {
    if (!this.connected) return null;
    const raw = await this.client.get(this.key('state'));
    return safeParse(raw, null);
  }

  async readDecisions(limit = 100) {
    if (!this.connected) return [];
    const rows = await this.client.lRange(this.key('decisions'), 0, Math.max(0, limit - 1));
    return rows
      .map((row) => safeParse(row, null))
      .filter(Boolean)
      .reverse();
  }

  async readTrades(limit = 200) {
    if (!this.connected) return [];
    const rows = await this.client.lRange(this.key('trades'), 0, Math.max(0, limit - 1));
    return rows
      .map((row) => safeParse(row, null))
      .filter(Boolean)
      .reverse();
  }

  async readEvents(limit = 200) {
    if (!this.connected) return [];
    const rows = await this.client.lRange(this.key('events'), 0, Math.max(0, limit - 1));
    return rows
      .map((row) => safeParse(row, null))
      .filter(Boolean)
      .reverse();
  }

  async setJson(suffix, value, ttlSeconds = 0) {
    if (!this.connected) return false;
    const key = this.key(suffix);
    const payload = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await this.client.set(key, payload, { EX: ttlSeconds });
    } else {
      await this.client.set(key, payload);
    }
    return true;
  }

  async getJson(suffix, fallback = null) {
    if (!this.connected) return fallback;
    const raw = await this.client.get(this.key(suffix));
    return safeParse(raw, fallback);
  }
}
