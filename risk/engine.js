const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const stdDev = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const computeDrawdown = (prices) => {
  let peak = prices[0] ?? 0;
  let maxDrawdown = 0;
  for (const price of prices) {
    peak = Math.max(peak, price);
    if (peak > 0) {
      maxDrawdown = Math.min(maxDrawdown, (price - peak) / peak);
    }
  }
  return Math.abs(maxDrawdown);
};

export const buildRiskAnalysis = ({ priceHistory, benchmarkHistory, portfolioWeights, sectorWeights, betaHint }) => {
  const returns = priceHistory.slice(1).map((price, i) => (price - priceHistory[i]) / priceHistory[i]).filter(Number.isFinite);
  const benchmarkReturns = benchmarkHistory
    .slice(1)
    .map((price, i) => (price - benchmarkHistory[i]) / benchmarkHistory[i])
    .filter(Number.isFinite);

  const volatility = stdDev(returns) * Math.sqrt(252);
  const drawdown = computeDrawdown(priceHistory);
  const beta = betaHint ?? (benchmarkReturns.length ? clamp(volatility / (stdDev(benchmarkReturns) * Math.sqrt(252) || 1), 0.4, 2.2) : 1);
  const correlation = benchmarkReturns.length ? clamp(1 - Math.abs(beta - 1) * 0.4, -1, 1) : 0.5;
  const maxPosition = Math.max(...Object.values(portfolioWeights || { cash: 1 }));
  const sectorConcentration = Math.max(...Object.values(sectorWeights || { Unknown: 1 }));

  const numericRisk = clamp(
    volatility * 120 + drawdown * 100 + Math.max(0, beta - 1) * 20 + maxPosition * 60 + sectorConcentration * 40,
    0,
    100
  );

  let riskLabel = 'LOW';
  if (numericRisk >= 65) riskLabel = 'HIGH';
  else if (numericRisk >= 35) riskLabel = 'MEDIUM';

  return {
    volatility: Number(volatility.toFixed(3)),
    drawdown: Number(drawdown.toFixed(3)),
    beta: Number(beta.toFixed(2)),
    correlation: Number(correlation.toFixed(2)),
    sectorConcentration: Number(sectorConcentration.toFixed(2)),
    maxPositionWeight: Number(maxPosition.toFixed(2)),
    riskScore: riskLabel,
    riskNumber: Number(numericRisk.toFixed(1))
  };
};
