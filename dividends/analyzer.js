const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const buildDividendAnalysis = ({ symbol, dividendYield, payoutRatio, portfolioValue = 0, positionWeight = 0 }) => {
  const safeYield = dividendYield ?? 0;
  const safePayout = payoutRatio ?? 0.5;
  const sustainability = clamp(100 - safePayout * 100, 10, 100);
  const yieldScore = clamp(safeYield * 2200, 0, 100);
  const dividendGrowth = clamp((safeYield * (1 - safePayout)) * 4000, 0, 100);
  const dividendScore = Number((0.45 * sustainability + 0.35 * yieldScore + 0.2 * dividendGrowth).toFixed(1));

  const annualIncome = portfolioValue * positionWeight * safeYield;

  return {
    symbol,
    dividendYield: Number((safeYield * 100).toFixed(2)),
    payoutRatio: Number((safePayout * 100).toFixed(1)),
    dividendGrowthScore: Number(dividendGrowth.toFixed(1)),
    dividendScore,
    incomeProjection: {
      monthly: Number((annualIncome / 12).toFixed(2)),
      annual: Number(annualIncome.toFixed(2))
    }
  };
};
