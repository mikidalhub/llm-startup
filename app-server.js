import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

const createJsonResponse = (res, payload) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const readResultsPayload = async (resultsPath) => {
  const fallback = {
    timestamp: new Date().toISOString(),
    portfolioValue: 0,
    positions: {},
    trades: [],
    signals: []
  };

  try {
    const raw = await readFile(resultsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      timestamp: parsed.timestamp ?? parsed.updatedAt ?? fallback.timestamp,
      portfolioValue: parsed.portfolioValue ?? parsed.portfolio?.metrics?.portfolioValue ?? 0,
      positions: parsed.positions ?? parsed.portfolio?.positions ?? {},
      trades: parsed.trades ?? parsed.portfolio?.trades ?? [],
      signals: parsed.signals ?? []
    };
  } catch {
    return fallback;
  }
};

const getSafeAssetPath = (publicPath, requestPath) => {
  const normalizedPath = normalize(requestPath).replace(/^([.]{2}[\\/])+/, '');
  return join(publicPath, normalizedPath);
};

export const createServer = ({ engine, publicDir }) => {
  const sseClients = new Set();
  const resultsPath = engine.config?.outputPath ?? './results.json';

  engine.onUpdate((state) => {
    const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
    for (const client of sseClients) {
      client.write(payload);
    }
  });
  engine.onEvent?.((event) => {
    const payload = `event: process\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
      client.write(payload);
    }
  });

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname.length > 1 && url.pathname.endsWith('/')
      ? url.pathname.slice(0, -1)
      : url.pathname;

    if (pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(`event: state\ndata: ${JSON.stringify(engine.getState())}\n\n`);
      res.write(`event: process\ndata: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString(), message: 'Event stream connected' })}\n\n`);
      sseClients.add(res);
      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    if (pathname === '/api/process/start' && req.method === 'POST') {
      void engine.tick?.('MANUAL');
      createJsonResponse(res, { ok: true, startedAt: new Date().toISOString() });
      return;
    }

    if (pathname === '/api/state' || pathname === '/state') {
      createJsonResponse(res, engine.getState());
      return;
    }

    if (pathname === '/api/results') {
      createJsonResponse(res, await readResultsPayload(resultsPath));
      return;
    }

    if (pathname === '/trades' || pathname === '/api/trades') {
      createJsonResponse(res, engine.getState().portfolio.trades.slice(-50));
      return;
    }

    if (pathname === '/portfolio' || pathname === '/api/portfolio') {
      const results = await readResultsPayload(resultsPath);
      createJsonResponse(res, {
        portfolioValue: results.portfolioValue,
        positions: results.positions,
        trades: results.trades.slice(-50)
      });
      return;
    }

    if (pathname === '/api/signals' || pathname === '/signals') {
      const results = await readResultsPayload(resultsPath);
      createJsonResponse(res, results.signals);
      return;
    }

    try {
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
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
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
};
