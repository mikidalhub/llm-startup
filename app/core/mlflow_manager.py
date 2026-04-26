from __future__ import annotations

import os
from typing import Any

import mlflow
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "file:./mlruns")
EXPERIMENT_NAME = os.getenv("MLFLOW_EXPERIMENT_NAME", "existing_project_dev")

app = FastAPI(title="MLflow Observability Manager", version="1.0.0")
_ACTIVE_RUNS: dict[str, str] = {}


class StartPromptRunRequest(BaseModel):
    endpoint_name: str = "/api/process/start"
    user_prompt: str = ""
    selected_model: str | None = None
    provider: str = "openrouter"
    environment: str = "dev"


class LogPromptResponseRequest(BaseModel):
    response_text: str = ""
    latency_seconds: float = 0.0


class LogPromptErrorRequest(BaseModel):
    error_message: str = "unknown_error"


def initialize_mlflow() -> None:
    mlflow.set_tracking_uri(TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT_NAME)


def start_prompt_run(
    *,
    endpoint_name: str,
    user_prompt: str,
    selected_model: str | None = None,
    provider: str = "openrouter",
    environment: str = "dev",
) -> str:
    initialize_mlflow()
    run = mlflow.start_run(run_name=endpoint_name)
    run_id = run.info.run_id
    _ACTIVE_RUNS[run_id] = endpoint_name
    mlflow.set_tags({"endpoint": endpoint_name, "provider": provider, "environment": environment})
    mlflow.log_param("user_prompt", user_prompt)
    if selected_model:
        mlflow.log_param("selected_model", selected_model)
    return run_id


def _attach_run(run_id: str) -> None:
    if not run_id:
        raise HTTPException(status_code=400, detail="run_id is required")
    mlflow.start_run(run_id=run_id)


def log_prompt_response(*, run_id: str, response_text: str, latency_seconds: float) -> None:
    _attach_run(run_id)
    mlflow.log_metric("latency_seconds", float(latency_seconds))
    mlflow.log_metric("response_length_chars", float(len(response_text or "")))


def log_prompt_success(*, run_id: str) -> None:
    _attach_run(run_id)
    mlflow.set_tag("status", "success")


def log_prompt_error(*, run_id: str, error_message: str) -> None:
    _attach_run(run_id)
    mlflow.set_tag("status", "failed")
    mlflow.set_tag("error_message", str(error_message)[:500])


def end_prompt_run(*, run_id: str) -> None:
    _attach_run(run_id)
    mlflow.end_run()
    _ACTIVE_RUNS.pop(run_id, None)


def get_active_run_id() -> str | None:
    active = mlflow.active_run()
    return active.info.run_id if active else None


@app.post("/initialize")
def initialize() -> dict[str, Any]:
    initialize_mlflow()
    return {"ok": True, "tracking_uri": TRACKING_URI, "experiment": EXPERIMENT_NAME}


@app.post("/prompt-runs/start")
def start_run(payload: StartPromptRunRequest) -> dict[str, Any]:
    run_id = start_prompt_run(
        endpoint_name=payload.endpoint_name,
        user_prompt=payload.user_prompt,
        selected_model=payload.selected_model,
        provider=payload.provider,
        environment=payload.environment,
    )
    return {"ok": True, "run_id": run_id}


@app.post("/prompt-runs/{run_id}/response")
def add_response(run_id: str, payload: LogPromptResponseRequest) -> dict[str, Any]:
    log_prompt_response(run_id=run_id, response_text=payload.response_text, latency_seconds=payload.latency_seconds)
    return {"ok": True}


@app.post("/prompt-runs/{run_id}/success")
def mark_success(run_id: str) -> dict[str, Any]:
    log_prompt_success(run_id=run_id)
    return {"ok": True}


@app.post("/prompt-runs/{run_id}/error")
def mark_error(run_id: str, payload: LogPromptErrorRequest) -> dict[str, Any]:
    log_prompt_error(run_id=run_id, error_message=payload.error_message)
    return {"ok": True}


@app.post("/prompt-runs/{run_id}/end")
def end_run(run_id: str) -> dict[str, Any]:
    end_prompt_run(run_id=run_id)
    return {"ok": True}


@app.get("/active-run-id")
def active_run_id() -> dict[str, Any]:
    return {"ok": True, "run_id": get_active_run_id()}
