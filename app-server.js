import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { API_DOCS } from './api-docs.js';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

const getCorsOrigin = () => process.env.CORS_ALLOWED_ORIGIN || '*';

const applyCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', getCorsOrigin());
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
};

const createJsonResponse = (res, payload) => {
  applyCorsHeaders(res);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const parseJsonBody = async (req) => {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  if (!body.trim()) return {};

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};


const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const createErrorResponse = (res, statusCode, message, details = null) => {
  applyCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: message, ...(details ? { details } : {}) }));
};

const normalizeTradeRows = async ({ engine, redisStore, resultsPath }) => {
  const redisTrades = await redisStore?.readTrades?.(500);
  if (redisTrades?.length) return redisTrades;

  const results = await readResultsPayload({ resultsPath, redisStore });
  if (results.trades?.length) return results.trades;

  return engine.getState().portfolio?.trades || [];
};

const readResultsPayload = async ({ resultsPath, redisStore }) => {
  const fallback = {
    timestamp: new Date().toISOString(),
    portfolioValue: 0,
    positions: {},
    trades: [],
    signals: []
  };

  if (redisStore) {
    try {
      const payload = await redisStore.readResultsPayload();
      if (payload) return payload;
    } catch {
      // fallback to JSON payload on any redis error
    }
  }

  try {
    const raw = await readFile(resultsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      timestamp: parsed.timestamp ?? parsed.updatedAt ?? fallback.timestamp,
      portfolioValue: parsed.portfolioValue ?? parsed.portfolio?.metrics?.portfolioValue ?? 0,
      positions: parsed.positions ?? parsed.portfolio?.positions ?? {},
      trades: parsed.trades ?? parsed.portfolio?.trades ?? [],
      signals: parsed.signals ?? [],
      operationResults: parsed.operationResults ?? parsed.portfolio?.operationResults ?? [],
      cumulativeRevenue: parsed.cumulativeRevenue ?? 0
    };
  } catch {
    return fallback;
  }
};


const filterByDate = (items, date) => {
  if (!date) return items;
  return items.filter((item) => (item.ts || item.timestamp || '').startsWith(date));
};

const summarizeStocks = async ({ engine, results, redisStore }) => {
  const state = engine.getState();
  const symbols = new Set([
    ...Object.keys(state.snapshots || {}),
    ...Object.keys(state.portfolio?.positions || {}),
    ...(results.trades || []).map((trade) => trade.symbol).filter(Boolean)
  ]);
  const tracked = [...symbols];

  const details = await Promise.all(tracked.map(async (symbol) => {
    let company = null;
    try {
      company = await engine.buildCompanyCard(symbol);
    } catch {
      company = null;
    }

    const trades = (results.trades || []).filter((trade) => trade.symbol === symbol);
    const position = state.portfolio?.positions?.[symbol] || null;

    return {
      symbol,
      name: company?.name || symbol,
      sector: company?.sector || 'Unknown',
      currentPrice: company?.price ?? state.snapshots?.[symbol]?.price ?? null,
      description: company?.explanation?.summary || 'Tracked by the engine for trading decisions.',
      totalTrades: trades.length,
      position
    };
  }));

  const events = await redisStore?.readEvents?.(100);

  return {
    trackedSymbols: tracked,
    count: tracked.length,
    details,
    recentEvents: events || []
  };
};

const getSafeAssetPath = (publicPath, requestPath) => {
  const normalizedPath = normalize(requestPath).replace(/^([.]{2}[\\/])+/, '');
  return join(publicPath, normalizedPath);
};

const toWebSocketFrame = (payload) => {
  const data = Buffer.from(payload);
  const length = data.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), data]);
  }

  if (length < 65536) {
    const header = Buffer.from([0x81, 126, (length >> 8) & 255, length & 255]);
    return Buffer.concat([header, data]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, data]);
};

