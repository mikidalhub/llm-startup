const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const buildValueModel = (fundamental, quote) => {
  const cashflowStrength = quote.freeCashflow && quote.marketCap
    ? clamp((quote.freeCashflow / quote.marketCap) * 1000, 0, 100)
    : 50;
  const debtDiscipline = quote.debtToEquity == null ? 50 : clamp(100 - quote.debtToEquity / 2, 0, 100);
  const earningsStability = quote.earningsGrowth == null ? 50 : clamp(50 + quote.earningsGrowth * 250, 0, 100);
  const moat = quote.grossMargins == null ? 50 : clamp(quote.grossMargins * 120, 0, 100);
  const dividendCulture = quote.dividendYield == null ? 40 : clamp(40 + quote.dividendYield * 1200, 0, 100);
  const valuation = clamp(120 - (quote.forwardPE || quote.trailingPE || 25) * 4, 0, 100);

  const valueScore = clamp(
    0.2 * cashflowStrength +
      0.2 * debtDiscipline +
      0.2 * earningsStability +
      0.15 * moat +
      0.1 * dividendCulture +
      0.15 * valuation,
    0,
    100
  );

  return {
    valueScore: Number(valueScore.toFixed(1)),
    pillars: {
      cashflowStrength: Number(cashflowStrength.toFixed(1)),
      debtDiscipline: Number(debtDiscipline.toFixed(1)),
      earningsStability: Number(earningsStability.toFixed(1)),
      moat: Number(moat.toFixed(1)),
      dividendCulture: Number(dividendCulture.toFixed(1)),
      valuation: Number(valuation.toFixed(1))
    },
    style: 'Buffett-inspired long-term value model'
  };
};
