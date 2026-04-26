const DEFAULT_ENDPOINT = '/api/process/start';

const defaultBaseUrl = process.env.MLFLOW_FASTAPI_URL || 'http://127.0.0.1:8001';

export class MlflowManager {
  constructor({ baseUrl = defaultBaseUrl, enabled = process.env.MLFLOW_ENABLED !== 'false' } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.enabled = enabled;
    this.activeRunId = null;
  }

  async _request(path, { method = 'GET', body } = {}) {
    if (!this.enabled) return { ok: false, disabled: true };

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const text = await response.text();
        return { ok: false, error: text || `${response.status}` };
      }

      return await response.json();
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async initialize_mlflow() {
    const result = await this._request('/initialize', { method: 'POST' });
    if (!result?.ok && !result?.disabled) {
      console.warn(`MLflow FastAPI unavailable, observability disabled: ${result.error}`);
      this.enabled = false;
    }
  }

  async start_prompt_run({ endpointName = DEFAULT_ENDPOINT, userPrompt = '', selectedModel = '' } = {}) {
    const result = await this._request('/prompt-runs/start', {
      method: 'POST',
      body: {
        endpoint_name: endpointName,
        user_prompt: String(userPrompt),
        selected_model: String(selectedModel || ''),
        provider: 'openrouter',
        environment: 'dev'
      }
    });

    if (result?.ok && result.run_id) this.activeRunId = result.run_id;
    return this.activeRunId;
  }

  async log_prompt_response({ responseText = '', latencySeconds = 0, runId = this.activeRunId } = {}) {
    if (!runId) return;
    await this._request(`/prompt-runs/${runId}/response`, {
      method: 'POST',
      body: {
        response_text: String(responseText),
        latency_seconds: Number(latencySeconds) || 0
      }
    });
  }

  async log_prompt_success({ runId = this.activeRunId } = {}) {
    if (!runId) return;
    await this._request(`/prompt-runs/${runId}/success`, { method: 'POST' });
  }

  async log_prompt_error({ errorMessage = 'unknown_error', runId = this.activeRunId } = {}) {
    if (!runId) return;
    await this._request(`/prompt-runs/${runId}/error`, {
      method: 'POST',
      body: { error_message: String(errorMessage) }
    });
  }

  async end_prompt_run({ runId = this.activeRunId } = {}) {
    if (!runId) return;
    await this._request(`/prompt-runs/${runId}/end`, { method: 'POST' });
    if (runId === this.activeRunId) this.activeRunId = null;
  }

  get_active_run_id() {
    return this.activeRunId;
  }
}
