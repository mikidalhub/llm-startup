import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export class TradingDatabase {
  constructor({ path = './data/trading.sqlite' } = {}) {
    this.path = path;
    this.db = null;
    this.statements = null;
  }

  async init() {
    if (this.db) return;

    let DatabaseSync;
    try {
      ({ DatabaseSync } = await import('node:sqlite'));
    } catch {
      throw new Error('SQLite runtime is unavailable in this Node.js version.');
    }

    mkdirSync(dirname(this.path), { recursive: true });
    this.db = new DatabaseSync(this.path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        symbol TEXT NOT NULL,
        action TEXT NOT NULL,
        size_pct REAL NOT NULL,
        reason TEXT NOT NULL,
        source TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        symbol TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        size_pct REAL NOT NULL,
        shares REAL NOT NULL,
        price REAL NOT NULL,
        reason TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        symbol TEXT NOT NULL,
        price REAL NOT NULL,
        volume REAL NOT NULL,
        rsi REAL NOT NULL,
        source TEXT
      );
      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        portfolio_value REAL NOT NULL,
        cash REAL NOT NULL,
        positions_json TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        last_error TEXT
      );
      CREATE TABLE IF NOT EXISTS risk_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        symbol TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_decisions_symbol_time ON decisions(symbol, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_trades_symbol_time ON trades(symbol, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_snapshots_symbol_time ON snapshots(symbol, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_risk_events_symbol_time ON risk_events(symbol, created_at DESC);
    `);

    this.statements = {
      insertDecision: this.db.prepare('INSERT INTO decisions (created_at, symbol, action, size_pct, reason, source) VALUES (?, ?, ?, ?, ?, ?)'),
      insertTrade: this.db.prepare('INSERT INTO trades (created_at, symbol, action, status, size_pct, shares, price, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
      insertSnapshot: this.db.prepare('INSERT INTO snapshots (created_at, symbol, price, volume, rsi, source) VALUES (?, ?, ?, ?, ?, ?)'),
      insertPortfolioSnapshot: this.db.prepare('INSERT INTO portfolio_snapshots (created_at, portfolio_value, cash, positions_json, metrics_json, last_error) VALUES (?, ?, ?, ?, ?, ?)'),
      insertRiskEvent: this.db.prepare('INSERT INTO risk_events (created_at, symbol, level, message, metadata_json) VALUES (?, ?, ?, ?, ?)'),
      latestPortfolioSnapshot: this.db.prepare('SELECT * FROM portfolio_snapshots ORDER BY id DESC LIMIT 1'),
      latestSnapshots: this.db.prepare(`
        SELECT s.*
        FROM snapshots s
        JOIN (
          SELECT symbol, MAX(id) AS max_id
          FROM snapshots
          GROUP BY symbol
        ) latest ON latest.max_id = s.id
      `),
      recentTrades: this.db.prepare('SELECT created_at, symbol, action, status, size_pct AS sizePct, shares, price, reason FROM trades ORDER BY id DESC LIMIT ?'),
      recentSignals: this.db.prepare(`
        SELECT created_at AS timestamp, symbol, price, rsi,
        CASE WHEN rsi < 35 THEN 'BUY' WHEN rsi > 70 THEN 'SELL' ELSE 'HOLD' END AS signal
        FROM snapshots ORDER BY id DESC LIMIT ?
      `),
      recentRiskEvents: this.db.prepare('SELECT created_at, symbol, level, message, metadata_json FROM risk_events ORDER BY id DESC LIMIT ?'),
      recentDecisions: this.db.prepare('SELECT id, created_at, symbol, action, size_pct AS sizePct, reason, source FROM decisions ORDER BY id DESC LIMIT ?'),
      decisionById: this.db.prepare('SELECT id, created_at, symbol, action, size_pct AS sizePct, reason, source FROM decisions WHERE id = ?'),
      latestTradeForDecision: this.db.prepare('SELECT created_at, action, status, shares, price, reason FROM trades WHERE symbol = ? AND created_at >= ? ORDER BY id ASC LIMIT 1')
    };
  }

  recordDecision(decision) {
    this.statements.insertDecision.run(
      decision.ts,
      decision.symbol,
      decision.action,
      decision.sizePct,
      decision.reason,
      decision.source
    );
  }

  recordTrade(trade) {
    this.statements.insertTrade.run(
      trade.ts,
      trade.symbol,
      trade.action,
      trade.status,
      trade.sizePct,
      trade.shares,
      trade.price,
      trade.reason
    );
  }

  recordSnapshot(snapshot) {
    this.statements.insertSnapshot.run(
      snapshot.ts,
      snapshot.symbol,
      snapshot.price,
      snapshot.volume,
      snapshot.rsi,
      snapshot.source || null
    );
  }

  recordPortfolioSnapshot(snapshot) {
    this.statements.insertPortfolioSnapshot.run(
      snapshot.ts,
      snapshot.portfolioValue,
      snapshot.cash,
      JSON.stringify(snapshot.positions),
      JSON.stringify(snapshot.metrics),
      snapshot.lastError || null
    );
  }

  recordRiskEvent(event) {
    this.statements.insertRiskEvent.run(
      event.ts,
      event.symbol,
      event.level,
      event.message,
      JSON.stringify(event.metadata ?? {})
    );
  }

  loadLatestState(capital = 0) {
    const latestPortfolio = this.statements.latestPortfolioSnapshot.get();
    const snapshots = this.statements.latestSnapshots.all();

    return {
      portfolio: {
        cash: latestPortfolio?.cash ?? capital,
        positions: parseJson(latestPortfolio?.positions_json, {}),
        metrics: parseJson(latestPortfolio?.metrics_json, { pnl: 0, returnPct: 0, winRate: 0, sharpe: 0, portfolioValue: capital }),
        trades: this.statements.recentTrades.all(300).reverse(),
        equityCurve: latestPortfolio
          ? [{ ts: latestPortfolio.created_at, value: latestPortfolio.portfolio_value }]
          : [{ ts: new Date().toISOString(), value: capital }]
      },
      snapshots: Object.fromEntries(snapshots.map((snapshot) => [snapshot.symbol, {
        symbol: snapshot.symbol,
        price: snapshot.price,
        volume: snapshot.volume,
        rsi: snapshot.rsi,
        ts: snapshot.created_at,
        source: snapshot.source || undefined
      }])),
      lastError: latestPortfolio?.last_error ?? null
    };
  }

  readResultsPayload(limit = 50) {
    const latestPortfolio = this.statements.latestPortfolioSnapshot.get();
    const trades = this.statements.recentTrades.all(limit).reverse();
    const signals = this.statements.recentSignals.all(limit).reverse();
    const positions = parseJson(latestPortfolio?.positions_json, {});

    return {
      timestamp: latestPortfolio?.created_at ?? new Date().toISOString(),
      portfolioValue: latestPortfolio?.portfolio_value ?? 0,
      positions,
      trades,
      signals
    };
  }

  readRiskEvents(limit = 100) {
    return this.statements.recentRiskEvents.all(limit).map((event) => ({
      timestamp: event.created_at,
      symbol: event.symbol,
      level: event.level,
      message: event.message,
      metadata: parseJson(event.metadata_json, {})
    }));
  }

  readDecisions(limit = 100) {
    return this.statements.recentDecisions.all(limit).reverse().map((decision) => ({
      id: decision.id,
      ts: decision.created_at,
      symbol: decision.symbol,
      action: decision.action,
      sizePct: decision.sizePct,
      reason: decision.reason,
      source: decision.source
    }));
  }

  readDecisionById(id) {
    const decision = this.statements.decisionById.get(id);
    if (!decision) return null;
    const relatedTrade = this.statements.latestTradeForDecision.get(decision.symbol, decision.created_at);

    return {
      id: decision.id,
      ts: decision.created_at,
      symbol: decision.symbol,
      action: decision.action,
      sizePct: decision.sizePct,
      reason: decision.reason,
      source: decision.source,
      trade: relatedTrade
        ? {
          ts: relatedTrade.created_at,
          action: relatedTrade.action,
          status: relatedTrade.status,
          shares: relatedTrade.shares,
          price: relatedTrade.price,
          reason: relatedTrade.reason
        }
        : null
    };
  }
}
