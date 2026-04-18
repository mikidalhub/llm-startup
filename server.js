import { TradingEngine, loadConfig } from './trading-engine.js';
import { createServer } from './app-server.js';
import { TradingDatabase } from './db.js';
import { RedisStore } from './redis-store.js';

const PORT = Number(process.env.PORT || 8080);
const publicDir = new URL('./public/', import.meta.url);

const config = await loadConfig(process.env.CONFIG_PATH || 'config.yaml');
if (process.env.LLM_PROVIDER) config.llm.provider = process.env.LLM_PROVIDER;
if (process.env.OLLAMA_URL) config.llm.url = process.env.OLLAMA_URL;
if (process.env.POLL_INTERVAL_SECONDS) config.pollIntervalSeconds = Number(process.env.POLL_INTERVAL_SECONDS);

let database = null;
try {
  database = new TradingDatabase({ path: process.env.SQLITE_PATH || './data/trading.sqlite' });
  await database.init();
} catch (error) {
  console.warn(`SQLite unavailable, continuing with JSON-only persistence: ${error instanceof Error ? error.message : String(error)}`);
}

let redisStore = null;
if (process.env.REDIS_URL) {
  try {
    redisStore = new RedisStore({ url: process.env.REDIS_URL, namespace: process.env.REDIS_NAMESPACE || 'trading' });
    await redisStore.init();
  } catch (error) {
    console.warn(`Redis unavailable, continuing without cache persistence: ${error instanceof Error ? error.message : String(error)}`);
    redisStore = null;
  }
}

const engine = new TradingEngine(config, { database, redisStore });
await engine.start();

const server = createServer({ engine, publicDir, redisStore });

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

const shutdown = () => {
  engine.stop();
  void redisStore?.close();
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
