# Lex FAQ escalation (diagram layers 3–4)

When Lex confidence is low, call the platform **SLM** layer; escalate to **premium** only when needed.

## Flow

```text
Lex fulfillment Lambda
  → POST https://<alb>/api/internal/faq-escalate   (Nova Micro via FastAPI)
  → POST https://<alb>/api/internal/faq-premium    (Claude, complex only)
```

Headers:

- `x-platform-secret`: `PLATFORM_INTERNAL_SECRET`
- `content-type`: `application/json`

Body:

```json
{
  "tenant_slug": "smilesquad",
  "session_id": "lex-session-id",
  "user_text": "Do you take Delta Dental?",
  "context": { "practiceName": "Smile Squad", "confidence": 0.42 }
}
```

Response:

```json
{ "ok": true, "tier": "slm", "answer": "..." }
```

## Cost alignment (diagram)

1. **Lex fixed intents** — office hours, location (stay in Lex)
2. **SLM** — `/api/internal/faq-escalate` → FastAPI → Bedrock Nova Micro
3. **Premium** — `/api/internal/faq-premium` → FastAPI → Claude 3.5 Sonnet
4. **Booking** — unchanged: `/api/book` → FastAPI `/v1/booking`

## AWS requirements

- ECS task role: Bedrock `InvokeModel` / `Converse` (see `infra/fastapi.tf`)
- SM keys: `BEDROCK_NOVA_MODEL_ID`, `BEDROCK_CLAUDE_MODEL_ID` (already on DEV SM blob)
