# Value Investing Decision Platform Blueprint

## 1) Full System Architecture
- **Ingestion Layer**: YahooClient fetches intraday prices (`5m/1d`) and long-range pricing/fundamentals (`1y/1d`).
- **Simulation Layer**: TradingEngine still runs the loop for simulation and portfolio accounting.
- **Intelligence Layer**:
  - `fundamentals/engine.js`
  - `analysis/value-model.js`
  - `risk/engine.js`
  - `dividends/analyzer.js`
  - `portfolio/brain.js`
  - `scanner/market-scanner.js`
  - `explainer/investment-explainer.js`
- **Delivery Layer**: HTTP API + SSE stream for dashboards and beginner experiences.

## 2) New Modules
- `data/yahoo-client.js`: quote summary + chart abstraction.
- `fundamentals/engine.js`: Fundamental Score (0–100).
- `analysis/value-model.js`: Buffett-style Value Score (0–100).
- `risk/engine.js`: volatility, drawdown, beta, concentration, and `LOW/MEDIUM/HIGH` output.
- `dividends/analyzer.js`: yield, payout, dividend strength, income projection.
- `portfolio/brain.js`: health meter, warnings, rebalancing ideas.
- `scanner/market-scanner.js`: S&P500/Nasdaq/Dividend list scanning and ranking.
- `explainer/investment-explainer.js`: human reasoning + traffic lights.

## 3) Database Structure (JSON-first, DB-ready)
Runtime is persisted in `results.json`. A relational migration can use:
- `companies(ticker PK, name, sector, industry, market_cap)`
- `fundamental_snapshots(id PK, ticker FK, as_of, pe, fwd_pe, peg, pfcf, debt_equity, roe, roic, rev_growth, eps_growth, fcf_growth, div_yield, div_growth, fundamental_score)`
- `risk_snapshots(id PK, ticker FK, as_of, volatility, drawdown, beta, correlation, concentration, risk_label, risk_number)`
- `dividend_snapshots(id PK, ticker FK, as_of, yield, payout_ratio, div_growth_score, div_score, annual_income_projection)`
- `portfolio_states(id PK, as_of, cash, total_value, pnl, return_pct, sharpe, health_score)`
- `daily_briefs(id PK, as_of, market_overview, top_opportunities_json, warnings_json, dividend_update_json)`

## 4) API Endpoints
- Existing:
  - `/api/state`
  - `/trades`
  - `/portfolio`
  - `/events`
- New:
  - `/opportunities`
  - `/company/:ticker`
  - `/analysis/:ticker`
  - `/dividends`
  - `/risk`
  - `/daily-brief`

## 5) Data Pipeline
1. Scheduler tick runs pricing updates and portfolio simulation.
2. On-demand analysis endpoints call Yahoo fundamentals + 1y price history.
3. Engines compute scores and explanations.
4. Scanner ranks opportunities across predefined universes.
5. Daily briefing combines opportunities, risk warnings, and dividend income updates.

## 6) Investment Scoring Formulas
- **Fundamental Score** =
  - 30% valuation (PE/Fwd PE/PEG/PFCF)
  - 30% quality (ROE/ROIC/Debt)
  - 25% growth (Revenue/EPS/FCF growth)
  - 15% income (Yield/Dividend growth)
- **Value Score** = weighted blend of cashflow strength, debt discipline, earnings stability, moat proxy, dividend culture, valuation.
- **Risk Number (0–100)** = volatility + drawdown + beta premium + position concentration + sector concentration.
- **Risk Label**:
  - `LOW` < 35
  - `MEDIUM` 35–64.9
  - `HIGH` >= 65
- **Investment Score** = 40% value + 25% quality + 20% dividend + 15% inverse-risk.

## 7) Example Outputs
- **Company Health Card**:
  - Name, Sector, Price
  - Value Score
  - Quality Score
  - Risk Score
  - Dividend Score
  - Beginner traffic lights
  - Plain-English explanation
- **Daily Brief**:
  - Market overview sentence
  - Top 3 opportunities with reasons
  - Portfolio warnings
  - Dividend income monthly/annual projection

## 8) UI Concept
4 panel dashboard:
1. Portfolio Health Meter (0–100)
2. Top Opportunities cards
3. Dividend Income Tracker (monthly + annual)
4. Market Signals (risk + scan trends)

## 9) Beginner UX Design
- Traffic-light indicators: Green/Yellow/Red for Value, Quality, Risk, Income.
- One-sentence explanation per decision.
- Avoid jargon in primary UI; advanced metrics hidden in “Learn more”.
- Tooltips translate metrics:
  - PE: "How expensive the stock is vs profit"
  - Debt/Equity: "How much debt the company carries"
  - Dividend Yield: "Cash paid to shareholders each year"

## 10) Future Roadmap
- Add FRED macro overlays (rates, inflation, unemployment) for context.
- Add recurring-investment planner (DCA assistant).
- Add tax-aware income planner.
- Add educator mode with mini lessons and quizzes.
- Add portfolio stress tests by recession / rate-shock scenarios.
