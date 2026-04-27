export const runTechnicalAgent = async (state) => {
  const snapshot = state.snapshot;
  const rsi = Number(snapshot?.rsi ?? 50);
  const trend = rsi < 35 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral';
  const volatility = Number(Math.abs(rsi - 50) / 50).toFixed(2);

  return {
    name: 'technical-agent',
    confidence: rsi < 30 || rsi > 75 ? 0.78 : 0.55,
    data: {
      trend,
      rsi,
      macd: Number(((rsi - 50) / 10).toFixed(2)),
      volatility: Number(volatility)
    }
  };
};
