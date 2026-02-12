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
if (process.env.LLM_PROVIDER) {
  config.llm.provider = process.env.LLM_PROVIDER;
}
if (process.env.OLLAMA_URL) {
  config.llm.url = process.env.OLLAMA_URL;
}
if (process.env.POLL_INTERVAL_SECONDS) {
  config.pollIntervalSeconds = Number(process.env.POLL_INTERVAL_SECONDS);
}

const engine = new TradingEngine(config);
await engine.start();

const sseClients = new Set();
engine.onUpdate((state) => {
  const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`event: state\ndata: ${JSON.stringify(engine.getState())}\n\n`);
    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(engine.getState()));
    return;
  }

  if (url.pathname === '/trades') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(engine.getState().portfolio.trades.slice(-50)));
    return;
  }

  if (url.pathname === '/portfolio') {
    const state = engine.getState();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        cash: state.portfolio.cash,
        positions: state.portfolio.positions,
        metrics: state.portfolio.metrics
      })
    );
    return;
  }

  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(publicDir.pathname, requestPath);
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

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
