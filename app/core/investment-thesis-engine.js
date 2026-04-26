import {
  VALUE_INVESTING_WEIGHTS,
  computeBusinessQualityScore,
  computeFinancialHealthScore,
  computeGrowthScore,
  computeRiskScore,
  computeValuationScore,
  isMissingData,
  normalizedScore,
  safePrice
} from './value-investing-rules.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

const fallbackThesis = ({ symbol, price, reason = 'Financial data is incomplete; using conservative HOLD stance.' }) => ({
  symbol,
  valuationScore: 45,
  businessQualityScore: 45,
  financialHealthScore: 40,
  growthScore: 45,
  riskScore: 45,
  fairValueEstimate: price,
  marginOfSafety: 0,
  finalRecommendation: 'HOLD',
  autopilotAction: 'WAIT',
  recommendationConfidence: 0.35,
  warnings: [reason],
  scoreSummary: 'Insufficient data for high-confidence value investing decision.'
});

const pickRecommendation = ({ valuationScore, businessQualityScore, financialHealthScore, growthScore, riskScore, marginOfSafety }) => {
  const hasStrongFoundation = businessQualityScore >= 65 && financialHealthScore >= 60;
  const cheapEnough = marginOfSafety >= 0.15 && valuationScore >= 60;
  const elevatedRisk = riskScore <= 38;
  const severeWeakness = financialHealthScore < 35 || businessQualityScore < 35;

  if (severeWeakness || elevatedRisk) {
    return { finalRecommendation: 'SELL', autopilotAction: 'AVOID' };
  }

  if (hasStrongFoundation && cheapEnough && growthScore >= 50 && riskScore >= 55) {
    return { finalRecommendation: 'BUY', autopilotAction: 'BUY_NOW' };
  }

  if (marginOfSafety < -0.12 || valuationScore < 35) {
    return { finalRecommendation: 'SELL', autopilotAction: 'AVOID' };
  }

  return { finalRecommendation: 'HOLD', autopilotAction: 'HOLD' };
};

const confidenceFromScores = ({ weightedComposite, recommendation, dataCompleteness }) => {
  const base = weightedComposite / 100;
  const recommendationPenalty = recommendation === 'HOLD' ? 0.08 : 0;
  const confidence = clamp(base * dataCompleteness - recommendationPenalty, 0.2, 0.95);
  return Number(confidence.toFixed(2));
};

export const buildInvestmentThesis = (state) => {
  const symbol = state.symbol;
  const snapshotPrice = safePrice(state.snapshot?.price);
  const quotePrice = safePrice(state.quoteSummary?.currentPrice, snapshotPrice);
  const currentPrice = safePrice(snapshotPrice, quotePrice);

  if (!currentPrice) return fallbackThesis({ symbol, price: 0, reason: 'Current market price is unavailable.' });

  const quote = {
    ...state.quoteSummary,
    currentPrice
  };

  if (isMissingData(quote)) {
    return fallbackThesis({ symbol, price: currentPrice });
  }

  const valuationScore = normalizedScore(computeValuationScore(quote));
  const businessQualityScore = normalizedScore(computeBusinessQualityScore(quote));
  const financialHealthScore = normalizedScore(computeFinancialHealthScore(quote));
  const growthScore = normalizedScore(computeGrowthScore(quote));
  const riskScore = normalizedScore(computeRiskScore(quote, state.snapshot));

  const fairValueEstimate = Number((currentPrice * (1 + ((valuationScore - 50) / 120))).toFixed(2));
  const marginOfSafety = Number(((fairValueEstimate - currentPrice) / currentPrice).toFixed(4));

  const weightedComposite =
    valuationScore * VALUE_INVESTING_WEIGHTS.valuationScore +
    businessQualityScore * VALUE_INVESTING_WEIGHTS.businessQualityScore +
    financialHealthScore * VALUE_INVESTING_WEIGHTS.financialHealthScore +
    growthScore * VALUE_INVESTING_WEIGHTS.growthScore +
    riskScore * VALUE_INVESTING_WEIGHTS.riskScore;

  const decision = pickRecommendation({
    valuationScore,
    businessQualityScore,
    financialHealthScore,
    growthScore,
    riskScore,
    marginOfSafety
  });

  const dataCompleteness = 1 - (Object.values(quote).filter((value) => value == null).length / Math.max(1, Object.keys(quote).length));
  const recommendationConfidence = confidenceFromScores({
    weightedComposite,
    recommendation: decision.finalRecommendation,
    dataCompleteness
  });

  return {
    symbol,
    valuationScore,
    businessQualityScore,
    financialHealthScore,
    growthScore,
    riskScore,
    fairValueEstimate,
    marginOfSafety,
    finalRecommendation: decision.finalRecommendation,
    autopilotAction: decision.autopilotAction,
    recommendationConfidence,
    scoreSummary: `Composite=${weightedComposite.toFixed(2)} using value-investing weighted rubric.`,
    warnings: []
  };
};
