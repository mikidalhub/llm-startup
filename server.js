import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { TradingEngine, loadConfig } from './trading-engine.js';

const PORT = process.env.PORT || 3000;
const publicDir = new URL('./public/', import.meta.url);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const config = await loadConfig(process.env.CONFIG_PATH || 'config.yaml');
if (process.env.LLM_PROVIDER) config.llm.provider = process.env.LLM_PROVIDER;
if (process.env.OLLAMA_URL) config.llm.url = process.env.OLLAMA_URL;
if (process.env.POLL_INTERVAL_SECONDS) config.pollIntervalSeconds = Number(process.env.POLL_INTERVAL_SECONDS);

const engine = new TradingEngine(config);
await engine.start();

const sseClients = new Set();
engine.onUpdate((state) => {
  const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
  for (const client of sseClients) client.write(payload);
});

const respondJson = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(`event: state\ndata: ${JSON.stringify(engine.getState())}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (url.pathname === '/api/state') return respondJson(res, 200, engine.getState());
    if (url.pathname === '/trades') return respondJson(res, 200, engine.getState().portfolio.trades.slice(-50));
    if (url.pathname === '/portfolio') {
      const state = engine.getState();
      return respondJson(res, 200, { cash: state.portfolio.cash, positions: state.portfolio.positions, metrics: state.portfolio.metrics });
    }

    if (url.pathname === '/opportunities') return respondJson(res, 200, await engine.getOpportunities());
    if (url.pathname === '/dividends') return respondJson(res, 200, await engine.getDividendsOverview());
    if (url.pathname === '/risk') return respondJson(res, 200, await engine.getRiskOverview());
    if (url.pathname === '/daily-brief') return respondJson(res, 200, await engine.getDailyBrief());

    if (url.pathname.startsWith('/company/')) {
      const ticker = url.pathname.split('/').pop()?.toUpperCase();
      if (!ticker) return respondJson(res, 400, { error: 'Missing ticker.' });
      return respondJson(res, 200, await engine.buildCompanyCard(ticker));
    }

    if (url.pathname.startsWith('/analysis/')) {
      const ticker = url.pathname.split('/').pop()?.toUpperCase();
      if (!ticker) return respondJson(res, 400, { error: 'Missing ticker.' });
      const card = await engine.buildCompanyCard(ticker);
      return respondJson(res, 200, {
        ticker,
        fundamentalScore: card.fundamental.fundamentalScore,
        valueScore: card.valueScore,
        riskScore: card.risk,
        beginner: card.beginner,
        explanation: card.explanation
      });
    }

    const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = join(publicDir.pathname, requestPath);
    const ext = extname(filePath);
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (error) {
    respondJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
