- [x] Create backend/requirements.txt (requests only)
- [x] Create backend/github_fetcher.py implementing GitHub profile fetcher
- [x] Verify output schema + error handling (missing README/fields, rate limiting retries)
- [x] Run python -m py_compile on backend/github_fetcher.py

- [x] Create backend/ollama_engine.py
- [x] Run python -m py_compile on backend/ollama_engine.py
- [x] Create backend/scoring_engine.py
- [x] Run python -m py_compile on backend/scoring_engine.py

- [x] Create backend/orchestrator.py (fetcher -> ollama -> scoring, sequential)
- [x] Create backend/main.py (FastAPI server + endpoints)
- [x] Update backend/requirements.txt (fastapi + uvicorn)

- [ ] Critical-path runtime test:
  - Start server with uvicorn
  - Call /api/health
  - Call /api/run
  - Poll /api/status until completed
  - Fetch /api/results (validate JSON shape)

- [ ] Edge-case test:
  - Call /api/run twice quickly and confirm second returns {started:false, reason:"already running"}

- [ ] Failure-path test:
  - Provide invalid OLLAMA_BASE_URL / bad token
  - Confirm orchestrator writes error to data/pipeline_status.json and stops
