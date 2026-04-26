const formatPct = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

const scoreMeaning = (name, score) => {
  if (score >= 70) return `${name} is strong (${score}/100).`;
  if (score >= 50) return `${name} is acceptable (${score}/100), but not outstanding.`;
  return `${name} is weak (${score}/100), so caution is needed.`;
};

export const buildDeterministicTeacherFallback = (thesis) => {
  const lines = [
    `Final recommendation: ${thesis.finalRecommendation}.`,
    `Autopilot action: ${thesis.autopilotAction}.`,
    `Confidence: ${(thesis.recommendationConfidence * 100).toFixed(0)}%.`,
    `Fair value estimate is $${Number(thesis.fairValueEstimate || 0).toFixed(2)} and margin of safety is ${formatPct(thesis.marginOfSafety)}.`,
    scoreMeaning('Valuation', thesis.valuationScore),
    scoreMeaning('Business quality', thesis.businessQualityScore),
    scoreMeaning('Financial health', thesis.financialHealthScore),
    scoreMeaning('Growth', thesis.growthScore),
    scoreMeaning('Risk control', thesis.riskScore),
    'Discipline reminder: a stock is only a BUY when valuation, quality, and financial strength align together.'
  ];

  return {
    summary: `The system reached ${thesis.finalRecommendation} using deterministic value-investing rules.`,
    stepByStep: lines,
    fullText: lines.join(' '),
    source: 'deterministic-fallback'
  };
};

export const buildTeacherPrompt = ({ thesis, symbol, snapshot }) => ({
  role: 'user',
  content: JSON.stringify({
    objective: 'Explain deterministic recommendation to a beginner investor in clear educational language.',
    style: ['calm', 'professional', 'simple', 'confidence-building'],
    required_sections: [
      'What each score means',
      'Step-by-step logic from scores to final recommendation',
      'Why BUY/HOLD/SELL follows logically',
      'What a disciplined investor should learn'
    ],
    symbol,
    currentPrice: snapshot?.price,
    thesis
  })
});
