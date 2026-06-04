# FastAPI backend (local dev)

This repo now contains a FastAPI backend under `services/api/`. Next.js should call FastAPI server-to-server using a shared secret.

## 1) Configure env

Add these to `.env.local` (or export in your shell):

```env
FASTAPI_BASE_URL=http://localhost:8001
S2S_SHARED_SECRET=dev-secret-change-me

Docker Compose reads **`.env`** (not `.env.local`). Copy `S2S_SHARED_SECRET` into `.env` so the `fastapi` container matches Next.js.
```

## 2) Run FastAPI

### Option A: Docker Compose (recommended)

From repo root:

```bash
docker compose up -d fastapi
```

### Option B: Python venv

```bash
cd services/api
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt
./.venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## 3) Verify from Next.js

Start Next.js as usual (`npm run dev`), then hit:

- `GET /api/internal/fastapi-health`
- `POST /api/internal/fastapi-booking` (proxy to FastAPI `POST /v1/booking`)

FastAPI (S2S, port 8001) — **middleware hub** per architecture diagram:

| Endpoint | Layer |
|----------|--------|
| `GET /health` | Health |
| `POST /v1/booking` | PMS connectors + SQS writeback + notifications |
| `GET /v1/availability` | Scheduling engine |
| `POST /v1/faq/escalate` | Nova Micro SLM |
| `POST /v1/faq/premium` | Claude premium |

Next BFF proxies: `/api/internal/faq-escalate`, `/api/internal/faq-premium` ([lex-faq-escalation.md](./lex-faq-escalation.md)).

Expected:

```json
{ "ok": true }
```

### Example booking request (Next.js -> FastAPI)

You can send a minimal test payload like:

```json
{
  "tenant_slug": "smilesquad",
  "channel": "web",
  "idempotency_key": "test-00000001",
  "payload": {
    "oryxRealm": "smilesquadpd",
    "date": { "year": 2026, "month": 6, "day": 2 },
    "start": { "hour": 9, "minute": 0, "second": 0, "millis": 0 },
    "end": { "hour": 9, "minute": 30, "second": 0, "millis": 0 },
    "dayOfWeek": 2,
    "operatoryId": 6,
    "oralId": 0,
    "reason": "Test",
    "firstName": "Test",
    "lastName": "User",
    "dob": { "year": 2000, "month": 1, "day": 1 },
    "email": "test@example.com",
    "phoneNumber": "+15551234567",
    "newOrExisting": "new"
  }
}
```

