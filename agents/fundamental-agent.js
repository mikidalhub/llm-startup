export const runFundamentalAgent = async (state) => {
  const symbol = state.symbol;
  const quote = state.quoteSummary || {};

  return {
    name: 'fundamental-agent',
    confidence: 0.52,
    data: {
      symbol,
      revenueGrowth: Number(quote.revenueGrowth ?? 0),
      operatingMargins: Number(quote.operatingMargins ?? 0),
      debtToEquity: Number(quote.debtToEquity ?? 0),
      returnOnEquity: Number(quote.returnOnEquity ?? 0),
      freeCashflow: Number(quote.freeCashflow ?? 0)
    }
  };
};
