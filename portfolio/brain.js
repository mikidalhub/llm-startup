export const buildPortfolioBrain = ({ holdings, sectorWeights, totalValue }) => {
  const warnings = [];
  const suggestions = [];

  const topHolding = holdings[0];
  if (topHolding && topHolding.weight > 0.35) {
    warnings.push(`Over-concentration detected in ${topHolding.symbol} (${(topHolding.weight * 100).toFixed(1)}%).`);
    suggestions.push(`Trim ${topHolding.symbol} to near 25% and spread into 2-3 diversified names.`);
  }

  const largestSector = Object.entries(sectorWeights).sort((a, b) => b[1] - a[1])[0];
  if (largestSector && largestSector[1] > 0.45) {
    warnings.push(`Sector imbalance: ${largestSector[0]} is ${(largestSector[1] * 100).toFixed(1)}% of portfolio.`);
    suggestions.push('Add exposure to defensive sectors (healthcare, consumer staples, utilities).');
  }

  if (holdings.length < 5) {
    warnings.push('Portfolio has limited diversification across companies.');
    suggestions.push('Grow toward 8-12 quality businesses over time.');
  }

  const health = Math.max(0, Math.min(100, 100 - warnings.length * 18 + holdings.length * 2));

  return {
    portfolioHealth: Number(health.toFixed(1)),
    totalValue: Number(totalValue.toFixed(2)),
    warnings,
    suggestions,
    rebalanceIdeas: holdings.slice(0, 3).map((holding) => ({
      symbol: holding.symbol,
      currentWeight: Number((holding.weight * 100).toFixed(1)),
      targetWeight: Number(Math.min(25, Math.max(8, 100 / Math.max(holdings.length, 4))).toFixed(1))
    }))
  };
};