export const createServer = ({ engine, publicDir, redisStore = null }) => {
  const sseClients = new Set();
  const wsClients = new Set();
  const resultsPath = engine.config?.outputPath ?? './results.json';
  const startedAt = new Date();
  const serveStaticUi = process.env.SERVE_STATIC_UI !== 'false';

  const sendWsEvent = (channel, data) => {
    const frame = toWebSocketFrame(JSON.stringify({ channel, data }));
    for (const socket of wsClients) {
      if (!socket.destroyed) socket.write(frame);
    }
  };

  engine.onUpdate((state) => {
    const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
    for (const client of sseClients) {
      client.write(payload);
    }
    sendWsEvent('state', state);
  });
  engine.onEvent?.((event) => {
    const payload = `event: process\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
      client.write(payload);
    }
    sendWsEvent('process', event);
  });

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      applyCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname.length > 1 && url.pathname.endsWith('/')
      ? url.pathname.slice(0, -1)
      : url.pathname;

    if (pathname === '/events') {
      applyCorsHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write(`event: state\ndata: ${JSON.stringify(engine.getState())}\n\n`);
      res.write(`event: process\ndata: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString(), message: 'Event stream connected' })}\n\n`);
      sseClients.add(res);
      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    if ((pathname === '/api/process/start' || pathname === '/process/start') && (req.method === 'POST' || req.method === 'GET')) {
      const payload = req.method === 'POST' ? await parseJsonBody(req) : {};
      const triggerReason = typeof payload.reason === 'string' ? payload.reason : 'MANUAL';
      void engine.tick?.(triggerReason);
      createJsonResponse(res, {
        ok: true,
        status: 'started',
        triggerReason,
        acceptedAt: new Date().toISOString(),
        message: 'Process trigger accepted.'
      });
      return;
    }

    if (pathname === '/api/health' || pathname === '/health' || pathname === '/healthz') {
      const state = engine.getState();
      createJsonResponse(res, {
        status: 'ok',
        container: 'running',
        uptimeSeconds: Math.round(process.uptime()),
        startedAt: startedAt.toISOString(),
        now: new Date().toISOString(),
        checks: {
          engineStateAvailable: Boolean(state),
          portfolioAvailable: Boolean(state?.portfolio)
        }
      });
      return;
    }

    if (pathname === '/api/docs') {
      createJsonResponse(res, API_DOCS);
      return;
    }

    if (pathname === '/api/bootstrap') {
      const [results, decisions, events, trades] = await Promise.all([
        readResultsPayload({ resultsPath, redisStore }),
        redisStore?.readDecisions?.(200) ?? [],
        redisStore?.readEvents?.(200) ?? [],
        normalizeTradeRows({ engine, redisStore, resultsPath })
      ]);
      createJsonResponse(res, {
        state: engine.getState(),
        results,
        decisions,
        events,
        trades
      });
      return;
    }

    if (pathname === '/api/state' || pathname === '/state') {
      createJsonResponse(res, engine.getState());
      return;
    }

    if (pathname === '/api/results') {
      createJsonResponse(res, await readResultsPayload({ resultsPath, redisStore }));
      return;
    }

    if (pathname === '/trades' || pathname === '/api/trades') {
      const date = url.searchParams.get('date') || '';
      if (date && !isIsoDate(date)) {
        createErrorResponse(res, 400, 'Invalid date format. Use YYYY-MM-DD.');
        return;
      }

      const rows = await normalizeTradeRows({ engine, redisStore, resultsPath });
      const trades = filterByDate(rows, date).slice(-200);
      createJsonResponse(res, trades);
      return;
    }

    if (pathname === '/portfolio' || pathname === '/api/portfolio') {
      const results = await readResultsPayload({ resultsPath, redisStore });
      createJsonResponse(res, {
        portfolioValue: results.portfolioValue,
        positions: results.positions,
        trades: results.trades.slice(-50)
      });
      return;
    }

    if (pathname === '/api/signals' || pathname === '/signals') {
      const results = await readResultsPayload({ resultsPath, redisStore });
      createJsonResponse(res, results.signals);
      return;
    }

    if (pathname === '/api/decisions') {
      const redisDecisions = await redisStore?.readDecisions(200);
      createJsonResponse(res, redisDecisions || []);
      return;
    }

    if (pathname.startsWith('/api/decisions/')) {
      const idToken = pathname.split('/').at(-1);
      const fallback = (await redisStore?.readDecisions(200))?.find((item) => item.id === idToken) || null;
      createJsonResponse(res, fallback || { error: 'Decision not found' });
      return;
    }

    if (pathname === '/api/risk-events' || pathname === '/risk-events') {
      createJsonResponse(res, []);
      return;
    }

    try {
      if (pathname === '/api/stocks' || pathname === '/stocks') {
        const results = await readResultsPayload({ resultsPath, redisStore });
        createJsonResponse(res, await summarizeStocks({ engine, results, redisStore }));
        return;
      }

      if (pathname.startsWith('/api/stocks/') || pathname.startsWith('/stocks/')) {
        const symbol = pathname.split('/').pop()?.toUpperCase();
        if (!symbol) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Missing symbol.' }));
          return;
        }

        const results = await readResultsPayload({ resultsPath, redisStore });
        const stockSummary = await summarizeStocks({ engine, results, redisStore });
        let detail = stockSummary.details.find((item) => item.symbol === symbol);
        if (!detail) {
          try {
            const company = await engine.buildCompanyCard(symbol);
            detail = {
              symbol,
              name: company.name,
              sector: company.sector,
              currentPrice: company.price,
              description: company.explanation?.summary || 'Company profile from market data.',
              totalTrades: 0,
              position: null
            };
          } catch {
            createErrorResponse(res, 404, 'Stock not tracked and external lookup failed.');
            return;
          }
        }
        createJsonResponse(res, detail);
        return;
      }

      if (pathname === '/opportunities' || pathname === '/api/opportunities') {
        createJsonResponse(res, await engine.getOpportunities());
        return;
      }

      if (pathname === '/dividends' || pathname === '/api/dividends') {
        createJsonResponse(res, await engine.getDividendsOverview());
        return;
      }

      if (pathname === '/risk' || pathname === '/api/risk') {
        createJsonResponse(res, await engine.getRiskOverview());
        return;
      }

      if (pathname === '/daily-brief' || pathname === '/api/daily-brief') {
        createJsonResponse(res, await engine.getDailyBrief());
        return;
      }

      if (pathname.startsWith('/company/') || pathname.startsWith('/api/company/')) {
        const ticker = pathname.split('/').pop()?.toUpperCase();
        if (!ticker) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Missing ticker.' }));
          return;
        }
        createJsonResponse(res, await engine.buildCompanyCard(ticker));
        return;
      }

      if (pathname.startsWith('/analysis/') || pathname.startsWith('/api/analysis/')) {
        const ticker = pathname.split('/').pop()?.toUpperCase();
        if (!ticker) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Missing ticker.' }));
          return;
        }
        const card = await engine.buildCompanyCard(ticker);
        createJsonResponse(res, {
          ticker,
          fundamentalScore: card.fundamental.fundamentalScore,
          valueScore: card.valueScore,
          riskScore: card.riskScore,
          beginner: card.beginner,
          explanation: card.explanation
        });
        return;
      }
    } catch (error) {
      createErrorResponse(res, 500, error instanceof Error ? error.message : String(error));
      return;
    }

    if (!serveStaticUi && (pathname === '/' || pathname === '/index.html')) {
      createJsonResponse(res, {
        service: 'backend-api',
        status: 'ok',
        message: 'Backend is running. Use frontend URL for UI and /api/* for API endpoints.'
      });
      return;
    }

    const requestPath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = getSafeAssetPath(publicDir.pathname, requestPath);
    const ext = extname(filePath);

    try {
      const data = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });

  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key || Array.isArray(key)) {
      socket.destroy();
      return;
    }

    const accept = createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    wsClients.add(socket);
    socket.on('close', () => wsClients.delete(socket));
    socket.on('end', () => wsClients.delete(socket));
    socket.on('error', () => wsClients.delete(socket));

    socket.write(toWebSocketFrame(JSON.stringify({ channel: 'state', data: engine.getState() })));
    socket.write(toWebSocketFrame(JSON.stringify({
      channel: 'process',
      data: { type: 'heartbeat', timestamp: new Date().toISOString(), message: 'WebSocket connected' }
    })));
  });

  return server;
};
