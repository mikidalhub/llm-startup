import { buildInvestmentThesis } from '../app/core/investment-thesis-engine.js';

export const runInvestmentThesisNode = async (state, emit) => {
  const thesis = buildInvestmentThesis(state);

  emit?.({
    type: 'THESIS_BUILT',
    node: 'INVESTMENT_THESIS',
    status: 'DONE',
    payload: {
      symbol: state.symbol,
      finalRecommendation: thesis.finalRecommendation,
      confidence: thesis.recommendationConfidence
    },
    timestamp: new Date().toISOString()
  });

  return thesis;
};
