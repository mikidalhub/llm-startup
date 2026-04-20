export const runDataNode = async (state) => ({
  snapshot: state.snapshot,
  symbol: state.symbol,
  portfolioValue: state.portfolioValue,
  position: state.position || { shares: 0, avgCost: 0 }
});
