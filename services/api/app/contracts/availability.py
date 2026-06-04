from __future__ import annotations

from pydantic import BaseModel, Field


class AvailabilityQuery(BaseModel):
  tenant_slug: str = Field(min_length=1)
  date: str = Field(description="YYYY-MM-DD")
  appt_type: str = Field(default="Cleaning")
  first_avail: bool = False


class AvailabilityResponse(BaseModel):
  success: bool
  data: list[dict] = Field(default_factory=list)
  error: str | None = None
