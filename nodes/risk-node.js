const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const runRiskNode = async (state, emit, context = {}) => {
  const maxPositionPct = Number(context.maxPositionPct ?? 0.1);
  const decision = state.aggregatedDecision || { action: 'HOLD', confidence: 0, final_reasoning: 'Missing aggregate' };
  const position = state.position || { shares: 0, avgCost: 0 };
  const snapshot = state.snapshot || { price: 0 };

  const desiredSize = clamp(Number(decision.size_pct ?? decision.confidence ?? 0.05), 0, maxPositionPct);
  let action = String(decision.action || 'HOLD').toUpperCase();
  let status = 'RISK_APPROVED';
  let reason = 'Decision approved without modifications.';

  if (action === 'SELL' && (position.shares || 0) <= 0) {
    action = 'HOLD';
    status = 'RISK_REJECTED';
    reason = 'No shares available to sell.';
  }

  const mark = Number(snapshot.price || 0);
  const avgCost = Number(position.avgCost || 0);
  if (action === 'HOLD' && avgCost > 0 && mark > 0) {
    const pnlPct = (mark - avgCost) / avgCost;
    if (pnlPct <= -0.06) {
      action = 'SELL';
      status = 'RISK_MODIFIED';
      reason = 'Stop-loss threshold reached; forcing SELL.';
    } else if (pnlPct >= 0.12) {
      action = 'SELL';
      status = 'RISK_MODIFIED';
      reason = 'Take-profit threshold reached; locking gains.';
    }
  }

  const riskDecision = {
    action,
    size_pct: desiredSize,
    confidence: Number(decision.confidence ?? 0.5),
    final_reasoning: decision.final_reasoning,
    reason: decision.final_reasoning || reason,
    risk_status: status,
    risk_reason: reason
  };

  emit?.({
    type: status,
    node: 'RISK',
    status: 'DONE',
    payload: riskDecision,
    timestamp: new Date().toISOString()
  });

  return riskDecision;
};
