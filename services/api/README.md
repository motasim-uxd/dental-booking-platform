# FastAPI backend (domain + adapters)

This service will host the platform business logic (booking APIs, workflow engine, PMS adapters).

## Local dev

1. Create a Python venv (3.11+ recommended) and install deps:

```bash
cd services/api
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt
```

2. Configure environment (example):

```env
FASTAPI_PORT=8001
S2S_SHARED_SECRET=dev-secret-change-me
```

3. Run the API:

```bash
./.venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Health check: `GET /health`

