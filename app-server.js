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

const getSafeAssetPath = (publicPath, requestPath) => {
  const normalizedPath = normalize(requestPath).replace(/^([.]{2}[\\/])+/, '');
  return join(publicPath, normalizedPath);
};

export const createServer = ({ engine, publicDir }) => {
  const sseClients = new Set();

  engine.onUpdate((state) => {
    const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
    for (const client of sseClients) {
      client.write(payload);
    }
  });

  return http.createServer(async (req, res) => {
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
      createJsonResponse(res, engine.getState());
      return;
    }

    if (url.pathname === '/trades') {
      createJsonResponse(res, engine.getState().portfolio.trades.slice(-50));
      return;
    }

    if (url.pathname === '/portfolio') {
      const state = engine.getState();
      createJsonResponse(res, {
        cash: state.portfolio.cash,
        positions: state.portfolio.positions,
        metrics: state.portfolio.metrics
      });
      return;
    }

    const requestPath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
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
