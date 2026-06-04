from __future__ import annotations

from app.adapters.base import PmsAdapter
from app.contracts.booking import BookingRequest, BookingResponse


class DualAdapter:
  """Book externally first; mirror to internal DB when dual_booking_enabled."""

  pms_type = "dual"

  def __init__(self, external: PmsAdapter, internal: PmsAdapter):
    self._external = external
    self._internal = internal

  async def book_appointment(self, req: BookingRequest) -> BookingResponse:
    ext = await self._external.book_appointment(req)
    if not ext.ok:
      return ext

    internal = await self._internal.book_appointment(req)
    if internal.ok:
      return BookingResponse(
        ok=True,
        status="confirmed",
        external_appointment_id=ext.external_appointment_id,
        message=ext.message,
      )

    return BookingResponse(
      ok=True,
      status="partial",
      external_appointment_id=ext.external_appointment_id,
      message=(
        f"External booking succeeded ({ext.external_appointment_id}); "
        f"internal mirror failed: {internal.message or 'unknown error'}"
      ),
    )
