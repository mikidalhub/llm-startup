import { TradingEngine, loadConfig } from './trading-engine.js';
import { createServer } from './app-server.js';
import { RedisStore } from './redis-store.js';
import { MlflowManager } from './app/core/mlflow-manager.js';

const PORT = Number(process.env.PORT || 8080);
const publicDir = new URL('./public/', import.meta.url);

const config = await loadConfig(process.env.CONFIG_PATH || 'config.yaml');
if (process.env.LLM_PROVIDER) config.llm.provider = process.env.LLM_PROVIDER;
if (process.env.OLLAMA_URL) config.llm.url = process.env.OLLAMA_URL;
if (process.env.POLL_INTERVAL_SECONDS) config.pollIntervalSeconds = Number(process.env.POLL_INTERVAL_SECONDS);

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

const mlflowManager = new MlflowManager();
await mlflowManager.initialize_mlflow();

const engine = new TradingEngine(config, { redisStore, mlflowManager });
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
