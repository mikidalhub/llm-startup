# Backend Plan: Autonomous Global Markets Analysis & Execution

## 1) Goals & Non-Goals
**Goals**
- Fully automated market analysis and execution workflow with disciplined risk management.
- Modular backend services for data ingestion, feature generation, model inference, portfolio construction, and trade execution.
- Prioritize capital preservation, long-term value creation, and risk-aware decisions.
- Keep AWS usage within free-tier/low-cost envelope while remaining production-ready.

**Non-Goals (initial phase)**
- High-frequency trading (HFT) or sub-second execution.
- Complex multi-asset derivatives or OTC products.

## 2) Core Constraints & Principles
- **Autonomy:** No human intervention in runtime decisions.
- **Explainability:** Every decision must have a traceable rationale (signals used, model outputs, risk checks).
- **Risk Controls First:** Trades only pass if all risk checks are satisfied.
- **Cost Efficiency:** Minimize infrastructure spend and vendor lock-in where possible.

## 3) High-Level Architecture
```
Data Sources -> Ingestion -> Normalization -> Feature Store ->
LLM/Model Layer -> Decision Engine -> Risk Engine ->
Order Management -> Execution -> Audit/Reporting
```

### Key Modules
1. **Data Ingestion Service**
   - Collect global market data, macroeconomic indicators, fundamentals, and news.
   - Daily/weekly batch + near-real-time updates (as required by strategy).

2. **Normalization & Validation**
   - Standardize time zones, currencies, and corporate actions.
   - Validate completeness and data quality.

3. **Feature Store**
   - Derived features: rolling returns, volatility, factor exposures, sector momentum, macro signals.

4. **LLM/Model Layer**
   - LLM used to summarize macro/news context and rank thematic signals.
   - Predictive models for returns/risk (statistical + ML).

5. **Decision Engine**
   - Combines model outputs into a target portfolio with allocation rules.
   - Encodes professional investment rules (drawdown limits, risk parity, concentration caps).

6. **Risk Engine**
   - Pre-trade and post-trade checks.
   - Stress tests and scenario analysis.

7. **Order Management & Execution**
   - Translate portfolio deltas into orders.
   - Broker API integration and reconciliation.

8. **Audit & Reporting**
   - Immutable logs of decisions, model versions, and orders.
   - Performance attribution and compliance reporting.

## 4) AWS (Free-Tier Friendly) Deployment Blueprint
**Goal:** Keep first version within AWS Free Tier or minimal spend.

### Compute
- **EC2 t3.micro (Free Tier):**
  - Host a small Docker Compose stack for services.
  - Use cron/systemd for scheduled jobs.
- **ECS (optional):** If complexity grows, migrate services to ECS Fargate (costs increase).

### Storage
- **S3 (Free Tier):**
  - Raw data dumps, model artifacts, reports.
- **RDS (Free Tier):**
  - PostgreSQL for structured data.
- **DynamoDB (Free Tier):**
  - Option for high-throughput key-value storage of signals.

### Messaging & Scheduling
- **EventBridge + Lambda (Free Tier):**
  - Schedule ingestion/analysis workflows.
  - Trigger evaluation cycles.

### Monitoring
- **CloudWatch (Free Tier):**
  - Logs, metrics, alarms.

### Security
- IAM roles with least privilege.
- Secrets stored in **AWS SSM Parameter Store** (free tier).

## 5) Service Breakdown (MVP)
| Service | Responsibility | Tech Stack |
| --- | --- | --- |
| Ingestion | Pull market & macro data | Python + cron |
| Feature Builder | Generate analytics/indicators | Python + Pandas |
| LLM Context | Summarize macro/news | LLM API + cache |
| Decision Engine | Portfolio construction | Python + NumPy |
| Risk Engine | Risk checks & constraints | Python |
| Execution | Broker API integration | Python |
| Audit/Reporting | Logs & summaries | PostgreSQL + S3 |

## 6) LLM Integration Plan
- **Use Case:** Translate macro/news into structured signals (e.g., sentiment scores, macro themes).
- **Prompting Strategy:**
  - Strict JSON outputs with schema validation.
  - Include explicit rules for determinism (temperature low).
- **Guardrails:**
  - Validate outputs before ingestion into decision pipeline.
  - Use fallback heuristics when LLM output fails validation.

## 7) Risk Management Rules (Example)
- Max portfolio drawdown: 10–15%.
- Max single position size: 5% of NAV.
- Sector exposure cap: 20%.
- Mandatory volatility targeting.
- Stop-loss and trailing risk controls.

## 8) Execution Workflow
1. Ingestion updates dataset.
2. Feature builder updates signals.
3. LLM summarizes macro/news context.
4. Decision engine proposes target portfolio.
5. Risk engine validates constraints.
6. Orders generated and executed via broker.
7. Audit logs stored and reports generated.

## 9) Observability & Alerts
- Drift detection: model output vs realized outcomes.
- Alerts on risk limit breaches, API errors, data gaps.
- Daily/weekly performance summary delivered via email/Slack.

## 10) MVP Phase Plan (4 Phases)
**Phase 1: Foundation (1–2 weeks)**
- Build ingestion + storage layer.
- Implement basic feature store.
- Set up EC2 + S3 + RDS.

**Phase 2: Core Intelligence (2–3 weeks)**
- Integrate LLM summarization service.
- Add baseline predictive signals.

**Phase 3: Decision & Risk (2–3 weeks)**
- Implement portfolio construction rules.
- Add risk checks + reporting.

**Phase 4: Execution & Monitoring (2–3 weeks)**
- Broker integration.
- Full automation with alerts and dashboards.

## 11) Local-First, Runnable MVP (First Task)
**Goal:** A minimal, locally runnable backend that simulates the full pipeline end-to-end with the least effort.

### Minimal Stack (Cutting-Edge but Simple)
- **Python 3.11 + FastAPI** for service APIs (lightweight, async-ready).
- **Docker Compose** to run services locally with one command.
- **PostgreSQL** for structured data (signals, portfolio, audit logs).
- **Redis** for task queues/caching (signals + LLM context cache).
- **Prefect (or Lite Cron)** for orchestration (start with cron-like schedules, migrate to Prefect workflows if needed).

### Local Services (MVP)
1. **ingestion-service**: Pulls sample market data (stubbed or from a free API), writes to Postgres/S3-local.
2. **feature-service**: Computes features (returns, volatility, momentum), stores results.
3. **llm-service**: Summarizes macro/news context (can be mocked locally, replace with real API later).
4. **decision-service**: Builds target portfolio from signals and LLM context.
5. **risk-service**: Applies constraints and returns pass/fail.
6. **execution-service**: Produces simulated trades and writes audit logs.

### Why This Meets “Least Effort”
- Single `docker compose up` brings everything up locally.
- Each service is a small FastAPI app with clear interfaces.
- LLM integration is mocked at first to avoid API costs.

### What “Cutting-Edge” Means Here
- Use **Pydantic v2** for strict validation.
- Use **async I/O** to scale cheaply later.
- Keep service boundaries so it can move to ECS/Lambda quickly.

## 12) Cost Minimization Checklist
- Prefer batch processing over always-on services.
- Use S3 for cold storage.
- Turn off EC2 outside of trading windows if possible.
- Use free-tier limits for RDS and Lambda.
- Cache LLM responses to reduce API calls.

## 13) Open Questions / Next Decisions
- Data providers (free vs paid) for global coverage.
- Broker API availability and compliance requirements.
- Regulatory constraints depending on jurisdiction.

---
This plan provides a backend blueprint that can start small (EC2 free tier) and grow into a scalable architecture as data volume and execution complexity increase.
