const light = (score) => {
  if (score >= 70) return 'GREEN';
  if (score >= 45) return 'YELLOW';
  return 'RED';
};

export const buildBeginnerView = ({ valueScore, qualityScore, riskNumber, dividendScore }) => ({
  trafficLights: {
    value: light(valueScore),
    quality: light(qualityScore),
    risk: riskNumber < 35 ? 'GREEN' : riskNumber < 65 ? 'YELLOW' : 'RED',
    income: light(dividendScore)
  }
});

export const buildExplanation = ({ companyName, valueScore, qualityScore, riskScore, dividendScore, pillars }) => {
  const reasons = [];
  if (pillars.cashflowStrength >= 65) reasons.push('strong free cash flow generation');
  if (pillars.debtDiscipline >= 65) reasons.push('conservative debt levels');
  if (pillars.earningsStability >= 65) reasons.push('stable earnings trend');
  if (pillars.valuation >= 65) reasons.push('valuation looks reasonable for long-term investors');
  if (!reasons.length) reasons.push('mixed fundamentals that require patience and monitoring');

  const stance = valueScore >= 70 && riskScore === 'LOW'
    ? 'STRONG BUY'
    : valueScore >= 55
      ? 'WATCHLIST BUY'
      : 'HOLD / LEARN MORE';

  return {
    stance,
    summary: `${companyName} is rated ${stance} because it shows ${reasons.join(', ')}. Risk level is ${riskScore}. Dividend strength score is ${dividendScore.toFixed(1)}.`
  };
};
