import os
import hmac
from fastapi import FastAPI, Request

from app.env_bootstrap import bootstrap_from_app_env_json

bootstrap_from_app_env_json()
from fastapi.responses import JSONResponse

from app.contracts.availability import AvailabilityQuery, AvailabilityResponse
from app.contracts.booking import BookingRequest, BookingResponse
from app.contracts.faq import FaqEscalationRequest, FaqEscalationResponse
from app.services.booking_service import BookingService
from app.services.faq_escalation_service import FaqEscalationService
from app.services.scheduling_service import SchedulingService

app = FastAPI(
  title="Dental Booking Platform API",
  version="0.2.0",
  description="Middleware: booking, scheduling, FAQ escalation (Lex → SLM → premium LLM)",
)

S2S_HEADER = "x-s2s-secret"


def _get_shared_secret() -> str:
  return (os.getenv("S2S_SHARED_SECRET") or "").strip()


@app.middleware("http")
async def require_s2s_auth(request: Request, call_next):
  if request.url.path == "/health":
    return await call_next(request)

  secret = _get_shared_secret()
  provided = (request.headers.get(S2S_HEADER) or "").strip()

  if not secret or not provided or not hmac.compare_digest(provided, secret):
    return JSONResponse({"ok": False, "error": "unauthorized"}, status_code=401)

  return await call_next(request)


@app.get("/health")
def health():
  return {
    "ok": True,
    "components": {
      "booking": True,
      "scheduling": True,
      "faq_escalation": True,
      "pms_connectors": ["oryx", "internal", "dual"],
    },
  }

booking_service = BookingService()
scheduling_service = SchedulingService()
faq_service = FaqEscalationService()


@app.post("/v1/booking", response_model=BookingResponse)
async def book(req: BookingRequest):
  return await booking_service.book(req)


@app.get("/v1/availability", response_model=AvailabilityResponse)
async def availability(
  tenant_slug: str,
  date: str,
  appt_type: str = "Cleaning",
  first_avail: bool = False,
):
  return await scheduling_service.get_available_slots(
    AvailabilityQuery(
      tenant_slug=tenant_slug,
      date=date,
      appt_type=appt_type,
      first_avail=first_avail,
    )
  )


@app.post("/v1/faq/escalate", response_model=FaqEscalationResponse)
async def faq_escalate_slm(req: FaqEscalationRequest):
  """Diagram: Nova Micro SLM path when Lex confidence is low."""
  return await faq_service.escalate(req, tier="slm")


@app.post("/v1/faq/premium", response_model=FaqEscalationResponse)
async def faq_escalate_premium(req: FaqEscalationRequest):
  """Diagram: Claude premium LLM for complex FAQ."""
  return await faq_service.escalate(req, tier="premium")
