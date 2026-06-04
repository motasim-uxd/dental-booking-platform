from __future__ import annotations

import json
import logging
import os
from typing import Any

from app.integrations.aws_clients import sqs_client

logger = logging.getLogger(__name__)


def _queue_url() -> str:
  return (os.getenv("SQS_NOTIFICATIONS_URL") or "").strip()


class NotificationService:
  """Diagram: SMS/email confirmations via queue (MVP: queue or structured log)."""

  def enabled(self) -> bool:
    return bool(_queue_url() and sqs_client())

  async def booking_confirmed(self, payload: dict[str, Any]) -> None:
    if self.enabled():
      sqs_client().send_message(
        QueueUrl=_queue_url(),
        MessageBody=json.dumps({"type": "booking_confirmed", **payload}, default=str),
      )
      return
    logger.info("booking_notification %s", json.dumps(payload, default=str))
