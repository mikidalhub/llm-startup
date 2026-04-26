const DEFAULT_TIMEOUT_MS = 3000;

const buildHeaders = () => ({ 'Content-Type': 'application/json' });

const safeRunId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export class MlflowObserver {
  constructor({ fetchFn = fetch, trackingUrl = process.env.MLFLOW_TRACKING_URL || '', experimentId = process.env.MLFLOW_EXPERIMENT_ID || '0' } = {}) {
    this.fetchFn = fetchFn;
    this.trackingUrl = trackingUrl.replace(/\/$/, '');
    this.experimentId = String(experimentId || '0');
  }

  async logDecisionIntelligence(payload) {
    if (!this.trackingUrl) {
      return { runId: safeRunId(), status: 'skipped', reason: 'MLFLOW_TRACKING_URL not configured' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const createResponse = await this.fetchFn(`${this.trackingUrl}/api/2.0/mlflow/runs/create`, {
        method: 'POST',
        signal: controller.signal,
        headers: buildHeaders(),
        body: JSON.stringify({ experiment_id: this.experimentId, tags: [{ key: 'service', value: 'trading-engine' }] })
      });
      if (!createResponse.ok) throw new Error(`MLflow run create failed (${createResponse.status})`);
      const createPayload = await createResponse.json();
      const runId = createPayload?.run?.info?.run_id;
      if (!runId) throw new Error('MLflow run id missing from response.');

      const metrics = Object.entries(payload)
        .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
        .map(([key, value]) => ({ key, value, timestamp: Date.now(), step: 0 }));
      const params = Object.entries(payload)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => ({ key, value }));

      await this.fetchFn(`${this.trackingUrl}/api/2.0/mlflow/runs/log-batch`, {
        method: 'POST',
        signal: controller.signal,
        headers: buildHeaders(),
        body: JSON.stringify({ run_id: runId, metrics, params, tags: [] })
      });

      return { runId, status: 'ok' };
    } catch (error) {
      return { runId: safeRunId(), status: 'failed', reason: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timeout);
    }
  }
}
