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

    const tradesResponse = await requestJson(port, '/trades');
    assert.equal(tradesResponse.status, 200);
    assert.equal(tradesResponse.json.length, 50);

    const portfolioResponse = await requestJson(port, '/portfolio');
    assert.equal(portfolioResponse.status, 200);
    assert.equal(portfolioResponse.json.portfolioValue, 0);
    assert.deepEqual(portfolioResponse.json.positions, {});

    const healthResponse = await requestJson(port, '/api/health');
    assert.equal(healthResponse.status, 200);
    assert.equal(healthResponse.json.status, 'ok');
    assert.equal(healthResponse.json.container, 'running');
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
            req.destroy();
            resolve(body);
          }
        });
      });

      req.on('error', reject);
      setTimeout(() => {
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
