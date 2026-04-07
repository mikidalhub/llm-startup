import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFundamentalAnalysis } from '../../fundamentals/engine.js';
import { buildValueModel } from '../../analysis/value-model.js';
import { buildRiskAnalysis } from '../../risk/engine.js';

test('fundamental and value scoring return bounded values', () => {
  const quote = {
    trailingPE: 18,
    forwardPE: 16,
    pegRatio: 1.2,
    freeCashflow: 100,
    marketCap: 2000,
    debtToEquity: 60,
    returnOnEquity: 0.18,
    returnOnAssets: 0.09,
    revenueGrowth: 0.1,
    earningsGrowth: 0.12,
    dividendYield: 0.018,
    payoutRatio: 0.35,
    grossMargins: 0.42
  };

  const fundamental = buildFundamentalAnalysis(quote);
  const value = buildValueModel(fundamental, quote);
  assert.ok(fundamental.fundamentalScore >= 0 && fundamental.fundamentalScore <= 100);
  assert.ok(value.valueScore >= 0 && value.valueScore <= 100);
});

test('risk engine emits label and numeric risk', () => {
  const risk = buildRiskAnalysis({
    priceHistory: [100, 101, 99, 100, 103, 102],
    benchmarkHistory: [100, 100.5, 100.1, 100.8, 101.1, 100.9],
    portfolioWeights: { AAPL: 0.3, MSFT: 0.2, cash: 0.5 },
    sectorWeights: { Technology: 0.5, Cash: 0.5 }
  });

  assert.match(risk.riskScore, /LOW|MEDIUM|HIGH/);
  assert.ok(risk.riskNumber >= 0 && risk.riskNumber <= 100);
});
