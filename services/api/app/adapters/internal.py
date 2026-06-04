from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.contracts.booking import BookingRequest, BookingResponse
from app.db_internal import (
  create_appointment,
  find_provider_id,
  slot_is_free,
  upsert_patient,
  list_scheduled_between,
)
from app.pms.operatory_rules import is_operatory_allowed, operatory_allow_set, parse_operatory_rules


def _slot_datetimes(payload: dict[str, Any]) -> tuple[datetime, datetime, int]:
  date = payload["date"]
  start = payload["start"]
  end = payload["end"]
  tz = timezone.utc
  starts = datetime(
    int(date["year"]),
    int(date["month"]),
    int(date["day"]),
    int(start["hour"]),
    int(start["minute"]),
    tzinfo=tz,
  )
  ends = datetime(
    int(date["year"]),
    int(date["month"]),
    int(date["day"]),
    int(end["hour"]),
    int(end["minute"]),
    tzinfo=tz,
  )
  day_of_week = int(payload.get("dayOfWeek", starts.weekday()))
  return starts, ends, day_of_week


class InternalAdapter:
  pms_type = "internal"

  def __init__(self, tenant_id: str, operatory_rules: dict[str, Any]):
    self._tenant_id = tenant_id
    self._rules = parse_operatory_rules(operatory_rules)

  async def book_appointment(self, req: BookingRequest) -> BookingResponse:
    payload = req.payload or {}
    try:
      operatory_id = int(payload["operatoryId"])
      oral_id = int(payload["oralId"])
      appt_type = str(payload.get("apptType") or payload.get("reason") or "Cleaning")
    except (KeyError, TypeError, ValueError):
      return BookingResponse(ok=False, status="failed", message="Invalid booking payload")

    if not is_operatory_allowed(operatory_id, appt_type, self._rules):
      return BookingResponse(
        ok=False,
        status="failed",
        message="Operatory not allowed for this appointment type",
      )

    try:
      starts_at, ends_at, _ = _slot_datetimes(payload)
    except (KeyError, TypeError, ValueError):
      return BookingResponse(ok=False, status="failed", message="Invalid date/time in payload")

    if ends_at <= starts_at:
      return BookingResponse(ok=False, status="failed", message="Invalid appointment duration")

    if not await slot_is_free(
      tenant_id=self._tenant_id,
      operatory_id=operatory_id,
      starts_at=starts_at,
      ends_at=ends_at,
    ):
      return BookingResponse(ok=False, status="failed", message="Slot no longer available")

    try:
      patient_id = await upsert_patient(
        tenant_id=self._tenant_id,
        first_name=str(payload["firstName"]).strip(),
        last_name=str(payload["lastName"]).strip(),
        preferred_name=(str(payload.get("preferredName") or "").strip() or None),
        email=str(payload["email"]).strip(),
        phone_number=str(payload["phoneNumber"]).strip(),
        dob=payload["dob"],
      )
    except Exception as e:
      return BookingResponse(ok=False, status="failed", message=f"Patient save failed: {e}")

    provider_id = await find_provider_id(self._tenant_id, oral_id)

    try:
      appt_id = await create_appointment(
        tenant_id=self._tenant_id,
        patient_id=patient_id,
        provider_id=provider_id,
        operatory_id=operatory_id,
        oral_id=oral_id,
        appt_type=appt_type,
        reason=str(payload.get("reason") or appt_type),
        notes=(str(payload.get("notes") or "").strip() or None),
        channel=req.channel,
        starts_at=starts_at,
        ends_at=ends_at,
      )
    except Exception as e:
      return BookingResponse(ok=False, status="failed", message=f"Appointment save failed: {e}")

    return BookingResponse(ok=True, status="confirmed", external_appointment_id=appt_id)

  async def get_availability(
    self,
    *,
    date_iso: str,
    appt_type: str,
    first_avail: bool,
  ) -> list[dict[str, Any]]:
    """Return Oryx-shaped slot rows for Lex/web consumers."""
    parts = date_iso.split("-")
    if len(parts) != 3:
      return []
    year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
    tz = timezone.utc
    day_start = datetime(year, month, day, 0, 0, tzinfo=tz)
    day_end = day_start + timedelta(days=1)
    day_of_week = day_start.weekday()

    booked = await list_scheduled_between(
      tenant_id=self._tenant_id,
      day_start=day_start,
      day_end=day_end,
    )

    allow_ops = operatory_allow_set(appt_type, self._rules)
    slots: list[dict[str, Any]] = []
    # Office window 8:00–16:00, 30-minute slots (matches Lex handler).
    for hour in range(8, 16):
      for minute in (0, 30):
        start = datetime(year, month, day, hour, minute, tzinfo=tz)
        end = start + timedelta(minutes=30)
        for op_id in sorted(allow_ops):
          conflict = any(
            int(b["operatory_id"]) == op_id
            and b["starts_at"] < end
            and b["ends_at"] > start
            for b in booked
          )
          if conflict:
            continue
          slots.append(
            {
              "date": {"year": year, "month": month, "day": day},
              "dayName": day_start.strftime("%a")[:3],
              "dayOfWeek": day_of_week,
              "operatoryId": op_id,
              "providerId": 1,
              "oralId": 1,
              "start": {"hour": hour, "minute": minute, "second": 0, "millis": 0},
              "end": {
                "hour": end.hour,
                "minute": end.minute,
                "second": 0,
                "millis": 0,
              },
              "mins": 30,
            }
          )
          if first_avail:
            return slots
    return slots
