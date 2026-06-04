from __future__ import annotations

from typing import Protocol

from app.contracts.booking import BookingRequest, BookingResponse


class PmsAdapter(Protocol):
  pms_type: str

  async def book_appointment(self, req: BookingRequest) -> BookingResponse:
    raise NotImplementedError

