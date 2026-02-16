import test from 'node:test';
import assert from 'node:assert/strict';
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
  onUpdate: () => () => {}
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

    const tradesResponse = await requestJson(port, '/trades');
    assert.equal(tradesResponse.status, 200);
    assert.equal(tradesResponse.json.length, 50);

    const portfolioResponse = await requestJson(port, '/portfolio');
    assert.equal(portfolioResponse.status, 200);
    assert.deepEqual(portfolioResponse.json.metrics, { pnl: 1 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
