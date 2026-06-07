"""
FastAPI server for GitAudit.

Endpoints:
- POST /api/run
  Starts pipeline orchestrator in a background thread (only one run at a time).
- GET /api/status
  Returns data/pipeline_status.json
- GET /api/results
  Returns data/final_score.json (404 if not ready)
- GET /api/health
  Returns {"ollama": bool, "github": bool}

CORS enabled for http://localhost:3000.
"""

import os
import threading
from typing import Any, Dict

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import backend.orchestrator as orchestrator

PIPELINE_STATUS_PATH = os.path.join("data", "pipeline_status.json")
FINAL_SCORE_PATH = os.path.join("data", "final_score.json")

app = FastAPI(title="GitAudit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Track the background thread for "only one pipeline run at a time".
_background_thread = None
_thread_lock = threading.Lock()


def _safe_read_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            import json
            return json.load(f)
    except Exception:
        return {}


def _github_health(token):
    if not token:
        return False
    url = "https://api.github.com/user"
    headers = {
        "Authorization": "token " + token,
        "Accept": "application/vnd.github+json",
        "User-Agent": "GitAudit-healthcheck",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        return 200 <= resp.status_code < 300
    except Exception:
        return False


def _ollama_health(base_url):
    if not base_url:
        return False
    is_openai_format = "/v1" in base_url
    
    headers = {}
    api_key = (os.getenv("OLLAMA_API_KEY") or "").strip()
    if api_key:
        headers["Authorization"] = "Bearer " + api_key

    if is_openai_format:
        url = base_url.rstrip("/") + "/models"
    else:
        url = base_url.rstrip("/") + "/api/tags"

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        return 200 <= resp.status_code < 300
    except Exception:
        return False


from pydantic import BaseModel
from typing import Optional

class RunRequest(BaseModel):
    username: str
    token: Optional[str] = ""
    model: Optional[str] = ""

@app.post("/api/run")
def api_run(req: RunRequest):
    global _background_thread

    with _thread_lock:
        if orchestrator.is_running():
            return JSONResponse({"started": False, "reason": "already running"})

        if _background_thread is not None and getattr(_background_thread, "is_alive", lambda: False)():
            return JSONResponse({"started": False, "reason": "already running"})

        # Override environment variables for this run
        if req.username:
            os.environ["GITHUB_USERNAME"] = req.username
        if req.token:
            os.environ["GITHUB_TOKEN"] = req.token
        if req.model:
            os.environ["OLLAMA_MODEL"] = req.model

        # Reset status synchronously to prevent frontend race conditions
        orchestrator._update_status(
            step="fetching",
            steps_done=[],
            status="running",
            error=None,
            completed=False
        )

        def _target():
            orchestrator.run_pipeline()

        t = threading.Thread(target=_target, daemon=True)
        _background_thread = t

        try:
            t.start()
        except Exception:
            return JSONResponse({"started": False, "reason": "failed to start thread"})

        return JSONResponse({"started": True})


@app.get("/api/status")
def api_status():
    if not os.path.exists(PIPELINE_STATUS_PATH):
        return JSONResponse(
            {
                "step": "scoring",
                "steps_done": [],
                "status": "idle",
                "error": None,
                "completed": False,
            }
        )
    return JSONResponse(_safe_read_json(PIPELINE_STATUS_PATH))


@app.get("/api/results")
def api_results():
    if not os.path.exists(FINAL_SCORE_PATH):
        raise HTTPException(status_code=404, detail="Results not ready")
    return JSONResponse(_safe_read_json(FINAL_SCORE_PATH))


@app.get("/api/health")
def api_health():
    github_token = (os.getenv("GITHUB_TOKEN") or "").strip()
    ollama_base_url = (os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434").strip()

    return JSONResponse(
        {
            "ollama": _ollama_health(ollama_base_url),
            "github": _github_health(github_token),
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
