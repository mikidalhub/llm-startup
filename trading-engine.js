import { readFile, writeFile } from 'node:fs/promises';
import yaml from 'js-yaml';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const calculateRSI = (closes, period = 14) => {
  if (closes.length <= period) {
    return 50;
  }

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
};

const parseJsonBlock = (rawText) => {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const buildFallbackDecision = (snapshot) => {
  if (snapshot.rsi < 35) {
    return { action: 'BUY', size_pct: 0.07, reason: 'RSI indicates oversold conditions.' };
  }
  if (snapshot.rsi > 70) {
    return { action: 'SELL', size_pct: 0.07, reason: 'RSI indicates overbought conditions.' };
  }
  return { action: 'HOLD', size_pct: 0, reason: 'Momentum is neutral.' };
};

export const loadConfig = async (configPath = 'config.yaml') => {
  const file = await readFile(configPath, 'utf-8');
  const parsed = yaml.load(file);
  return {
    symbols: parsed.symbols ?? ['AAPL'],
    pollIntervalSeconds: Number(parsed.pollIntervalSeconds ?? 60),
    capital: Number(parsed.capital ?? 10000),
    maxPositionPct: Number(parsed.maxPositionPct ?? 0.1),
    rsiPeriod: Number(parsed.rsiPeriod ?? 14),
    historyPoints: Number(parsed.historyPoints ?? 80),
    outputPath: parsed.outputPath ?? './results.json',
    llm: {
      provider: parsed.llm?.provider ?? 'mock',
      model: parsed.llm?.model ?? 'llama3.1:8b',
      url: parsed.llm?.url ?? 'http://localhost:11434/api/chat'
    }
  };
};

export class TradingEngine {
  constructor(config) {
    this.config = config;
    this.portfolio = {
      cash: config.capital,
      positions: {},
      trades: [],
      equityCurve: [{ ts: new Date().toISOString(), value: config.capital }],
      metrics: { pnl: 0, returnPct: 0, winRate: 0, sharpe: 0 }
    };
    this.snapshots = {};
    this.lastError = null;
    this.timer = null;
    this.listeners = new Set();
  }

  onUpdate(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  async fetchSymbolSnapshot(symbol) {
    const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Yahoo request failed for ${symbol}: ${response.status}`);
    }

    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const closes = (quote?.close || []).map(Number).filter(Number.isFinite);
    const volumes = (quote?.volume || []).map(Number).filter(Number.isFinite);

    if (closes.length < this.config.rsiPeriod + 1) {
      throw new Error(`Not enough price history for ${symbol}`);
    }

    return {
      symbol,
      price: closes.at(-1),
      volume: volumes.at(-1) ?? 0,
      rsi: calculateRSI(closes.slice(-(this.config.rsiPeriod + 25)), this.config.rsiPeriod),
      ts: new Date().toISOString()
    };
  }


  buildSyntheticSnapshot(symbol) {
    const lastPrice = this.snapshots[symbol]?.price ?? 100;
    const drift = 1 + (Math.random() - 0.5) * 0.01;
    const price = Number((lastPrice * drift).toFixed(2));
    return {
      symbol,
      price,
      volume: this.snapshots[symbol]?.volume ?? 0,
      rsi: this.snapshots[symbol]?.rsi ?? 50,
      ts: new Date().toISOString(),
      source: 'synthetic-fallback'
    };
  }

  async llmDecide(snapshot) {
    const portfolioValue = this.getPortfolioValue();
    const prompt = `Given price: ${snapshot.price}, volume: ${snapshot.volume}, RSI: ${snapshot.rsi}, portfolioValue: ${portfolioValue}. Decide BUY/SELL/HOLD with size (0-${this.config.maxPositionPct * 100}% portfolio) and reason. Output strict JSON with keys action, size_pct, reason.`;

    if (this.config.llm.provider !== 'ollama') {
      return buildFallbackDecision(snapshot);
    }

    try {
      const response = await fetch(this.config.llm.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.llm.model,
          stream: false,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed (${response.status})`);
      }

      const payload = await response.json();
      const decision = parseJsonBlock(payload.message?.content);
      if (!decision?.action) {
        return buildFallbackDecision(snapshot);
      }
      return decision;
    } catch {
      return buildFallbackDecision(snapshot);
    }
  }

  executeTrade(symbol, snapshot, decision) {
    const action = String(decision.action || 'HOLD').toUpperCase();
    const sizePct = clamp(Number(decision.size_pct || 0), 0, this.config.maxPositionPct);
    const price = snapshot.price;
    const notional = this.getPortfolioValue() * sizePct;
    let status = 'SKIPPED';
    let shares = 0;

    this.portfolio.positions[symbol] = this.portfolio.positions[symbol] || { shares: 0, avgCost: 0 };
    const position = this.portfolio.positions[symbol];

    if (action === 'BUY' && notional > 0) {
      const spend = Math.min(notional, this.portfolio.cash);
      if (spend > 0) {
        shares = spend / price;
        const currentCost = position.avgCost * position.shares;
        position.shares += shares;
        position.avgCost = (currentCost + spend) / position.shares;
        this.portfolio.cash -= spend;
        status = 'FILLED';
      }
    } else if (action === 'SELL' && notional > 0) {
      const targetShares = notional / price;
      shares = Math.min(position.shares, targetShares);
      if (shares > 0) {
        position.shares -= shares;
        this.portfolio.cash += shares * price;
        status = 'FILLED';
      }
    }

    const trade = {
      ts: new Date().toISOString(),
      symbol,
      action,
      status,
      sizePct,
      shares: Number(shares.toFixed(6)),
      price,
      reason: decision.reason || 'No reason supplied'
    };

    this.portfolio.trades.push(trade);
    if (this.portfolio.trades.length > 300) {
      this.portfolio.trades = this.portfolio.trades.slice(-300);
    }
  }

  getPortfolioValue() {
    const positionValue = Object.entries(this.portfolio.positions).reduce((total, [symbol, position]) => {
      const mark = this.snapshots[symbol]?.price ?? position.avgCost;
      return total + position.shares * mark;
    }, 0);
    return Number((this.portfolio.cash + positionValue).toFixed(2));
  }

  updateMetrics() {
    const portfolioValue = this.getPortfolioValue();
    this.portfolio.equityCurve.push({ ts: new Date().toISOString(), value: portfolioValue });
    if (this.portfolio.equityCurve.length > 500) {
      this.portfolio.equityCurve = this.portfolio.equityCurve.slice(-500);
    }

    const pnl = portfolioValue - this.config.capital;
    const returnPct = (pnl / this.config.capital) * 100;

    const filledSells = this.portfolio.trades.filter((trade) => trade.action === 'SELL' && trade.status === 'FILLED');
    const wins = filledSells.filter((trade) => {
      const avgCost = this.portfolio.positions[trade.symbol]?.avgCost ?? trade.price;
      return trade.price > avgCost;
    }).length;
    const winRate = filledSells.length ? (wins / filledSells.length) * 100 : 0;

    const values = this.portfolio.equityCurve.map((point) => point.value);
    const returns = values.slice(1).map((value, idx) => (value - values[idx]) / values[idx]).filter(Number.isFinite);
    const mean = returns.length ? returns.reduce((acc, cur) => acc + cur, 0) / returns.length : 0;
    const variance = returns.length
      ? returns.reduce((acc, cur) => acc + (cur - mean) ** 2, 0) / returns.length
      : 0;
    const std = Math.sqrt(variance);
    const sharpe = std > 0 ? (mean / std) * Math.sqrt(returns.length) : 0;

    this.portfolio.metrics = {
      pnl: Number(pnl.toFixed(2)),
      returnPct: Number(returnPct.toFixed(2)),
      winRate: Number(winRate.toFixed(2)),
      sharpe: Number(sharpe.toFixed(2)),
      portfolioValue
    };
  }

  async persistResults() {
    const output = {
      updatedAt: new Date().toISOString(),
      config: this.config,
      snapshots: this.snapshots,
      portfolio: this.portfolio,
      lastError: this.lastError
    };
    await writeFile(this.config.outputPath, JSON.stringify(output, null, 2));
  }

  async tick() {
    const errors = [];

    for (const symbol of this.config.symbols) {
      let snapshot;
      try {
        snapshot = await this.fetchSymbolSnapshot(symbol);
      } catch (error) {
        snapshot = this.buildSyntheticSnapshot(symbol);
        errors.push(`${symbol}: ${error instanceof Error ? error.message : String(error)}`);
      }

      this.snapshots[symbol] = snapshot;
      const decision = await this.llmDecide(snapshot);
      this.executeTrade(symbol, snapshot, decision);
    }

    this.lastError = errors.length ? errors.join(' | ') : null;
    this.updateMetrics();
    await this.persistResults();
    this.notify();
  }

  async start() {
    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.pollIntervalSeconds * 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  getState() {
    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      snapshots: this.snapshots,
      portfolio: this.portfolio,
      lastError: this.lastError
    };
  }
}

export { calculateRSI };
