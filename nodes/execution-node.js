export const runExecutionNode = async (state, emit, context = {}) => {
  emit?.({
    type: 'EXECUTION_START',
    node: 'EXECUTION',
    status: 'START',
    payload: {
      symbol: state.symbol,
      action: state.riskDecision?.action,
      size_pct: state.riskDecision?.size_pct
    },
    timestamp: new Date().toISOString()
  });

  const executeTradeFn = context.executeTradeFn;
  if (typeof executeTradeFn !== 'function') {
    throw new Error('Execution node missing executeTradeFn');
  }

  const trade = await executeTradeFn(state.symbol, state.snapshot, state.riskDecision, state.tickTimestamp);

  emit?.({
    type: 'EXECUTION_RESULT',
    node: 'EXECUTION',
    status: 'DONE',
    payload: trade,
    timestamp: new Date().toISOString()
  });

  return trade;
};
