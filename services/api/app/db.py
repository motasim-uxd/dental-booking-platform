from __future__ import annotations

import os
import json
import uuid
from typing import Any, Optional

import asyncpg


def get_database_url() -> str:
  return (os.getenv("DATABASE_URL") or "").strip()


_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
  global _pool
  if _pool is not None:
    return _pool
  url = get_database_url()
  if not url:
    raise RuntimeError("DATABASE_URL is not set for FastAPI service")
  _pool = await asyncpg.create_pool(dsn=url, min_size=1, max_size=5)
  return _pool


async def fetch_tenant_pms_by_slug(slug: str) -> dict[str, Any] | None:
  pool = await get_pool()
  async with pool.acquire() as conn:
    row = await conn.fetchrow(
      """
      SELECT
        t.id as tenant_id,
        t.slug as tenant_slug,
        t.status as tenant_status,
        p.pms_type as pms_type,
        p.integration_mode as integration_mode,
        p.dual_booking_enabled as dual_booking_enabled,
        p.config::text as pms_config,
        p.operatory_rules::text as operatory_rules
      FROM tenants t
      JOIN tenant_pms_config p ON p.tenant_id = t.id
      WHERE t.slug = $1
      LIMIT 1
      """,
      slug,
    )
    if row is None:
      return None
    out = dict(row)
    raw_cfg = out.get("pms_config")
    if isinstance(raw_cfg, str) and raw_cfg.strip():
      try:
        out["pms_config"] = json.loads(raw_cfg)
      except Exception:
        out["pms_config"] = {}
    elif raw_cfg is None:
      out["pms_config"] = {}
    raw_rules = out.get("operatory_rules")
    if isinstance(raw_rules, str) and raw_rules.strip():
      try:
        out["operatory_rules"] = json.loads(raw_rules)
      except Exception:
        out["operatory_rules"] = {}
    elif raw_rules is None:
      out["operatory_rules"] = {}
    return out


async def upsert_booking_attempt(
  *,
  tenant_id: str,
  channel: str,
  idempotency_key: str,
  request_payload: dict[str, Any],
  status: str,
  external_id: str | None,
  response_body: dict[str, Any],
  error_message: str | None,
) -> None:
  pool = await get_pool()
  async with pool.acquire() as conn:
    attempt_id = str(uuid.uuid4())
    await conn.execute(
      """
      INSERT INTO booking_attempts
        (id, tenant_id, channel, idempotency_key, status, external_id, request_payload, response_body, error_message, updated_at)
      VALUES
        ($1::uuid, $2, $3, $4, $5::"BookingStatus", $6, $7::jsonb, $8::jsonb, $9, NOW())
      ON CONFLICT (tenant_id, idempotency_key)
      DO UPDATE SET
        channel = EXCLUDED.channel,
        status = EXCLUDED.status,
        external_id = EXCLUDED.external_id,
        request_payload = EXCLUDED.request_payload,
        response_body = EXCLUDED.response_body,
        error_message = EXCLUDED.error_message,
        updated_at = NOW()
      """,
      attempt_id,
      tenant_id,
      channel,
      idempotency_key,
      status,
      external_id,
      json.dumps(request_payload),
      json.dumps(response_body),
      error_message,
    )

