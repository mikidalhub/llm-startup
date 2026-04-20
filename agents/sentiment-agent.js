export const runSentimentAgent = async (state) => {
  const symbol = state.symbol;

  return {
    action: 'HOLD',
    confidence: 0.4,
    reasoning: `Sentiment feed is running in stub mode for ${symbol}; no strong directional signal.`,
    risk_params: {
      max_position_pct: 0.05,
      stop_loss_pct: 0.05,
      take_profit_pct: 0.09
    }
  };
};
