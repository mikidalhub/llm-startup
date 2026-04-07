import { readFile, writeFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { YahooClient } from './data/yahoo-client.js';
import { buildFundamentalAnalysis } from './fundamentals/engine.js';
import { buildValueModel } from './analysis/value-model.js';
import { buildRiskAnalysis } from './risk/engine.js';
import { buildDividendAnalysis } from './dividends/analyzer.js';
import { buildPortfolioBrain } from './portfolio/brain.js';
import { DEFAULT_UNIVERSE, rankOpportunities } from './scanner/market-scanner.js';
import { buildBeginnerView, buildExplanation } from './explainer/investment-explainer.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const calculateRSI = (closes, period = 14) => {
  if (closes.length <= period) return 50;

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
  if (snapshot.rsi < 35) return { action: 'BUY', size_pct: 0.07, reason: 'RSI indicates oversold conditions.' };
  if (snapshot.rsi > 70) return { action: 'SELL', size_pct: 0.07, reason: 'RSI indicates overbought conditions.' };
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
    outputPath: parsed.outputPath ?? './results.json',
    scannerUniverse: parsed.scannerUniverse ?? DEFAULT_UNIVERSE,
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
    this.quoteCache = new Map();
    this.lastError = null;
    this.timer = null;
    this.listeners = new Set();
    this.yahoo = new YahooClient();
  }

  onUpdate(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) listener(this.getState());
  }

  async fetchSymbolSnapshot(symbol) {
    const chart = await this.yahoo.getChart(symbol, { range: '1d', interval: '5m' });
    if (chart.closes.length < this.config.rsiPeriod + 1) throw new Error(`Not enough price history for ${symbol}`);

    return {
      symbol,
      price: chart.closes.at(-1),
      volume: chart.volumes.at(-1) ?? 0,
      rsi: calculateRSI(chart.closes.slice(-(this.config.rsiPeriod + 25)), this.config.rsiPeriod),
      ts: new Date().toISOString()
    };
  }

  buildSyntheticSnapshot(symbol) {
    const lastPrice = this.snapshots[symbol]?.price ?? 100;
    const drift = 1 + (Math.random() - 0.5) * 0.01;
    const price = Number((lastPrice * drift).toFixed(2));
    return { symbol, price, volume: this.snapshots[symbol]?.volume ?? 0, rsi: this.snapshots[symbol]?.rsi ?? 50, ts: new Date().toISOString(), source: 'synthetic-fallback' };
  }

  async llmDecide(snapshot) {
    const portfolioValue = this.getPortfolioValue();
    const prompt = `Given price: ${snapshot.price}, volume: ${snapshot.volume}, RSI: ${snapshot.rsi}, portfolioValue: ${portfolioValue}. Decide BUY/SELL/HOLD with size (0-${this.config.maxPositionPct * 100}% portfolio) and reason. Output strict JSON with keys action, size_pct, reason.`;

    if (this.config.llm.provider !== 'ollama') return buildFallbackDecision(snapshot);

    try {
      const response = await fetch(this.config.llm.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.config.llm.model, stream: false, messages: [{ role: 'user', content: prompt }] })
      });
      if (!response.ok) throw new Error(`Ollama request failed (${response.status})`);
      const payload = await response.json();
      const decision = parseJsonBlock(payload.message?.content);
      if (!decision?.action) return buildFallbackDecision(snapshot);
      return decision;
    } catch {
      return buildFallbackDecision(snapshot);
    }
  }

  executeTrade(symbol, snapshot, decision) {
    const action = String(decision.action || 'HOLD').toUpperCase();
    const sizePct = clamp(Number(decision.size_pct || 0), 0, this.config.maxPositionPct);
    const notional = this.getPortfolioValue() * sizePct;
    let status = 'SKIPPED';
    let shares = 0;

    this.portfolio.positions[symbol] = this.portfolio.positions[symbol] || { shares: 0, avgCost: 0 };
    const position = this.portfolio.positions[symbol];

    if (action === 'BUY' && notional > 0) {
      const spend = Math.min(notional, this.portfolio.cash);
      if (spend > 0) {
        shares = spend / snapshot.price;
        const currentCost = position.avgCost * position.shares;
        position.shares += shares;
        position.avgCost = (currentCost + spend) / position.shares;
        this.portfolio.cash -= spend;
        status = 'FILLED';
      }
    } else if (action === 'SELL' && notional > 0) {
      const targetShares = notional / snapshot.price;
      shares = Math.min(position.shares, targetShares);
      if (shares > 0) {
        position.shares -= shares;
        this.portfolio.cash += shares * snapshot.price;
        status = 'FILLED';
      }
    }

    const trade = { ts: new Date().toISOString(), symbol, action, status, sizePct, shares: Number(shares.toFixed(6)), price: snapshot.price, reason: decision.reason || 'No reason supplied' };
    this.portfolio.trades.push(trade);
    if (this.portfolio.trades.length > 300) this.portfolio.trades = this.portfolio.trades.slice(-300);
  }

  getPortfolioValue() {
    const positionValue = Object.entries(this.portfolio.positions).reduce((total, [symbol, position]) => {
      const mark = this.snapshots[symbol]?.price ?? position.avgCost;
      return total + position.shares * mark;
    }, 0);
    return Number((this.portfolio.cash + positionValue).toFixed(2));
  }

  buildPortfolioWeights() {
    const total = this.getPortfolioValue() || 1;
    const holdings = Object.entries(this.portfolio.positions)
      .map(([symbol, position]) => {
        const price = this.snapshots[symbol]?.price ?? position.avgCost;
        const value = price * position.shares;
        return { symbol, value, weight: value / total };
      })
      .filter((holding) => holding.value > 0)
      .sort((a, b) => b.value - a.value);
    return { total, holdings };
  }

  async getQuoteData(symbol) {
    const cached = this.quoteCache.get(symbol);
    const freshWindowMs = 1000 * 60 * 30;
    if (cached && Date.now() - cached.fetchedAt < freshWindowMs) return cached.data;
    const data = await this.yahoo.getQuoteSummary(symbol);
    this.quoteCache.set(symbol, { fetchedAt: Date.now(), data });
    return data;
  }

  async buildCompanyCard(symbol) {
    const quote = await this.getQuoteData(symbol);
    const chart = await this.yahoo.getChart(symbol, { range: '1y', interval: '1d' });
    const bench = await this.yahoo.getChart('^GSPC', { range: '1y', interval: '1d' });
    const { total, holdings } = this.buildPortfolioWeights();
    const position = holdings.find((item) => item.symbol === symbol);
    const positionWeight = position?.weight ?? 0;

    const fundamental = buildFundamentalAnalysis(quote);
    const value = buildValueModel(fundamental, quote);
    const sectorWeights = { [quote.sector]: positionWeight };
    const risk = buildRiskAnalysis({
      priceHistory: chart.closes,
      benchmarkHistory: bench.closes,
      portfolioWeights: Object.fromEntries(holdings.map((h) => [h.symbol, h.weight])),
      sectorWeights,
      betaHint: quote.beta
    });
    const dividends = buildDividendAnalysis({
      symbol,
      dividendYield: quote.dividendYield,
      payoutRatio: quote.payoutRatio,
      portfolioValue: total,
      positionWeight
    });
    const beginner = buildBeginnerView({
      valueScore: value.valueScore,
      qualityScore: fundamental.buckets.qualityScore,
      riskNumber: risk.riskNumber,
      dividendScore: dividends.dividendScore
    });
    const explanation = buildExplanation({
      companyName: quote.name,
      valueScore: value.valueScore,
      qualityScore: fundamental.buckets.qualityScore,
      riskScore: risk.riskScore,
      dividendScore: dividends.dividendScore,
      pillars: value.pillars
    });

    return {
      symbol,
      name: quote.name,
      sector: quote.sector,
      price: quote.currentPrice,
      valueScore: value.valueScore,
      qualityScore: fundamental.buckets.qualityScore,
      riskScore: risk.riskScore,
      riskNumber: risk.riskNumber,
      dividendScore: dividends.dividendScore,
      beginner,
      explanation,
      fundamental,
      value,
      risk,
      dividends
    };
  }

  async getOpportunities() {
    const universe = Object.values(this.config.scannerUniverse).flat();
    const unique = [...new Set(universe)].slice(0, 30);
    const cards = [];
    for (const symbol of unique) {
      try {
        cards.push(await this.buildCompanyCard(symbol));
      } catch {
        // continue scanning
      }
    }
    return rankOpportunities(cards, 12);
  }

  async getRiskOverview() {
    const { holdings } = this.buildPortfolioWeights();
    const sectors = {};
    for (const holding of holdings) {
      try {
        const quote = await this.getQuoteData(holding.symbol);
        sectors[quote.sector] = (sectors[quote.sector] || 0) + holding.weight;
      } catch {
        sectors.Unknown = (sectors.Unknown || 0) + holding.weight;
      }
    }

    const bench = await this.yahoo.getChart('^GSPC', { range: '1y', interval: '1d' });
    const pseudoPortfolioHistory = this.portfolio.equityCurve.map((point) => point.value);
    return buildRiskAnalysis({
      priceHistory: pseudoPortfolioHistory,
      benchmarkHistory: bench.closes,
      portfolioWeights: Object.fromEntries(holdings.map((h) => [h.symbol, h.weight])),
      sectorWeights: sectors,
      betaHint: 1
    });
  }

  async getDividendsOverview() {
    const { total, holdings } = this.buildPortfolioWeights();
    const items = [];
    for (const holding of holdings) {
      try {
        const quote = await this.getQuoteData(holding.symbol);
        items.push(buildDividendAnalysis({
          symbol: holding.symbol,
          dividendYield: quote.dividendYield,
          payoutRatio: quote.payoutRatio,
          portfolioValue: total,
          positionWeight: holding.weight
        }));
      } catch {
        // ignore symbol
      }
    }

    const annual = items.reduce((sum, item) => sum + item.incomeProjection.annual, 0);
    return {
      totalProjectedIncome: {
        monthly: Number((annual / 12).toFixed(2)),
        annual: Number(annual.toFixed(2))
      },
      companies: items
    };
  }

  async getPortfolioBrain() {
    const { total, holdings } = this.buildPortfolioWeights();
    const sectorWeights = {};
    for (const h of holdings) {
      const quote = await this.getQuoteData(h.symbol).catch(() => ({ sector: 'Unknown' }));
      sectorWeights[quote.sector] = (sectorWeights[quote.sector] || 0) + h.weight;
    }
    return buildPortfolioBrain({ holdings, sectorWeights, totalValue: total });
  }

  async getDailyBrief() {
    const [opportunities, risk, dividends, portfolioBrain] = await Promise.all([
      this.getOpportunities(),
      this.getRiskOverview(),
      this.getDividendsOverview(),
      this.getPortfolioBrain()
    ]);

    return {
      generatedAt: new Date().toISOString(),
      marketOverview: `Long-term opportunity scan found ${opportunities.length} quality candidates across core US sectors.`,
      topOpportunities: opportunities.slice(0, 3).map((item) => ({ symbol: item.symbol, investmentScore: item.investmentScore, reason: item.explanation.summary })),
      portfolioWarnings: portfolioBrain.warnings,
      dividendIncomeUpdate: dividends.totalProjectedIncome,
      risk
    };
  }

  updateMetrics() {
    const portfolioValue = this.getPortfolioValue();
    this.portfolio.equityCurve.push({ ts: new Date().toISOString(), value: portfolioValue });
    if (this.portfolio.equityCurve.length > 500) this.portfolio.equityCurve = this.portfolio.equityCurve.slice(-500);

    const pnl = portfolioValue - this.config.capital;
    const returnPct = (pnl / this.config.capital) * 100;
    const values = this.portfolio.equityCurve.map((point) => point.value);
    const returns = values.slice(1).map((value, idx) => (value - values[idx]) / values[idx]).filter(Number.isFinite);
    const mean = returns.length ? returns.reduce((acc, cur) => acc + cur, 0) / returns.length : 0;
    const variance = returns.length ? returns.reduce((acc, cur) => acc + (cur - mean) ** 2, 0) / returns.length : 0;
    const std = Math.sqrt(variance);
    const sharpe = std > 0 ? (mean / std) * Math.sqrt(returns.length) : 0;

    this.portfolio.metrics = {
      pnl: Number(pnl.toFixed(2)),
      returnPct: Number(returnPct.toFixed(2)),
      winRate: 0,
      sharpe: Number(sharpe.toFixed(2)),
      portfolioValue
    };
  }

  async persistResults() {
    await writeFile(this.config.outputPath, JSON.stringify({ updatedAt: new Date().toISOString(), config: this.config, snapshots: this.snapshots, portfolio: this.portfolio, lastError: this.lastError }, null, 2));
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
    return { timestamp: new Date().toISOString(), config: this.config, snapshots: this.snapshots, portfolio: this.portfolio, lastError: this.lastError };
  }
}

export { calculateRSI };
