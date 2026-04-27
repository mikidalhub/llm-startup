export const runSentimentAgent = async (state) => {
  const symbol = state.symbol;

  return {
    name: 'sentiment-agent',
    confidence: 0.4,
    data: {
      symbol,
      sentimentScore: 0,
      newsPolarity: 0,
      socialPolarity: 0
    }
  };
};
