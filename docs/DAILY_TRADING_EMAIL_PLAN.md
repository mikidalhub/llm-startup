# Daily Trading Process Email Plan

## Goal
Send one daily email that summarizes the autonomous trading process in clear business language.

## Audience
- Primary: founder/operator
- Secondary: technical team, compliance reviewer

## Recommended schedule
- Send once per market day at **22:00 UTC** (after U.S. regular session processing).
- Retry once after 15 minutes if provider fails.

## Email content structure
1. **Subject**
   - `Daily Trading Process Report — {{date}}`
2. **Top summary**
   - Portfolio value
   - Day-over-day change
   - Risk posture (low/medium/high)
3. **Execution snapshot**
   - Number of ticks run
   - Number of symbols scanned
   - BUY/SELL/HOLD counts
4. **Notable events**
   - Errors/warnings from process stream
   - Any fallback mode activation
5. **Top 3 trades**
   - Symbol, side, qty, price, timestamp
6. **Attachments/links**
   - Link to dashboard
   - Optional JSON artifact URL (if published)

## Data sources in current app
- `/api/results`
- `/api/trades`
- `/api/state`
- Process events from `/events`

## Delivery architecture (phased)

### Phase 1 (fastest)
- Create a scheduled GitHub Action (cron).
- Action calls backend APIs and composes markdown/plaintext email.
- Send through provider API (e.g., SendGrid/Postmark/SES).

### Phase 2 (recommended for reliability)
- Move scheduler to Cloud Scheduler + Cloud Run Job.
- Persist send logs to Firestore/BigQuery for auditability.

### Phase 3 (compliance + analytics)
- Add delivery metrics (sent, bounced, opened).
- Add audit trail and immutable run IDs.

## API contract needed for email job
- Stable JSON shape for:
  - `portfolioValue`
  - `trades[]`
  - `signals[]`
  - status/risk summary
- Date/time fields in ISO-8601 UTC.

## Operational safeguards
- Idempotency key: `daily-report-{{yyyy-mm-dd}}` to prevent duplicate sends.
- Timeout and retry policy per API call.
- Fallback email with partial data if one endpoint fails.

## Security
- Store provider API keys in secret manager/GitHub secrets.
- Use least-privilege service accounts.
- Redact any sensitive keys from report body.

## Rollout checklist
1. Confirm backend API origin reachable from scheduler.
2. Validate report output for one dry run.
3. Enable production schedule.
4. Add alert on send failure.
