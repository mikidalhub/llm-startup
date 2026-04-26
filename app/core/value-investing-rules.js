const clamp = (value, min = 0, max = 100) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
};

const ratioToScore = ({ value, low, high, invert = false }) => {
  if (!Number.isFinite(Number(value))) return null;
  const numeric = Number(value);
  if (numeric <= low) return invert ? 0 : 100;
  if (numeric >= high) return invert ? 100 : 0;
  const ratio = (numeric - low) / (high - low);
  return invert ? clamp(ratio * 100) : clamp((1 - ratio) * 100);
};

const percentToScore = ({ value, low = 0, high = 0.3 }) => {
  if (!Number.isFinite(Number(value))) return null;
  const numeric = Number(value);
  if (numeric <= low) return 0;
  if (numeric >= high) return 100;
  return clamp(((numeric - low) / (high - low)) * 100);
};

const weightedAverage = (entries, fallback = 50) => {
  const valid = entries.filter((entry) => Number.isFinite(entry.score));
  if (!valid.length) return fallback;
  const totalWeight = valid.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const weighted = valid.reduce((sum, entry) => sum + entry.score * entry.weight, 0);
  return clamp(weighted / totalWeight);
};

export const VALUE_INVESTING_WEIGHTS = {
  valuationScore: 0.28,
  businessQualityScore: 0.22,
  financialHealthScore: 0.22,
  growthScore: 0.13,
  riskScore: 0.15
};

export const computeValuationScore = (quote) => weightedAverage([
  { score: ratioToScore({ value: quote?.trailingPE, low: 8, high: 35 }), weight: 0.3 },
  { score: ratioToScore({ value: quote?.forwardPE, low: 8, high: 32 }), weight: 0.2 },
  { score: ratioToScore({ value: quote?.priceToBook, low: 1, high: 8 }), weight: 0.2 },
  { score: ratioToScore({ value: quote?.priceToSales, low: 1, high: 12 }), weight: 0.15 },
  { score: ratioToScore({ value: quote?.pegRatio, low: 0.8, high: 3.5 }), weight: 0.15 }
], 45);

export const computeBusinessQualityScore = (quote) => weightedAverage([
  { score: percentToScore({ value: quote?.returnOnEquity, low: 0.05, high: 0.25 }), weight: 0.35 },
  { score: percentToScore({ value: quote?.returnOnAssets, low: 0.02, high: 0.12 }), weight: 0.2 },
  { score: percentToScore({ value: quote?.operatingMargins, low: 0.08, high: 0.32 }), weight: 0.25 },
  { score: percentToScore({ value: quote?.profitMargins, low: 0.05, high: 0.22 }), weight: 0.2 }
], 50);

export const computeFinancialHealthScore = (quote) => weightedAverage([
  { score: ratioToScore({ value: quote?.debtToEquity, low: 20, high: 240 }), weight: 0.5 },
  { score: percentToScore({ value: quote?.freeCashflow, low: 0, high: 2_000_000_000 }), weight: 0.2 },
  { score: percentToScore({ value: quote?.currentRatio, low: 1, high: 2.5 }), weight: 0.15 },
  { score: ratioToScore({ value: quote?.beta, low: 0.7, high: 2.2 }), weight: 0.15 }
], 45);

export const computeGrowthScore = (quote) => weightedAverage([
  { score: percentToScore({ value: quote?.revenueGrowth, low: -0.05, high: 0.25 }), weight: 0.45 },
  { score: percentToScore({ value: quote?.earningsGrowth, low: -0.1, high: 0.3 }), weight: 0.45 },
  { score: ratioToScore({ value: quote?.pegRatio, low: 0.8, high: 3.5 }), weight: 0.1 }
], 50);

export const computeRiskScore = (quote, snapshot) => weightedAverage([
  { score: ratioToScore({ value: quote?.beta, low: 0.7, high: 2.4 }), weight: 0.5 },
  { score: ratioToScore({ value: quote?.debtToEquity, low: 20, high: 260 }), weight: 0.25 },
  { score: ratioToScore({ value: snapshot?.rsi, low: 30, high: 75 }), weight: 0.25 }
], 45);

export const normalizedScore = (score) => Number(clamp(score, 0, 100).toFixed(2));

export const safePrice = (value, fallback = null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
};

export const isMissingData = (quote) => {
  const required = [quote?.trailingPE, quote?.priceToBook, quote?.debtToEquity, quote?.returnOnEquity, quote?.currentPrice];
  const validCount = required.filter((item) => Number.isFinite(Number(item))).length;
  return validCount < 3;
};
