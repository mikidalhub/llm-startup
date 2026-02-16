import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFallbackDecision, calculateRSI, parseJsonBlock, TradingEngine } from '../../trading-engine.js';

const baseConfig = {
  symbols: ['AAPL'],
  pollIntervalSeconds: 1,
  capital: 1000,
  maxPositionPct: 0.2,
  rsiPeriod: 3,
  outputPath: './tmp-results.json',
  llm: { provider: 'mock', model: 'none', url: 'http://localhost' }
};

test('calculateRSI returns 50 when history is too short', () => {
  assert.equal(calculateRSI([10, 11, 12], 14), 50);
});

test('parseJsonBlock parses wrapped JSON', () => {
  const parsed = parseJsonBlock('result\n{"action":"BUY","size_pct":0.1,"reason":"test"}\nend');
  assert.deepEqual(parsed, { action: 'BUY', size_pct: 0.1, reason: 'test' });
});

test('buildFallbackDecision follows RSI bands', () => {
  assert.equal(buildFallbackDecision({ rsi: 30 }).action, 'BUY');
  assert.equal(buildFallbackDecision({ rsi: 80 }).action, 'SELL');
  assert.equal(buildFallbackDecision({ rsi: 50 }).action, 'HOLD');
});

test('TradingEngine tick writes results and records trade with synthetic fallback', async () => {
  const writes = [];
  const engine = new TradingEngine(baseConfig, {
    fetchFn: async () => {
      throw new Error('network down');
    },
    writeFileFn: async (path, payload) => {
      writes.push({ path, payload: JSON.parse(payload) });
    },
    clock: () => '2024-01-01T00:00:00.000Z'
  });

  await engine.tick();

  assert.equal(engine.lastError?.includes('network down'), true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, './tmp-results.json');
  assert.equal(writes[0].payload.snapshots.AAPL.source, 'synthetic-fallback');
  assert.equal(engine.portfolio.trades.length, 1);
});

test('TradingEngine executes buy and sell decisions safely', () => {
  const engine = new TradingEngine(baseConfig, { clock: () => '2024-01-01T00:00:00.000Z' });
  const snapshot = { symbol: 'AAPL', price: 100, volume: 10, rsi: 25, ts: '2024-01-01T00:00:00.000Z' };

  engine.snapshots.AAPL = snapshot;
  engine.executeTrade('AAPL', snapshot, { action: 'BUY', size_pct: 0.1, reason: 'test buy' });
  assert.ok(engine.portfolio.positions.AAPL.shares > 0);

  engine.executeTrade('AAPL', snapshot, { action: 'SELL', size_pct: 0.1, reason: 'test sell' });
  assert.equal(engine.portfolio.trades.length, 2);
});
