from __future__ import annotations

import json
import os
from typing import Any

from app.contracts.faq import FaqEscalationRequest, FaqEscalationResponse
from app.integrations.aws_clients import bedrock_runtime
from app.services.conversation_store import ConversationStore


def _nova_model() -> str:
  return (
    os.getenv("BEDROCK_NOVA_MODEL_ID")
    or "us.amazon.nova-micro-v1:0"
  ).strip()


def _claude_model() -> str:
  return (
    os.getenv("BEDROCK_CLAUDE_MODEL_ID")
    or "anthropic.claude-3-5-sonnet-20241022-v2:0"
  ).strip()


def _invoke_bedrock(model_id: str, user_text: str, system: str) -> str | None:
  client = bedrock_runtime()
  if not client:
    return None

  # Nova Micro (Converse API)
  if "nova" in model_id.lower():
    try:
      res = client.converse(
        modelId=model_id,
        system=[{"text": system}],
        messages=[{"role": "user", "content": [{"text": user_text}]}],
        inferenceConfig={"maxTokens": 512, "temperature": 0.3},
      )
      blocks = res.get("output", {}).get("message", {}).get("content", [])
      for b in blocks:
        if isinstance(b, dict) and b.get("text"):
          return str(b["text"]).strip()
    except Exception:
      return None

  # Claude on Bedrock (Messages API body)
  try:
    body = {
      "anthropic_version": "bedrock-2023-05-31",
      "max_tokens": 512,
      "system": system,
      "messages": [{"role": "user", "content": user_text}],
    }
    res = client.invoke_model(
      modelId=model_id,
      contentType="application/json",
      accept="application/json",
      body=json.dumps(body),
    )
    payload = json.loads(res["body"].read())
    content = payload.get("content") or []
    if content and isinstance(content[0], dict):
      return str(content[0].get("text", "")).strip()
  except Exception:
    return None
  return None


class FaqEscalationService:
  """
  Diagram layers:
  - SLM: Nova Micro (cheap FAQ escalation)
  - Premium: Claude when SLM insufficient (tier=premium on request)
  """

  def __init__(self) -> None:
    self._sessions = ConversationStore()

  async def escalate(self, req: FaqEscalationRequest, *, tier: str = "slm") -> FaqEscalationResponse:
    await self._sessions.touch_session(
      session_id=req.session_id,
      tenant_slug=req.tenant_slug,
      attrs={"last_user_text": req.user_text[:500], "tier": tier},
    )

    system = (
      f"You are a helpful dental office receptionist assistant for tenant {req.tenant_slug}. "
      "Answer briefly in 1-3 sentences. If unsure, say you will connect the caller to the office."
    )
    ctx = req.context or {}
    if ctx.get("practiceName"):
      system += f" Practice: {ctx['practiceName']}."

    user_text = req.user_text.strip()
    model = _claude_model() if tier == "premium" else _nova_model()
    answer = _invoke_bedrock(model, user_text, system)

    if not answer:
      return FaqEscalationResponse(
        ok=False,
        tier=tier,
        message="Bedrock unavailable (local dev or missing IAM/model access)",
      )

    return FaqEscalationResponse(ok=True, tier=tier, answer=answer)
