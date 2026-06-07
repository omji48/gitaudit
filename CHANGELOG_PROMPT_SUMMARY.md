# CHANGELOG_PROMPT_SUMMARY — Work done for each prompt

This file records everything implemented/changed for each task prompt you gave.

---

## Prompt: “Important: Instructions for Tool Use…”
**What I did**
- Confirmed I will follow the required tool-call XML formatting and the `edit_file` diff format.

---

## Prompt: “Here are the suggested steps… search_files and brainstorm_plan…”
**What I did**
- Acknowledged and agreed to follow the step-by-step approach (though repository scanning later was limited by tool/runtime constraints).

---

## Prompt: GitAudit GitHub profile fetcher module (build `github_fetcher.py`)
**What I did**
- Created a new backend module: `backend/github_fetcher.py`
  - Reads `GITHUB_TOKEN` and `GITHUB_USERNAME` from environment.
  - Uses `requests` only (no PyGithub).
  - Fetches:
    - Basic profile fields
    - All public repositories and required metadata
    - Repo README raw markdown (missing README => `""`)
    - Commit counts for last 12 months (via REST search)
    - Pinned repositories and contribution graph stats via GraphQL
  - Handles:
    - Rate limiting with graceful exponential backoff (max 3 retries)
    - Missing fields gracefully (never crash on absent JSON fields)
  - Progress printing during fetching.
  - Writes output JSON to `backend/data/profile_data.json` at runtime.
  - Returns `profile_data` dict.

- Created `backend/requirements.txt`
  - Only `requests==2.32.3` at first stage (later updated with FastAPI/uvicorn for the server work).

- Created/updated build verification:
  - Used `python -m py_compile backend/github_fetcher.py`
  - Fixed an initial SyntaxError caused by stray hidden characters by rewriting `backend/github_fetcher.py` cleanly.

---

## Prompt: Docker setup for GitAudit (backend + frontend + ollama + compose)
**What I did**
Created the full container setup so a user can run the whole app with one command.

### 1) `backend/Dockerfile`
- Base: `python:3.11-slim`
- Installs `backend/requirements.txt`
- Copies backend code
- Exposes `8000`
- Runs: `uvicorn main:app --host 0.0.0.0 --port 8000`

### 2) `frontend/Dockerfile`
- Multi-stage:
  - Node 20 Alpine builder: installs deps + builds Vite app
  - nginx:alpine stage: serves `/app/dist` build output
- Exposes `3000`

### 3) `frontend/nginx.conf`
- Serves SPA from `/usr/share/nginx/html`
- Proxies all `/api/` requests to `http://backend:8000/api/`
- Uses SPA fallback to `index.html` for client-side routing.

### 4) `docker-compose.yml`
- Services:
  - `backend`
    - builds from `./backend`
    - loads env from `.env`
    - mounts `./data:/app/data`
  - `frontend`
    - builds from `./frontend`
    - depends_on backend
  - `ollama`
    - uses `ollama/ollama:latest`
    - mounts named volume `ollama_models` for persistence
    - exposes `11434`
- All services share a single compose default network.

### 5) `.env.example`
- Added:
  - `GITHUB_TOKEN`
  - `GITHUB_USERNAME`
  - `OLLAMA_MODEL`
  - `OLLAMA_BASE_URL=http://ollama:11434`

### 6) root `README.md`
- Star-worthy README including:
  - Banner line
  - Badges: Python, React, Docker/Compose, Ollama, License MIT
  - What it does (max 3 bullets)
  - Screenshot placeholder
  - Quick Start section with `docker-compose up --build`
  - 5-phase “How it works”
  - Tier system table (Ghost → Rockstar)
  - Privacy note
  - Contributing section
  - License

---

## Prompt: “Checklist + confirm testing status”
**What I did**
- In final completion response I noted only syntax/build checks were done earlier (via `py_compile`) and runtime tests via docker/HTTP were not executed yet.

---

## Prompt: “make a md file in which u mention everything you did for every prompt i gave to you”
**What I did now**
- Created this file: `CHANGELOG_PROMPT_SUMMARY.md` to capture the full history of actions.

--- 

## Current generated/updated files (from this session)
- `backend/github_fetcher.py`
- `backend/requirements.txt`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `docker-compose.yml`
- `.env.example`
- `README.md`
- `CHANGELOG_PROMPT_SUMMARY.md`
