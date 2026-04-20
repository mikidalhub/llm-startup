export const runTechnicalAgent = async (state) => {
  const snapshot = state.snapshot;
  const rsi = Number(snapshot?.rsi ?? 50);
  const momentum = rsi < 35 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral';
  const action = rsi < 35 ? 'BUY' : rsi > 70 ? 'SELL' : 'HOLD';
  const confidence = rsi < 30 || rsi > 75 ? 0.78 : 0.55;

  return {
    action,
    confidence,
    reasoning: `RSI=${rsi} indicates ${momentum} momentum.`,
    risk_params: {
      max_position_pct: 0.1,
      stop_loss_pct: 0.04,
      take_profit_pct: 0.08
    }
  };
};
