const MODULES = [
  'assetProfile',
  'price',
  'summaryDetail',
  'defaultKeyStatistics',
  'financialData',
  'incomeStatementHistory',
  'incomeStatementHistoryQuarterly',
  'cashflowStatementHistory',
  'cashflowStatementHistoryQuarterly',
  'balanceSheetHistory',
  'balanceSheetHistoryQuarterly',
  'earnings',
  'calendarEvents'
];

const safeNumber = (value, fallback = null) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value.raw === 'number' && Number.isFinite(value.raw)) return value.raw;
  return fallback;
};

export class YahooClient {
  constructor({ fetchImpl = fetch } = {}) {
    this.fetchImpl = fetchImpl;
  }

  async getChart(symbol, { range = '1y', interval = '1d' } = {}) {
    const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const response = await this.fetchImpl(endpoint);
    if (!response.ok) {
      throw new Error(`Yahoo chart request failed for ${symbol}: ${response.status}`);
    }

    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0] || {};
    const closes = (quote.close || []).map(Number).filter(Number.isFinite);

    return {
      symbol,
      closes,
      volumes: (quote.volume || []).map(Number).filter(Number.isFinite),
      timestamps: result?.timestamp || []
    };
  }

  async getQuoteSummary(symbol) {
    const endpoint = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${MODULES.join(',')}`;
    const response = await this.fetchImpl(endpoint);
    if (!response.ok) {
      throw new Error(`Yahoo quoteSummary request failed for ${symbol}: ${response.status}`);
    }
    const payload = await response.json();
    const data = payload?.quoteSummary?.result?.[0];
    if (!data) {
      throw new Error(`No quoteSummary result for ${symbol}`);
    }

    const summaryDetail = data.summaryDetail || {};
    const defaultKeyStatistics = data.defaultKeyStatistics || {};
    const financialData = data.financialData || {};
    const assetProfile = data.assetProfile || {};
    const price = data.price || {};
    const earnings = data.earnings || {};

    return {
      symbol,
      name: price.longName || price.shortName || symbol,
      sector: assetProfile.sector || 'Unknown',
      industry: assetProfile.industry || 'Unknown',
      marketCap: safeNumber(price.marketCap, 0),
      trailingPE: safeNumber(summaryDetail.trailingPE),
      forwardPE: safeNumber(summaryDetail.forwardPE),
      pegRatio: safeNumber(defaultKeyStatistics.pegRatio),
      priceToBook: safeNumber(defaultKeyStatistics.priceToBook),
      priceToSales: safeNumber(summaryDetail.priceToSalesTrailing12Months),
      dividendYield: safeNumber(summaryDetail.dividendYield, 0),
      payoutRatio: safeNumber(summaryDetail.payoutRatio),
      beta: safeNumber(summaryDetail.beta),
      debtToEquity: safeNumber(financialData.debtToEquity),
      returnOnEquity: safeNumber(financialData.returnOnEquity),
      returnOnAssets: safeNumber(financialData.returnOnAssets),
      operatingMargins: safeNumber(financialData.operatingMargins),
      freeCashflow: safeNumber(financialData.freeCashflow),
      currentPrice: safeNumber(financialData.currentPrice) ?? safeNumber(price.regularMarketPrice, 0),
      targetMeanPrice: safeNumber(financialData.targetMeanPrice),
      revenueGrowth: safeNumber(financialData.revenueGrowth),
      earningsGrowth: safeNumber(financialData.earningsGrowth),
      grossMargins: safeNumber(financialData.grossMargins),
      profitMargins: safeNumber(financialData.profitMargins),
      revenueEstimate: safeNumber(earnings.revenueEstimate?.avg),
      epsEstimate: safeNumber(earnings.earningsEstimate?.avg)
    };
  }
}
