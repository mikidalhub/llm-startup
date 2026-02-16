import { TradingEngine, loadConfig } from './trading-engine.js';
import { createServer } from './app-server.js';

const PORT = process.env.PORT || 3000;
const publicDir = new URL('./public/', import.meta.url);

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

const server = createServer({ engine, publicDir });

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

const shutdown = () => {
  engine.stop();
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
