export const DEFAULT_UNIVERSE = {
  sp500: ['AAPL', 'MSFT', 'JNJ', 'PG', 'KO', 'PEP', 'XOM', 'HD'],
  nasdaq100: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'ADBE', 'COST'],
  dividendAristocrats: ['KO', 'PG', 'JNJ', 'MMM', 'CL', 'PEP']
};

export const rankOpportunities = (cards, limit = 10) => cards
  .map((card) => ({
    ...card,
    investmentScore: Number((0.4 * card.valueScore + 0.25 * card.qualityScore + 0.2 * card.dividendScore + 0.15 * (100 - card.riskNumber)).toFixed(1))
  }))
  .sort((a, b) => b.investmentScore - a.investmentScore)
  .slice(0, limit);
