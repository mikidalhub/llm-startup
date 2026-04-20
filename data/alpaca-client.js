const safeNumber = (value, fallback = null) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return fallback;
};

const timeframeMap = {
  '5m': '5Min',
  '1d': '1Day'
};

const rangeToStartDate = (range) => {
  const now = new Date();
  const start = new Date(now);
  if (range === '1d') start.setDate(now.getDate() - 1);
  else if (range === '1mo') start.setMonth(now.getMonth() - 1);
  else start.setFullYear(now.getFullYear() - 1);
  return start.toISOString();
};

export class AlpacaClient {
  constructor({ fetchImpl = fetch } = {}) {
    this.fetchImpl = fetchImpl;
    this.dataBaseUrl = process.env.ALPACA_DATA_URL || 'https://data.alpaca.markets';
    this.tradingBaseUrl = process.env.ALPACA_TRADING_URL || 'https://paper-api.alpaca.markets';
    this.apiKey = process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || '';
    this.apiSecret = process.env.ALPACA_SECRET_KEY || process.env.APCA_API_SECRET_KEY || '';
  }

  buildHeaders() {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Missing Alpaca credentials. Set ALPACA_API_KEY/APCA_API_KEY_ID and ALPACA_SECRET_KEY/APCA_API_SECRET_KEY.');
    }

    return {
      'APCA-API-KEY-ID': this.apiKey,
      'APCA-API-SECRET-KEY': this.apiSecret
    };
  }

  async fetchJson(url) {
    const response = await this.fetchImpl(url, { headers: this.buildHeaders() });
    if (!response.ok) {
      throw new Error(`Alpaca request failed (${response.status}) for ${url}`);
    }

    return response.json();
  }

  async getChart(symbol, { range = '1y', interval = '1d' } = {}) {
    const timeframe = timeframeMap[interval] || '1Day';
    const start = rangeToStartDate(range);
    const end = new Date().toISOString();
    const endpoint = `${this.dataBaseUrl}/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${timeframe}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&limit=1000&adjustment=raw&feed=iex`;
    const payload = await this.fetchJson(endpoint);
    const bars = payload?.bars || [];

    return {
      symbol,
      closes: bars.map((bar) => safeNumber(bar.c, 0)).filter((value) => Number.isFinite(value) && value > 0),
      volumes: bars.map((bar) => safeNumber(bar.v, 0)),
      timestamps: bars.map((bar) => bar.t)
    };
  }

  async getQuoteSummary(symbol) {
    const [asset, latestTrade] = await Promise.all([
      this.fetchJson(`${this.tradingBaseUrl}/v2/assets/${encodeURIComponent(symbol)}`).catch(() => null),
      this.fetchJson(`${this.dataBaseUrl}/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=iex`).catch(() => null)
    ]);

    const price = safeNumber(latestTrade?.trade?.p, 0);

    return {
      symbol,
      name: asset?.name || symbol,
      sector: 'Unknown',
      industry: 'Unknown',
      marketCap: null,
      trailingPE: null,
      forwardPE: null,
      pegRatio: null,
      priceToBook: null,
      priceToSales: null,
      dividendYield: 0,
      payoutRatio: null,
      beta: 1,
      debtToEquity: null,
      returnOnEquity: null,
      returnOnAssets: null,
      operatingMargins: null,
      freeCashflow: null,
      currentPrice: price,
      targetMeanPrice: null,
      revenueGrowth: null,
      earningsGrowth: null,
      grossMargins: null,
      profitMargins: null,
      revenueEstimate: null,
      epsEstimate: null
    };
  }
}
