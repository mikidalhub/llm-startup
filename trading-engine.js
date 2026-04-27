import { readFile, writeFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { AlpacaClient } from './data/alpaca-client.js';
import { buildFundamentalAnalysis } from './fundamentals/engine.js';
import { buildValueModel } from './analysis/value-model.js';
import { buildRiskAnalysis } from './risk/engine.js';
import { buildDividendAnalysis } from './dividends/analyzer.js';
import { buildPortfolioBrain } from './portfolio/brain.js';
import { DEFAULT_UNIVERSE, rankOpportunities } from './scanner/market-scanner.js';
import { buildBeginnerView, buildExplanation } from './explainer/investment-explainer.js';
import { runTradingGraph } from './engine/mini-graph-runner.js';
import { createGraphEventEmitter } from './events/graph-event-broadcaster.js';
import { LlmCacheManager } from './engine/llm-cache-manager.js';
import { MlflowObserver } from './app/core/mlflow-observer.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const calculateRSI = (closes, period = 14) => {
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

export const parseJsonBlock = (rawText) => {
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

export const buildFallbackDecision = (snapshot) => {
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
    dailySchedule: {
      hour: Number(parsed.dailySchedule?.hour ?? 9),
      minute: Number(parsed.dailySchedule?.minute ?? 0),
      timezone: parsed.dailySchedule?.timezone ?? process.env.TZ ?? 'UTC',
      enabled: parsed.dailySchedule?.enabled ?? true
    },
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
  constructor(config, dependencies = {}) {
    this.config = config;
    this.fetchFn = dependencies.fetchFn ?? fetch;
    this.writeFileFn = dependencies.writeFileFn ?? writeFile;
    this.clock = dependencies.clock ?? (() => new Date().toISOString());
    this.redisStore = dependencies.redisStore ?? null;

    this.portfolio = {
      cash: config.capital,
      positions: {},
      trades: [],
      equityCurve: [{ ts: this.clock(), value: config.capital }],
      metrics: { pnl: 0, returnPct: 0, winRate: 0, sharpe: 0 },
      operationResults: []
    };
    this.snapshots = {};
    this.quoteCache = new Map();
    this.lastError = null;
    this.timer = null;
    this.dailyTimer = null;
    this.listeners = new Set();
    this.eventListeners = new Set();
    this.isTicking = false;
    this.status = { stage: 'IDLE', message: 'Waiting for next cycle', running: false, lastRunAt: null };
    this.marketData = dependencies.marketData ?? new AlpacaClient({ fetchImpl: this.fetchFn });
    this.llmCache = new LlmCacheManager({ redisStore: this.redisStore });
    this.mlflowObserver = dependencies.mlflowObserver ?? new MlflowObserver({ fetchFn: this.fetchFn });
    this.latestMlflowRunId = null;
    this.latestDecisionIntelligence = null;
    this.latestTeacherExplanation = null;
    this.thesisBySymbol = {};
  }

  onUpdate(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) listener(this.getState());
  }

  onEvent(listener) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  emitEvent(type, payload = {}) {
    const event = { timestamp: new Date().toISOString(), type, ...payload };
    void this.redisStore?.appendEvent?.(event);
    for (const listener of this.eventListeners) listener(event);
  }

  async fetchSymbolSnapshot(symbol) {
    const chart = await this.marketData.getChart(symbol, { range: '1d', interval: '5m' });
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
      const response = await this.fetchFn(this.config.llm.url, {
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

  executeTrade(symbol, snapshot, decision, tradeTimestamp = this.clock()) {
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

    const trade = { ts: tradeTimestamp, symbol, action, status, sizePct, shares: Number(shares.toFixed(6)), price: snapshot.price, reason: decision.reason || 'No reason supplied' };
    this.portfolio.trades.push(trade);
    if (this.portfolio.trades.length > 300) this.portfolio.trades = this.portfolio.trades.slice(-300);
    return trade;
  }

  computeOperationResult(trade, snapshot) {
    const grossValue = Number(((trade.shares || 0) * snapshot.price).toFixed(2));
    const signedValue = Number(((trade.action === 'SELL' ? 1 : trade.action === 'BUY' ? -1 : 0) * grossValue).toFixed(2));
    return {
      id: `${trade.symbol}-${trade.ts}-${trade.action}`,
      ts: trade.ts,
      symbol: trade.symbol,
      action: trade.action,
      status: trade.status,
      price: trade.price,
      shares: trade.shares,
      grossValue,
      signedValue
    };
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
    const data = await this.marketData.getQuoteSummary(symbol);
    this.quoteCache.set(symbol, { fetchedAt: Date.now(), data });
    return data;
  }

  async buildCompanyCard(symbol) {
    const quote = await this.getQuoteData(symbol);
    const chart = await this.marketData.getChart(symbol, { range: '1y', interval: '1d' });
    const bench = await this.marketData.getChart('^GSPC', { range: '1y', interval: '1d' });
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
    const settled = await Promise.allSettled(unique.map((symbol) => this.buildCompanyCard(symbol)));
    const cards = settled
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
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

    const bench = await this.marketData.getChart('^GSPC', { range: '1y', interval: '1d' });
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
    this.portfolio.equityCurve.push({ ts: this.clock(), value: portfolioValue });
    if (this.portfolio.equityCurve.length > 500) this.portfolio.equityCurve = this.portfolio.equityCurve.slice(-500);

    const pnl = portfolioValue - this.config.capital;
    const returnPct = (pnl / this.config.capital) * 100;
    const values = this.portfolio.equityCurve.map((point) => point.value);
    const returns = values.slice(1).map((value, idx) => (value - values[idx]) / values[idx]).filter(Number.isFinite);
    const mean = returns.length ? returns.reduce((acc, cur) => acc + cur, 0) / returns.length : 0;
    const variance = returns.length ? returns.reduce((acc, cur) => acc + (cur - mean) ** 2, 0) / returns.length : 0;
    const std = Math.sqrt(variance);
    const sharpe = std > 0 ? (mean / std) * Math.sqrt(returns.length) : 0;

    const completedTrades = this.portfolio.trades.filter((trade) => trade.status === 'FILLED' && trade.action !== 'HOLD');
    const tradePnl = completedTrades.map((trade) => {
      const side = trade.action === 'BUY' ? -1 : 1;
      return side * trade.shares * trade.price;
    });
    const wins = tradePnl.filter((value) => value > 0).length;
    const avgProfitPerTrade = tradePnl.length ? tradePnl.reduce((sum, value) => sum + value, 0) / tradePnl.length : 0;
    let peak = values[0] || this.config.capital;
    let maxDrawdown = 0;
    for (const value of values) {
      peak = Math.max(peak, value);
      const drawdown = ((value - peak) / peak) * 100;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }

    this.portfolio.metrics = {
      pnl: Number(pnl.toFixed(2)),
      returnPct: Number(returnPct.toFixed(2)),
      winRate: completedTrades.length ? Number(((wins / completedTrades.length) * 100).toFixed(2)) : 0,
      sharpe: Number(sharpe.toFixed(2)),
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      avgProfitPerTrade: Number(avgProfitPerTrade.toFixed(2)),
      portfolioValue
    };
  }

  async persistResults() {
    const signals = Object.values(this.snapshots).map((snapshot) => ({
      symbol: snapshot.symbol,
      price: snapshot.price,
      rsi: snapshot.rsi,
      signal: snapshot.rsi < 35 ? 'BUY' : snapshot.rsi > 70 ? 'SELL' : 'HOLD',
      timestamp: snapshot.ts
    }));

    const timestamp = this.clock();

    const payload = {
      timestamp,
      portfolioValue: this.getPortfolioValue(),
      positions: this.portfolio.positions,
      trades: this.portfolio.trades,
      signals,
      updatedAt: timestamp,
      config: this.config,
      snapshots: this.snapshots,
      portfolio: this.portfolio,
      operationResults: this.portfolio.operationResults || [],
      cumulativeRevenue: this.portfolio.operationResults?.reduce((sum, item) => sum + (item.signedValue || 0), 0) || 0,
      lastError: this.lastError,
      thesisBySymbol: this.thesisBySymbol,
      latestDecisionIntelligence: this.latestDecisionIntelligence,
      latestTeacherExplanation: this.latestTeacherExplanation,
      latestMlflowRunId: this.latestMlflowRunId
    };

    await this.writeFileFn(this.config.outputPath, JSON.stringify(payload, null, 2));
    await this.redisStore?.cacheResults(payload);
    await this.redisStore?.cacheState(this.getState());
  }



  async bootstrapFromStorage() {
    const restored = (await this.redisStore?.readLatestState())
      ?? null;
    if (!restored) return;

    const restoredPortfolio = restored.portfolio ?? {};
    this.portfolio = {
      ...this.portfolio,
      ...restoredPortfolio,
      trades: restoredPortfolio.trades ?? this.portfolio.trades,
      equityCurve: restoredPortfolio.equityCurve?.length ? restoredPortfolio.equityCurve : this.portfolio.equityCurve,
      metrics: restoredPortfolio.metrics ?? this.portfolio.metrics,
      operationResults: restoredPortfolio.operationResults ?? restored.operationResults ?? this.portfolio.operationResults
    };
    this.snapshots = restored.snapshots ?? {};
    this.lastError = restored.lastError;
    this.thesisBySymbol = restored.thesisBySymbol ?? {};
    this.latestDecisionIntelligence = restored.latestDecisionIntelligence ?? null;
    this.latestTeacherExplanation = restored.latestTeacherExplanation ?? null;
    this.latestMlflowRunId = restored.latestMlflowRunId ?? null;
  }

  async tick(source = 'SCHEDULED') {
    if (this.isTicking) {
      this.emitEvent('tick-skipped', { source, reason: 'already-running' });
      return;
    }

    this.isTicking = true;
    this.status = { stage: 'START', message: `Process started (${source})`, running: true, lastRunAt: this.clock() };
    this.emitEvent('tick-started', { source, symbols: this.config.symbols });

    const errors = [];
    try {
      for (const symbol of this.config.symbols) {
        this.status = { stage: 'FETCHING', message: `Fetching market data for ${symbol}`, running: true, lastRunAt: this.clock() };
        this.emitEvent('symbol-fetch-started', { symbol });
        let snapshot;
        try {
          snapshot = await this.fetchSymbolSnapshot(symbol);
          this.emitEvent('symbol-fetched', { symbol, price: snapshot.price, rsi: snapshot.rsi });
        } catch (error) {
          snapshot = this.buildSyntheticSnapshot(symbol);
          errors.push(`${symbol}: ${error instanceof Error ? error.message : String(error)}`);
          this.emitEvent('symbol-fallback', { symbol, reason: error instanceof Error ? error.message : String(error) });
        }
        this.snapshots[symbol] = snapshot;

        this.status = { stage: 'DECIDING', message: `Graph orchestration for ${symbol}`, running: true, lastRunAt: this.clock() };
        const graphState = {
          symbol,
          snapshot,
          quoteSummary: await this.getQuoteData(symbol).catch(() => null),
          tickSource: source,
          tickTimestamp: this.clock(),
          position: this.portfolio.positions[symbol] || { shares: 0, avgCost: 0 },
          portfolioValue: this.getPortfolioValue(),
          memory: {
            recentDecisions: await this.redisStore?.readDecisions?.(20) ?? [],
            recentTrades: await this.redisStore?.readTrades?.(20) ?? [],
            metrics: this.portfolio.metrics
          }
        };
        const graphEmit = createGraphEventEmitter((type, payload) => this.emitEvent(type, payload));
        const graphContext = {
          llm: this.config.llm,
          fetchFn: this.fetchFn,
          llmCache: this.llmCache,
          maxPositionPct: this.config.maxPositionPct,
          executeTradeFn: (tradeSymbol, tradeSnapshot, riskDecision, tradeTs) =>
            Promise.resolve(this.executeTrade(tradeSymbol, tradeSnapshot, riskDecision, tradeTs))
        };
        const orchestrated = await runTradingGraph({ state: graphState, emit: graphEmit, context: graphContext });
        const decision = orchestrated.riskDecision;
        const trade = orchestrated.execution;
        const thesis = orchestrated.investmentThesis || {};
        const teacherExplanation = orchestrated.aggregatedDecision?.teacherExplanation || null;
        const decisionTimestamp = graphState.tickTimestamp;
        this.emitEvent('decision-made', { symbol, action: decision.action, size_pct: decision.size_pct });
        const decisionRecord = {
          id: `${symbol}-${decisionTimestamp}`,
          ts: decisionTimestamp,
          symbol,
          action: String(decision.action || 'HOLD').toUpperCase(),
          sizePct: clamp(Number(decision.size_pct || 0), 0, this.config.maxPositionPct),
          reason: decision.reasoning || decision.final_reasoning || decision.reason || 'No reason supplied',
          source,
          confidence: Number(decision.confidence ?? 0),
          riskStatus: decision.risk_status || 'RISK_APPROVED',
          riskReason: decision.risk_reason || null,
          thesis: {
            valuationScore: thesis.valuationScore ?? null,
            businessQualityScore: thesis.businessQualityScore ?? null,
            financialHealthScore: thesis.financialHealthScore ?? null,
            growthScore: thesis.growthScore ?? null,
            riskScore: thesis.riskScore ?? null,
            fairValueEstimate: thesis.fairValueEstimate ?? null,
            marginOfSafety: thesis.marginOfSafety ?? null,
            finalRecommendation: thesis.finalRecommendation || decision.action || 'HOLD',
            autopilotAction: thesis.autopilotAction || 'WAIT',
            recommendationConfidence: thesis.recommendationConfidence ?? Number(decision.confidence ?? 0),
            teacherExplanation
          },
          graph: {
            technical: orchestrated.agentOutputs?.technical || null,
            fundamental: orchestrated.agentOutputs?.fundamental || null,
            sentiment: orchestrated.agentOutputs?.sentiment || null,
            risk: orchestrated.agentOutputs?.risk || null,
            agentTrace: orchestrated.agentTrace || []
          }
        };

        await this.redisStore?.appendDecision(decisionRecord);
        this.thesisBySymbol[symbol] = decisionRecord.thesis;
        this.latestDecisionIntelligence = { symbol, ...decisionRecord.thesis };
        this.latestTeacherExplanation = teacherExplanation;
        this.emitEvent('llm-cache', {
          symbol,
          hit: Boolean(orchestrated.aggregatedDecision?.cache?.hit),
          layer: orchestrated.aggregatedDecision?.cache?.layer || null,
          deduped: Boolean(orchestrated.aggregatedDecision?.cache?.deduped)
        });

        this.status = { stage: 'TRADING', message: `Executing ${decision.action} for ${symbol}`, running: true, lastRunAt: this.clock() };

        await this.redisStore?.appendTrade(trade);
        const mlflowPayload = {
          symbol,
          valuationScore: Number(thesis.valuationScore ?? 0),
          businessQualityScore: Number(thesis.businessQualityScore ?? 0),
          financialHealthScore: Number(thesis.financialHealthScore ?? 0),
          growthScore: Number(thesis.growthScore ?? 0),
          riskScore: Number(thesis.riskScore ?? 0),
          fairValueEstimate: Number(thesis.fairValueEstimate ?? snapshot.price ?? 0),
          marginOfSafety: Number(thesis.marginOfSafety ?? 0),
          finalRecommendation: String(thesis.finalRecommendation || decision.action || 'HOLD'),
          autopilotAction: String(thesis.autopilotAction || 'WAIT'),
          recommendationConfidence: Number(thesis.recommendationConfidence ?? decision.confidence ?? 0.35)
        };
        const mlflowRun = await this.mlflowObserver.logDecisionIntelligence(mlflowPayload);
        this.latestMlflowRunId = mlflowRun.runId;
        this.emitEvent('mlflow-logged', { symbol, runId: mlflowRun.runId, status: mlflowRun.status, reason: mlflowRun.reason || null });
        const operationResult = this.computeOperationResult(trade, snapshot);
        this.portfolio.operationResults.push(operationResult);
        if (this.portfolio.operationResults.length > 1000) this.portfolio.operationResults = this.portfolio.operationResults.slice(-1000);

        this.emitEvent('trade-processed', { symbol, action: decision.action, price: snapshot.price, operationResult });
      }

      this.lastError = errors.length ? errors.join(' | ') : null;
      this.status = { stage: 'PERSISTING', message: 'Saving results', running: true, lastRunAt: this.clock() };
      this.updateMetrics();
      await this.persistResults();
      this.notify();
      this.emitEvent('tick-finished', { source, errors: this.lastError });
    } finally {
      this.status = { stage: 'IDLE', message: 'Waiting for next cycle', running: false, lastRunAt: this.clock() };
      this.isTicking = false;
    }
  }

  scheduleDailyTick() {
    if (this.dailyTimer) clearTimeout(this.dailyTimer);

    const now = new Date();
    const next = new Date(now);
    const hour = clamp(Number(this.config.dailySchedule?.hour ?? 9), 0, 23);
    const minute = clamp(Number(this.config.dailySchedule?.minute ?? 0), 0, 59);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    const delayMs = Math.max(1000, next.getTime() - now.getTime());
    this.dailyTimer = setTimeout(async () => {
      await this.tick('DAILY_0900');
      this.scheduleDailyTick();
    }, delayMs);
  }

  async start() {
    await this.bootstrapFromStorage();
    await this.tick('BOOT');
    if (this.config.dailySchedule?.enabled !== false) this.scheduleDailyTick();

    if (this.config.pollIntervalSeconds > 0) {
      this.timer = setInterval(() => {
        void this.tick('SCHEDULED');
      }, this.config.pollIntervalSeconds * 1000);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.dailyTimer) clearTimeout(this.dailyTimer);
  }

  getState() {
    return {
      timestamp: this.clock(),
      config: this.config,
      snapshots: this.snapshots,
      portfolio: this.portfolio,
      lastError: this.lastError,
      status: this.status,
      llmCost: this.llmCache.getCostSummary(),
      schedule: {
        dailyRunAt: `${String(this.config.dailySchedule?.hour ?? 9).padStart(2, '0')}:${String(this.config.dailySchedule?.minute ?? 0).padStart(2, '0')}`,
        timezone: this.config.dailySchedule?.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
        enabled: this.config.dailySchedule?.enabled !== false
      },
      thesisBySymbol: this.thesisBySymbol,
      latestDecisionIntelligence: this.latestDecisionIntelligence,
      teacherExplanation: this.latestTeacherExplanation,
      mlflowRunId: this.latestMlflowRunId
    };
  }
}
