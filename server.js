import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const PORT = process.env.PORT || 3000;
const publicDir = new URL('./public/', import.meta.url);
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'mock';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const UPDATE_INTERVAL_MS = Number(process.env.UPDATE_INTERVAL_MS || 5000);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

const sseClients = new Set();

const sampleRegions = [
  { region: 'US', index: 'S&P 500' },
  { region: 'EU', index: 'STOXX 600' },
  { region: 'APAC', index: 'MSCI APAC' },
  { region: 'EM', index: 'MSCI EM' }
];

const randomInRange = (min, max) => Number((Math.random() * (max - min) + min).toFixed(2));

const buildMarketSnapshot = () =>
  sampleRegions.map(({ region, index }) => ({
    region,
    index,
    dailyChangePct: randomInRange(-1.2, 1.2),
    momentumScore: randomInRange(-2.5, 2.5),
    volatilityScore: randomInRange(8, 22)
  }));

const buildMacroSignals = () => ({
  inflationTrend: ['Cooling', 'Stable', 'Rising'][Math.floor(Math.random() * 3)],
  ratesOutlook: ['Cutting', 'Neutral', 'Hiking'][Math.floor(Math.random() * 3)],
  growthSignal: ['Soft Landing', 'Reacceleration', 'Slowdown'][Math.floor(Math.random() * 3)]
});

const deriveRiskScore = (markets) => {
  const avgVol = markets.reduce((sum, market) => sum + market.volatilityScore, 0) / markets.length;
  const avgMomentum = markets.reduce((sum, market) => sum + market.momentumScore, 0) / markets.length;
  const score = 100 - avgVol * 2 + avgMomentum * 3;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const buildDecision = (markets, macro) => {
  const riskScore = deriveRiskScore(markets);
  const bias =
    macro.ratesOutlook === 'Cutting' ? 'Risk-On' : macro.ratesOutlook === 'Hiking' ? 'Defensive' : 'Balanced';
  const topRegion = markets.reduce((best, market) =>
    market.momentumScore > best.momentumScore ? market : best
  );
  const allocation = [
    { sleeve: 'Global Equities', targetPct: bias === 'Risk-On' ? 55 : 40 },
    { sleeve: 'Quality Value', targetPct: bias === 'Defensive' ? 30 : 20 },
    { sleeve: 'Cash', targetPct: bias === 'Defensive' ? 20 : 10 },
    { sleeve: 'Hedged', targetPct: bias === 'Balanced' ? 20 : 10 }
  ];

  return {
    bias,
    riskScore,
    preferredRegion: topRegion.region,
    allocation
  };
};

const fallbackSummary = (macro, decision) =>
  `Macro shows ${macro.inflationTrend.toLowerCase()} inflation with a ${macro.ratesOutlook.toLowerCase()} bias. ` +
  `Portfolio stance: ${decision.bias}. Focus region: ${decision.preferredRegion}.`;

const fetchOllamaSummary = async (macro, decision) => {
  const prompt =
    'Summarize the macro signals and portfolio bias in 2 sentences, keep it factual and concise. ' +
    `Macro: ${JSON.stringify(macro)}. Decision: ${JSON.stringify(decision)}.`;
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3', prompt, stream: false })
  });
  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }
  const data = await response.json();
  return data.response?.trim() || fallbackSummary(macro, decision);
};

const buildState = async () => {
  const markets = buildMarketSnapshot();
  const macro = buildMacroSignals();
  const decision = buildDecision(markets, macro);
  let llmSummary = fallbackSummary(macro, decision);
  let llmProvider = LLM_PROVIDER;

  if (LLM_PROVIDER === 'ollama') {
    try {
      llmSummary = await fetchOllamaSummary(macro, decision);
    } catch (error) {
      llmProvider = 'mock-fallback';
      llmSummary = fallbackSummary(macro, decision);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    markets,
    macro,
    decision,
    llm: {
      provider: llmProvider,
      summary: llmSummary
    }
  };
};

let currentState = await buildState();

const broadcastState = () => {
  const payload = `event: state\ndata: ${JSON.stringify(currentState)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
};

const updateLoop = async () => {
  try {
    currentState = await buildState();
    broadcastState();
  } catch (error) {
    console.error('Failed to update state', error);
  }
};

setInterval(() => {
  void updateLoop();
}, UPDATE_INTERVAL_MS);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`event: state\ndata: ${JSON.stringify(currentState)}\n\n`);
    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(currentState));
    return;
  }

  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(publicDir.pathname, requestPath);
  const ext = extname(filePath);

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
