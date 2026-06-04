from __future__ import annotations

from typing import Dict, Any

from app.contracts.booking import BookingRequest, BookingResponse
from app.adapters.factory import build_pms_adapter
from app.db import fetch_tenant_pms_by_slug, upsert_booking_attempt
from app.services.notification_service import NotificationService
from app.services.writeback_queue import WritebackQueue


class BookingService:
  """
  V1 wiring:
  - hardcode Oryx adapter (until tenant->PMS resolution is added)
  - in-memory idempotency cache (swap for DB/Dynamo later)
  """

  def __init__(self) -> None:
    self._idempotency: Dict[str, BookingResponse] = {}
    self._notifications = NotificationService()
    self._writeback = WritebackQueue()

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
    integration_mode = str(tenant_ctx.get("integration_mode") or "external_only").lower()

    operatory_rules: dict[str, Any] = tenant_ctx.get("operatory_rules") or {}
    dual_enabled = bool(tenant_ctx.get("dual_booking_enabled"))

    adapter = build_pms_adapter(
      tenant_id=tenant_ctx["tenant_id"],
      pms_type=pms_type,
      pms_config=pms_config,
      integration_mode=integration_mode,
      operatory_rules=operatory_rules,
      dual_booking_enabled=dual_enabled,
    )
    if adapter is None:
      res = BookingResponse(
        ok=False,
        status="failed",
        message=f"No adapter for pms_type={pms_type} integration_mode={integration_mode}",
      )
      self._idempotency[key] = res
      return res

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

    attempt_status = res.status if res.status in ("confirmed", "failed", "partial") else (
      "confirmed" if res.ok else "failed"
    )

    await upsert_booking_attempt(
      tenant_id=tenant_ctx["tenant_id"],
      channel=req.channel,
      idempotency_key=req.idempotency_key,
      request_payload=req.model_dump(),
      status=attempt_status,
      external_id=res.external_appointment_id,
      response_body=res.model_dump(),
      error_message=None if res.ok else (res.message or "Booking failed"),
    )
    self._idempotency[key] = res

    if res.ok:
      event = {
        "tenant_slug": req.tenant_slug,
        "channel": req.channel,
        "idempotency_key": req.idempotency_key,
        "status": attempt_status,
        "external_appointment_id": res.external_appointment_id,
      }
      await self._writeback.enqueue(event)
      await self._notifications.booking_confirmed(event)

    return res

