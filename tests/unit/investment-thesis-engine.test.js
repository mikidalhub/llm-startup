import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvestmentThesis } from '../../app/core/investment-thesis-engine.js';

test('buildInvestmentThesis returns BUY for strong undervalued profile', () => {
  const thesis = buildInvestmentThesis({
    symbol: 'AAPL',
    snapshot: { price: 100, rsi: 45 },
    quoteSummary: {
      currentPrice: 100,
      trailingPE: 10,
      forwardPE: 12,
      priceToBook: 2,
      priceToSales: 2,
      pegRatio: 1.1,
      debtToEquity: 40,
      returnOnEquity: 0.2,
      returnOnAssets: 0.09,
      operatingMargins: 0.24,
      profitMargins: 0.18,
      freeCashflow: 3000000000,
      revenueGrowth: 0.12,
      earningsGrowth: 0.15,
      beta: 0.9
    }
  });

  assert.equal(thesis.finalRecommendation, 'BUY');
  assert.equal(thesis.autopilotAction, 'BUY_NOW');
});

test('buildInvestmentThesis degrades to HOLD when data is incomplete', () => {
  const thesis = buildInvestmentThesis({ symbol: 'MSFT', snapshot: { price: 200 }, quoteSummary: { currentPrice: 200 } });
  assert.equal(thesis.finalRecommendation, 'HOLD');
  assert.equal(thesis.recommendationConfidence <= 0.35, true);
});
