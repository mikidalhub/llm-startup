export const runFundamentalAgent = async (state) => {
  const symbol = state.symbol;
  const defaultAction = state.position?.shares > 0 ? 'HOLD' : 'BUY';

  return {
    action: defaultAction,
    confidence: 0.52,
    reasoning: `Fundamental model is lightweight in runtime mode; preserving long-horizon posture for ${symbol}.`,
    risk_params: {
      max_position_pct: 0.08,
      stop_loss_pct: 0.06,
      take_profit_pct: 0.1
    }
  };
};
