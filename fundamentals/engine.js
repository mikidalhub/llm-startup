const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const scoreFromThreshold = (value, { good, okay, inverse = false }) => {
  if (value == null) return 50;
  if (!inverse) {
    if (value >= good) return 100;
    if (value >= okay) return 70;
    return 35;
  }
  if (value <= good) return 100;
  if (value <= okay) return 70;
  return 35;
};

export const buildFundamentalAnalysis = (snapshot) => {
  const metrics = {
    pe: snapshot.trailingPE,
    forwardPE: snapshot.forwardPE,
    peg: snapshot.pegRatio,
    priceToFreeCashFlow: snapshot.freeCashflow && snapshot.marketCap ? snapshot.marketCap / snapshot.freeCashflow : null,
    debtToEquity: snapshot.debtToEquity,
    roe: snapshot.returnOnEquity,
    roic: snapshot.returnOnAssets,
    revenueGrowth: snapshot.revenueGrowth,
    epsGrowth: snapshot.earningsGrowth,
    freeCashflowGrowth: snapshot.revenueGrowth != null && snapshot.earningsGrowth != null ? (snapshot.revenueGrowth + snapshot.earningsGrowth) / 2 : null,
    dividendYield: snapshot.dividendYield,
    dividendGrowth: snapshot.dividendYield != null && snapshot.payoutRatio != null
      ? Math.max(0, (snapshot.dividendYield * (1 - snapshot.payoutRatio)) / Math.max(snapshot.dividendYield, 0.0001))
      : null
  };

  const buckets = {
    valuation: [
      scoreFromThreshold(metrics.pe, { good: 18, okay: 25, inverse: true }),
      scoreFromThreshold(metrics.forwardPE, { good: 17, okay: 24, inverse: true }),
      scoreFromThreshold(metrics.peg, { good: 1.3, okay: 2.1, inverse: true }),
      scoreFromThreshold(metrics.priceToFreeCashFlow, { good: 18, okay: 28, inverse: true })
    ],
    quality: [
      scoreFromThreshold(metrics.roe, { good: 0.15, okay: 0.1 }),
      scoreFromThreshold(metrics.roic, { good: 0.08, okay: 0.05 }),
      scoreFromThreshold(metrics.debtToEquity, { good: 80, okay: 150, inverse: true })
    ],
    growth: [
      scoreFromThreshold(metrics.revenueGrowth, { good: 0.08, okay: 0.03 }),
      scoreFromThreshold(metrics.epsGrowth, { good: 0.1, okay: 0.04 }),
      scoreFromThreshold(metrics.freeCashflowGrowth, { good: 0.08, okay: 0.03 })
    ],
    income: [
      scoreFromThreshold(metrics.dividendYield, { good: 0.02, okay: 0.01 }),
      scoreFromThreshold(metrics.dividendGrowth, { good: 0.35, okay: 0.2 })
    ]
  };

  const avg = (arr) => arr.reduce((sum, value) => sum + value, 0) / arr.length;
  const valuationScore = avg(buckets.valuation);
  const qualityScore = avg(buckets.quality);
  const growthScore = avg(buckets.growth);
  const incomeScore = avg(buckets.income);

  const fundamentalScore = clamp(
    0.3 * valuationScore + 0.3 * qualityScore + 0.25 * growthScore + 0.15 * incomeScore,
    0,
    100
  );

  return {
    metrics,
    buckets: {
      valuationScore: Number(valuationScore.toFixed(1)),
      qualityScore: Number(qualityScore.toFixed(1)),
      growthScore: Number(growthScore.toFixed(1)),
      incomeScore: Number(incomeScore.toFixed(1))
    },
    fundamentalScore: Number(fundamentalScore.toFixed(1))
  };
};
