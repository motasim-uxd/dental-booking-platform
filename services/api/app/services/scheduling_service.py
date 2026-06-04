from __future__ import annotations

from app.contracts.availability import AvailabilityQuery, AvailabilityResponse
from app.services.availability_service import AvailabilityService


class SchedulingService:
  """Diagram: Scheduling Engine — availability + operatory rules."""

  def __init__(self) -> None:
    self._availability = AvailabilityService()

  async def get_available_slots(self, query: AvailabilityQuery) -> AvailabilityResponse:
    return await self._availability.get_slots(query)
