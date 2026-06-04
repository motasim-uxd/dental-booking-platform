from __future__ import annotations

import json
import os
from typing import Any

from app.integrations.aws_clients import sqs_client


def _queue_url() -> str:
  return (os.getenv("SQS_APPOINTMENT_WRITEBACK_URL") or "").strip()


class WritebackQueue:
  """Diagram: appointment-writeback queue (async PMS mirror / audit)."""

  def enabled(self) -> bool:
    return bool(_queue_url() and sqs_client())

  async def enqueue(self, payload: dict[str, Any]) -> None:
    if not self.enabled():
      return
    sqs_client().send_message(
      QueueUrl=_queue_url(),
      MessageBody=json.dumps(payload, default=str),
    )
