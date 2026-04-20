import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../../app-server.js';

const mockState = {
  portfolio: {
    cash: 500,
    positions: { AAPL: { shares: 1, avgCost: 100 } },
    trades: Array.from({ length: 60 }, (_, idx) => ({ id: idx + 1 })),
    metrics: { pnl: 1 }
  }
};

const buildMockEngine = () => ({
  config: { outputPath: './tmp-unit-results.json' },
  getState: () => mockState,
  onUpdate: () => () => {},
  tick: () => {}
});

const requestJson = async (port, path) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  const json = await response.json();
  return { status: response.status, json };
};

test('createServer exposes JSON APIs', async () => {
  const server = createServer({
    engine: buildMockEngine(),
    publicDir: new URL('../../public/', import.meta.url)
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const stateResponse = await requestJson(port, '/api/state');
    assert.equal(stateResponse.status, 200);
    assert.deepEqual(stateResponse.json, mockState);

    const resultsResponse = await requestJson(port, '/api/results');
    assert.equal(resultsResponse.status, 200);
    assert.deepEqual(resultsResponse.json.trades, []);

    const bootstrapResponse = await requestJson(port, '/api/bootstrap');
    assert.equal(bootstrapResponse.status, 200);
    assert.ok(bootstrapResponse.json.state);

    const tradesResponse = await requestJson(port, '/trades');
    assert.equal(tradesResponse.status, 200);
    assert.equal(tradesResponse.json.length, 60);

    const portfolioResponse = await requestJson(port, '/portfolio');
    assert.equal(portfolioResponse.status, 200);
    assert.equal(portfolioResponse.json.portfolioValue, 0);
    assert.deepEqual(portfolioResponse.json.positions, {});

    const healthResponse = await requestJson(port, '/api/health');
    assert.equal(healthResponse.status, 200);
    assert.equal(healthResponse.json.status, 'ok');
    assert.equal(healthResponse.json.container, 'running');

    const docsResponse = await requestJson(port, '/api/docs');
    assert.equal(docsResponse.status, 200);
    assert.equal(docsResponse.json.openapi, '3.1.0');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('createServer prefers redis-backed results payload when available', async () => {
  const server = createServer({
    engine: buildMockEngine(),
    redisStore: {
      readResultsPayload: async () => ({
        timestamp: '2026-01-01T00:00:00.000Z',
        portfolioValue: 12500,
        positions: { NVDA: { shares: 5, avgCost: 600 } },
        trades: [{ symbol: 'NVDA', action: 'BUY' }],
        signals: [{ symbol: 'NVDA', signal: 'BUY' }]
      })
    },
    publicDir: new URL('../../public/', import.meta.url)
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const resultsResponse = await requestJson(port, '/api/results');
    assert.equal(resultsResponse.status, 200);
    assert.equal(resultsResponse.json.portfolioValue, 12500);
    assert.equal(resultsResponse.json.trades[0].symbol, 'NVDA');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('createServer accepts process start triggers', async () => {
  let tickReason = '';
  const server = createServer({
    engine: {
      ...buildMockEngine(),
      tick: (reason) => {
        tickReason = reason;
      }
    },
    publicDir: new URL('../../public/', import.meta.url)
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const triggerResponse = await fetch(`http://127.0.0.1:${port}/api/process/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'TEST_TRIGGER' })
    });
    const triggerJson = await triggerResponse.json();
    assert.equal(triggerResponse.status, 200);
    assert.equal(triggerJson.status, 'started');
    assert.equal(tickReason, 'TEST_TRIGGER');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});



test('createServer validates trade date filter format', async () => {
  const server = createServer({
    engine: buildMockEngine(),
    publicDir: new URL('../../public/', import.meta.url)
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/trades?date=20260101`);
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.match(payload.error, /Invalid date format/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('createServer exposes server-sent events stream', async () => {
  const server = createServer({
    engine: {
      ...buildMockEngine(),
      onEvent: () => () => {}
    },
    publicDir: new URL('../../public/', import.meta.url)
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const payload = await new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}/events`, (res) => {
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-type'], 'text/event-stream');

        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString();
          if (body.includes('event: state') && body.includes('event: process')) {
            clearTimeout(timer);
            req.destroy();
            resolve(body);
          }
        });
      });

      req.on('error', reject);
      const timer = setTimeout(() => {
        req.destroy();
        reject(new Error('Timed out waiting for SSE payload'));
      }, 2000);
    });

    assert.match(String(payload), /event: state/);
    assert.match(String(payload), /event: process/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
