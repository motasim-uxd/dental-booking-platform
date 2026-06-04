from __future__ import annotations

from pydantic import BaseModel, Field


class FaqEscalationRequest(BaseModel):
  tenant_slug: str = Field(min_length=1)
  session_id: str = Field(min_length=1, description="Lex session or Connect contact id")
  user_text: str = Field(min_length=1)
  context: dict = Field(default_factory=dict, description="Optional slots, intent, confidence")


class FaqEscalationResponse(BaseModel):
  ok: bool
  tier: str = Field(description="slm|premium|disabled")
  answer: str | None = None
  message: str | None = None
