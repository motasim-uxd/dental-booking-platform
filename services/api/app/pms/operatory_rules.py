from __future__ import annotations

from typing import Any

DEFAULT_ALLOWED: dict[str, list[int]] = {
  "Cleaning": [6, 2],
  "Emergency": [6, 2],
  "Consultation": [3],
  "Treatment": [4],
}


def parse_operatory_rules(raw: Any) -> dict[str, Any]:
  if not raw or not isinstance(raw, dict):
    return {"treatmentOperatoryId": 4, "allowedByType": dict(DEFAULT_ALLOWED)}
  allowed = raw.get("allowedByType") if isinstance(raw.get("allowedByType"), dict) else {}
  merged = {**DEFAULT_ALLOWED, **{k: v for k, v in allowed.items() if isinstance(v, list)}}
  treatment = raw.get("treatmentOperatoryId")
  tid = int(treatment) if treatment is not None and int(treatment) > 0 else 4
  return {"treatmentOperatoryId": tid, "allowedByType": merged}


def operatory_allow_set(appt_type: str, rules: dict[str, Any]) -> set[int]:
  t = (appt_type or "Cleaning").strip() or "Cleaning"
  if t == "Treatment":
    return {int(rules.get("treatmentOperatoryId") or 4)}
  lst = rules.get("allowedByType", {}).get(t)
  if isinstance(lst, list) and lst:
    return {int(x) for x in lst if int(x) > 0}
  return {6, 2}


def is_operatory_allowed(operatory_id: int, appt_type: str, rules: dict[str, Any]) -> bool:
  return int(operatory_id) in operatory_allow_set(appt_type, rules)
