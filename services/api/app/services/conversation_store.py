from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from app.integrations.aws_clients import dynamodb_resource


def _table_name() -> str:
  return (os.getenv("DYNAMODB_CONVERSATION_TABLE") or "").strip()


class ConversationStore:
  """Diagram: DynamoDB for conversation state (optional; no-op if table unset)."""

  def enabled(self) -> bool:
    return bool(_table_name() and dynamodb_resource())

  async def touch_session(
    self,
    *,
    session_id: str,
    tenant_slug: str,
    attrs: dict[str, Any] | None = None,
  ) -> None:
    if not self.enabled():
      return
    table = dynamodb_resource().Table(_table_name())
    now = datetime.now(timezone.utc).isoformat()
    item = {
      "session_id": session_id,
      "tenant_slug": tenant_slug,
      "updated_at": now,
      **(attrs or {}),
    }
    table.put_item(Item=item)
