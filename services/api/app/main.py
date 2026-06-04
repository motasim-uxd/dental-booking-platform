import os
import hmac
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.contracts.booking import BookingRequest, BookingResponse
from app.services.booking_service import BookingService

app = FastAPI(title="Dental Booking Platform API", version="0.1.0")

S2S_HEADER = "x-s2s-secret"


def _get_shared_secret() -> str:
  return (os.getenv("S2S_SHARED_SECRET") or "").strip()


@app.middleware("http")
async def require_s2s_auth(request: Request, call_next):
  # Allow health checks without auth (used by ALB/K8s/etc.)
  if request.url.path == "/health":
    return await call_next(request)

  secret = _get_shared_secret()
  provided = (request.headers.get(S2S_HEADER) or "").strip()

  if not secret or not provided or not hmac.compare_digest(provided, secret):
    return JSONResponse({"ok": False, "error": "unauthorized"}, status_code=401)

  return await call_next(request)


@app.get("/health")
def health():
  return {"ok": True}

booking_service = BookingService()


@app.post("/v1/booking", response_model=BookingResponse)
async def book(req: BookingRequest):
  return await booking_service.book(req)

