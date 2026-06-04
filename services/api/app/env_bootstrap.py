from __future__ import annotations

import os
import re


def _parse_pseudo_json_env(blob: str) -> dict[str, str]:
  """Secrets Manager `oryx-agent-dev/env` uses {KEY:value,...} (not strict JSON)."""
  s = blob.strip()
  if not s.startswith("{") or not s.endswith("}"):
    return {}
  inner = s[1:-1]
  out: dict[str, str] = {}
  for part in re.split(r",(?=[A-Za-z_][A-Za-z0-9_]*:)", inner):
    if ":" not in part:
      continue
    key, value = part.split(":", 1)
    out[key.strip()] = value.strip()
  return out


def bootstrap_from_app_env_json() -> None:
  """
  Map ECS APP_ENV_JSON into process env when explicit vars are unset.
  Does not override existing DATABASE_URL / S2S_SHARED_SECRET.
  """
  raw = (os.getenv("APP_ENV_JSON") or "").strip()
  if not raw:
    return
  try:
    import json

    parsed = json.loads(raw)
    if isinstance(parsed, dict):
      items = {str(k): str(v) for k, v in parsed.items()}
    else:
      items = _parse_pseudo_json_env(raw)
  except Exception:
    items = _parse_pseudo_json_env(raw)

  for key, value in items.items():
    if key in ("DATABASE_URL", "S2S_SHARED_SECRET", "FASTAPI_BASE_URL") and not (os.getenv(key) or "").strip():
      os.environ[key] = value
