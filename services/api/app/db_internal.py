from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from app.db import get_pool


async def upsert_patient(
  *,
  tenant_id: str,
  first_name: str,
  last_name: str,
  preferred_name: str | None,
  email: str,
  phone_number: str,
  dob: dict[str, Any],
) -> str:
  pool = await get_pool()
  patient_id = str(uuid.uuid4())
  async with pool.acquire() as conn:
    row = await conn.fetchrow(
      """
      INSERT INTO patients
        (id, tenant_id, first_name, last_name, preferred_name, email, phone_number, dob, updated_at)
      VALUES
        ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb, NOW())
      ON CONFLICT (tenant_id, email)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        preferred_name = EXCLUDED.preferred_name,
        phone_number = EXCLUDED.phone_number,
        dob = EXCLUDED.dob,
        updated_at = NOW()
      RETURNING id::text
      """,
      patient_id,
      tenant_id,
      first_name,
      last_name,
      preferred_name,
      email.lower().strip(),
      phone_number.strip(),
      json.dumps(dob),
    )
    return str(row["id"])


async def find_provider_id(tenant_id: str, oral_id: int) -> str | None:
  pool = await get_pool()
  async with pool.acquire() as conn:
    row = await conn.fetchrow(
      """
      SELECT id::text AS id FROM providers
      WHERE tenant_id = $1::uuid AND oral_id = $2 AND active = true
      LIMIT 1
      """,
      tenant_id,
      oral_id,
    )
    return str(row["id"]) if row else None


async def slot_is_free(
  *,
  tenant_id: str,
  operatory_id: int,
  starts_at: datetime,
  ends_at: datetime,
) -> bool:
  pool = await get_pool()
  async with pool.acquire() as conn:
    row = await conn.fetchrow(
      """
      SELECT 1 FROM appointments
      WHERE tenant_id = $1::uuid
        AND operatory_id = $2
        AND status = 'scheduled'
        AND starts_at < $4
        AND ends_at > $3
      LIMIT 1
      """,
      tenant_id,
      operatory_id,
      starts_at,
      ends_at,
    )
    return row is None


async def create_appointment(
  *,
  tenant_id: str,
  patient_id: str,
  provider_id: str | None,
  operatory_id: int,
  oral_id: int,
  appt_type: str,
  reason: str,
  notes: str | None,
  channel: str,
  starts_at: datetime,
  ends_at: datetime,
) -> str:
  pool = await get_pool()
  appt_id = str(uuid.uuid4())
  async with pool.acquire() as conn:
    await conn.execute(
      """
      INSERT INTO appointments
        (id, tenant_id, patient_id, provider_id, operatory_id, oral_id, appt_type, reason, notes, status, starts_at, ends_at, channel, updated_at)
      VALUES
        ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, 'scheduled', $10, $11, $12, NOW())
      """,
      appt_id,
      tenant_id,
      patient_id,
      provider_id,
      operatory_id,
      oral_id,
      appt_type,
      reason,
      notes,
      starts_at,
      ends_at,
      channel,
    )
  return appt_id


async def list_scheduled_between(
  *,
  tenant_id: str,
  day_start: datetime,
  day_end: datetime,
) -> list[dict[str, Any]]:
  pool = await get_pool()
  async with pool.acquire() as conn:
    rows = await conn.fetch(
      """
      SELECT operatory_id, starts_at, ends_at
      FROM appointments
      WHERE tenant_id = $1::uuid
        AND status = 'scheduled'
        AND starts_at >= $2
        AND starts_at < $3
      """,
      tenant_id,
      day_start,
      day_end,
    )
    return [dict(r) for r in rows]
