from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
from urllib.parse import quote

from app.contracts.booking import BookingRequest, BookingResponse


@dataclass(frozen=True)
class OryxConfig:
  realm: str
  base_url: str = "https://mychart.myoryx.com"


class OryxAdapter:
  pms_type = "oryx"

  def __init__(self, config: OryxConfig):
    self._config = config

  async def _init_session(self, client: httpx.AsyncClient) -> None:
    # Mirrors the Next.js OryxClient.init() call to establish cookies.
    realm = self._config.realm
    url = "online-schedule/index.html"
    params = {"realm": realm, "univers": "com"}
    headers = {"accept": "text/html,*/*"}
    await client.get(url, params=params, headers=headers)

  async def book_appointment(self, req: BookingRequest) -> BookingResponse:
    """
    Expected payload keys (initially mirrors the existing BookSchema shape):
      - oryxRealm (optional; overrides config realm if provided)
      - apptType, date, start, end, dayOfWeek, operatoryId, oralId, reason, notes?
      - firstName, lastName, preferredName?, dob, email, phoneNumber, newOrExisting
    """
    payload = req.payload or {}
    realm = str(payload.get("oryxRealm") or self._config.realm).strip()
    if not realm:
      return BookingResponse(ok=False, status="failed", message="Missing Oryx realm")

    base_url = self._config.base_url.rstrip("/")
    timeout = httpx.Timeout(10.0, connect=3.0)

    async with httpx.AsyncClient(
      base_url=base_url,
      timeout=timeout,
      follow_redirects=True,
      headers={
        "accept": "application/json, text/plain, */*",
        "x-mychart-realm": realm,
      },
    ) as client:
      await self._init_session(client)

      # Build Oryx request body (matches lib/oryxClient.ts).
      body: dict[str, Any] = {
        "onlineAppt": {
          "date": payload["date"],
          "start": payload["start"],
          "end": payload["end"],
          "dayOfWeek": payload["dayOfWeek"],
          "operatoryId": payload["operatoryId"],
          "oralId": payload["oralId"],
          "reason": payload["reason"],
          "onlineApptReason": payload.get("notes") or "",
          "firstName": payload["firstName"],
          "lastName": payload["lastName"],
          "preferredName": payload.get("preferredName") or payload["firstName"],
          "dob": {
            **payload["dob"],
            "hour": 0,
            "minute": 0,
            "second": 0,
            "millis": 0,
          },
          "email": payload["email"],
          "phoneNumber": payload["phoneNumber"],
          "newOrExisting": payload["newOrExisting"],
        }
      }

      # Oryx endpoint.
      realm_enc = quote(realm, safe="")
      res = await client.post(
        f"office/api/online/schedule/appointment/{realm_enc}",
        json=body,
        headers={"content-type": "application/json"},
      )

      # Keep behavior conservative: any non-2xx is a failure.
      if res.status_code < 200 or res.status_code >= 300:
        return BookingResponse(
          ok=False,
          status="failed",
          message=f"Oryx booking failed (HTTP {res.status_code})",
        )

      # Oryx response schema varies; return raw id if present.
      data = res.json()
      external_id = None
      for key in ("appointmentId", "apptId", "id"):
        if isinstance(data, dict) and key in data and data[key] is not None:
          external_id = str(data[key])
          break

      return BookingResponse(ok=True, status="confirmed", external_appointment_id=external_id)

