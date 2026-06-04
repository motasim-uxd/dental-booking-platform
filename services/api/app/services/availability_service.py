from __future__ import annotations

from typing import Any

from app.adapters.internal import InternalAdapter
from app.contracts.availability import AvailabilityQuery, AvailabilityResponse
from app.db import fetch_tenant_pms_by_slug


class AvailabilityService:
  async def get_slots(self, query: AvailabilityQuery) -> AvailabilityResponse:
    tenant_ctx = await fetch_tenant_pms_by_slug(query.tenant_slug)
    if not tenant_ctx:
      return AvailabilityResponse(success=False, error="Tenant not found")

    if str(tenant_ctx.get("tenant_status")) == "suspended":
      return AvailabilityResponse(success=False, error="Tenant suspended")

    mode = str(tenant_ctx.get("integration_mode") or "external_only").lower()
    if mode not in ("internal_only", "dual"):
      return AvailabilityResponse(
        success=False,
        error="Availability via FastAPI is only for internal_only or dual tenants",
      )

    internal = InternalAdapter(
      tenant_ctx["tenant_id"],
      tenant_ctx.get("operatory_rules") or {},
    )

    slots = await internal.get_availability(
      date_iso=query.date,
      appt_type=query.appt_type,
      first_avail=query.first_avail,
    )
    return AvailabilityResponse(success=True, data=slots)
