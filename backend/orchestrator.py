"""
GitAudit pipeline orchestrator.

Runs modules in this exact order (fully, sequentially):
1) github_fetcher.py
2) ollama_engine.py
3) scoring_engine.py

Tracks pipeline status in:
  data/pipeline_status.json

Schema:
{
  "step": "scoring",
  "steps_done": ["fetching", "analyzing"],
  "status": "running",
  "error": null,
  "completed": false
}

If any step fails:
- write error to pipeline_status.json
- stop the pipeline
"""

from __future__ import annotations

import json
import os
import threading
from typing import Any, Dict, Optional

from backend import github_fetcher, ollama_engine, scoring_engine

PIPELINE_STATUS_PATH = os.path.join("data", "pipeline_status.json")

# Global lock + state to enforce "only one pipeline run at a time".
_PIPELINE_LOCK = threading.Lock()
_IS_RUNNING = False


def is_running() -> bool:
    return _IS_RUNNING


def _set_running_state(running: bool) -> None:
    global _IS_RUNNING
    _IS_RUNNING = running


def _safe_write_json(path: str, payload: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def _update_status(
    *,
    step: str,
    steps_done: list,
    status: str,
    error: Optional[str],
    completed: bool,
) -> None:
    _safe_write_json(
        PIPELINE_STATUS_PATH,
        {
            "step": step,
            "steps_done": steps_done,
            "status": status,
            "error": error,
            "completed": completed,
        },
    )


def run_pipeline() -> bool:
    """
    Runs the pipeline sequentially.
    Returns True if completed successfully, False otherwise.
    """
    acquired = _PIPELINE_LOCK.acquire(blocking=False)
    if not acquired:
        return False

    try:
        _set_running_state(True)

        steps_done = []
        _update_status(
            step="fetching",
            steps_done=steps_done,
            status="running",
            error=None,
            completed=False,
        )

        # 1) github_fetcher
        try:
            steps_done = ["fetching"]
            _update_status(
                step="fetching",
                steps_done=steps_done,
                status="running",
                error=None,
                completed=False,
            )
            github_fetcher.fetch_profile_data()
        except Exception as e:
            _update_status(
                step="fetching",
                steps_done=steps_done,
                status="failed",
                error=str(e),
                completed=False,
            )
            return False

        # 2) ollama_engine
        try:
            steps_done = ["fetching", "analyzing"]
            _update_status(
                step="analyzing",
                steps_done=steps_done,
                status="running",
                error=None,
                completed=False,
            )
            ollama_engine.fetch_and_analyze_profile()
        except Exception as e:
            _update_status(
                step="analyzing",
                steps_done=steps_done,
                status="failed",
                error=str(e),
                completed=False,
            )
            return False

        # 3) scoring_engine
        try:
            _update_status(
                step="scoring",
                steps_done=steps_done,
                status="running",
                error=None,
                completed=False,
            )
            scoring_engine.score_profile()
        except Exception as e:
            _update_status(
                step="scoring",
                steps_done=steps_done,
                status="failed",
                error=str(e),
                completed=False,
            )
            return False

        # completed
        _update_status(
            step="scoring",
            steps_done=steps_done,
            status="success",
            error=None,
            completed=True,
        )
        return True
    finally:
        _set_running_state(False)
        _PIPELINE_LOCK.release()
