from __future__ import annotations

from typing import Dict, Any

from app.contracts.booking import BookingRequest, BookingResponse
from app.adapters.oryx import OryxAdapter, OryxConfig
from app.db import fetch_tenant_pms_by_slug, upsert_booking_attempt


class BookingService:
  """
  V1 wiring:
  - hardcode Oryx adapter (until tenant->PMS resolution is added)
  - in-memory idempotency cache (swap for DB/Dynamo later)
  """

  def __init__(self) -> None:
    self._idempotency: Dict[str, BookingResponse] = {}

  async def book(self, req: BookingRequest) -> BookingResponse:
    key = f"{req.tenant_slug}:{req.idempotency_key}"
    if key in self._idempotency:
      return self._idempotency[key]

    tenant_ctx = await fetch_tenant_pms_by_slug(req.tenant_slug)
    if not tenant_ctx:
      res = BookingResponse(ok=False, status="failed", message="Tenant not found or PMS not configured")
      self._idempotency[key] = res
      return res

    if str(tenant_ctx.get("tenant_status")) == "suspended":
      res = BookingResponse(ok=False, status="failed", message="Tenant suspended")
      self._idempotency[key] = res
      return res

    pms_type = str(tenant_ctx.get("pms_type") or "").lower()
    pms_config: dict[str, Any] = tenant_ctx.get("pms_config") or {}

    if pms_type != "oryx":
      res = BookingResponse(ok=False, status="failed", message=f"Unsupported PMS type: {pms_type}")
      self._idempotency[key] = res
      return res

    realm = str(pms_config.get("realm") or "").strip()
    base_url = str(pms_config.get("baseUrl") or pms_config.get("base_url") or "").strip() or "https://mychart.myoryx.com"
    adapter = OryxAdapter(OryxConfig(realm=realm, base_url=base_url))

    # Persist pending attempt first (mirror/audit).
    await upsert_booking_attempt(
      tenant_id=tenant_ctx["tenant_id"],
      channel=req.channel,
      idempotency_key=req.idempotency_key,
      request_payload=req.model_dump(),
      status="pending",
      external_id=None,
      response_body={},
      error_message=None,
    )

    res = await adapter.book_appointment(req)

    await upsert_booking_attempt(
      tenant_id=tenant_ctx["tenant_id"],
      channel=req.channel,
      idempotency_key=req.idempotency_key,
      request_payload=req.model_dump(),
      status="confirmed" if res.ok else "failed",
      external_id=res.external_appointment_id,
      response_body=res.model_dump(),
      error_message=None if res.ok else (res.message or "Booking failed"),
    )
    self._idempotency[key] = res
    return res

