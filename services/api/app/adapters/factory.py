from __future__ import annotations

from typing import Any

from app.adapters.base import PmsAdapter
from app.adapters.dual import DualAdapter
from app.adapters.internal import InternalAdapter
from app.adapters.oryx import OryxAdapter, OryxConfig


def _build_oryx(pms_config: dict[str, Any]) -> OryxAdapter | None:
  cfg = pms_config or {}
  realm = str(cfg.get("realm") or "").strip()
  if not realm:
    return None
  base_url = (
    str(cfg.get("baseUrl") or cfg.get("base_url") or "").strip()
    or "https://mychart.myoryx.com"
  )
  return OryxAdapter(OryxConfig(realm=realm, base_url=base_url))


def build_pms_adapter(
  *,
  tenant_id: str,
  pms_type: str,
  pms_config: dict[str, Any],
  integration_mode: str,
  operatory_rules: dict[str, Any],
  dual_booking_enabled: bool,
) -> PmsAdapter | None:
  mode = (integration_mode or "external_only").lower()
  pms = (pms_type or "").lower()
  internal = InternalAdapter(tenant_id, operatory_rules)

  if mode == "internal_only":
    return internal

  external = _build_oryx(pms_config) if pms == "oryx" else None
  if mode == "external_only":
    return external

  if mode == "dual":
    if not external:
      return None
    if dual_booking_enabled:
      return DualAdapter(external, internal)
    return external

  return external
