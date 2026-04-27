export const runRiskAgent = async (state) => {
  const snapshot = state.snapshot || {};
  const position = state.position || { shares: 0, avgCost: 0 };
  const price = Number(snapshot.price ?? 0);
  const avgCost = Number(position.avgCost ?? 0);
  const rsi = Number(snapshot.rsi ?? 50);

  const downsideExposure = avgCost > 0 && price > 0 ? Number(((avgCost - price) / avgCost).toFixed(4)) : 0;
  const volatility = Number((Math.abs(rsi - 50) / 50).toFixed(4));
  const riskScore = Number((Math.min(1, Math.max(0, (volatility + Math.max(0, downsideExposure)) / 2))).toFixed(4));
  const riskFlags = [];

  if (downsideExposure > 0.06) riskFlags.push('stop-loss-near');
  if (rsi > 70 || rsi < 30) riskFlags.push('momentum-extreme');

  return {
    name: 'risk-agent',
    confidence: 0.6,
    data: {
      riskScore,
      downsideExposure,
      volatility,
      riskFlags
    }
  };
};
