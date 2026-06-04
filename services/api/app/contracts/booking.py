from __future__ import annotations

from pydantic import BaseModel, Field


class BookingRequest(BaseModel):
  tenant_slug: str = Field(min_length=1)
  channel: str = Field(description="voice|web|admin|other")
  idempotency_key: str = Field(min_length=8)
  payload: dict = Field(default_factory=dict, description="Channel-provided booking payload")


class BookingResponse(BaseModel):
  ok: bool
  status: str = Field(description="confirmed|rejected|failed|pending")
  external_appointment_id: str | None = None
  message: str | None = None

