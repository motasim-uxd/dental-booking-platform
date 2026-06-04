# Architecture alignment (ChatGPT diagram)

Reference diagram: Connect → Lex → **FastAPI middleware** → PMS/Oryx + Postgres + async AWS services.

## Implemented in repo

| Diagram box | Implementation |
|-------------|----------------|
| Amazon Connect + Lex V2 | AWS (wire new Lambda → ALB) |
| Lex FAQ intents | Lex bot + handler script |
| **FAQ SLM (Nova Micro)** | `POST /v1/faq/escalate` + Next `/api/internal/faq-escalate` |
| **Premium LLM (Claude)** | `POST /v1/faq/premium` + Next `/api/internal/faq-premium` |
| **FastAPI middleware (ECS)** | `services/api/` — booking, scheduling, FAQ |
| **Scheduling engine** | `SchedulingService` → `/v1/availability` |
| **PMS connector (Oryx API)** | `OryxAdapter` |
| **Internal PMS** | `InternalAdapter` + Postgres |
| **Dual mirror** | `DualAdapter` |
| **RDS Postgres** | Prisma + `booking_attempts`, patients, appointments |
| **DynamoDB conversation state** | `ConversationStore` + Terraform table |
| **SQS writeback + notifications** | `WritebackQueue`, `NotificationService` + Terraform queues |
| **Secrets Manager** | `oryx-agent-dev/env` |
| Browser → Next only | Next.js BFF proxies to FastAPI |
| Admin / tenants | `/admin` |

## Not implemented (diagram optional / later)

| Box | Notes |
|-----|--------|
| Oryx RPA worker | Direct Oryx HTTP used instead |
| S3 recordings / FAQ KB | Phase 2 |
| EventBridge fan-out | SQS sufficient for MVP |
| Dedicated SMS Lambda consumer | Queue ready; worker TBD |
| Full HIPAA control catalog | Operational, not code-complete |

## AWS wiring

1. `terraform apply` with `enable_fastapi_service = true` and `fastapi_image` set ([infra/fastapi.tf](../infra/fastapi.tf))
2. Secrets Manager: `FASTAPI_BASE_URL` = terraform output `fastapi_internal_url` (e.g. `http://fastapi.oryx-agent-dev.local:8001`)
3. `S2S_SHARED_SECRET`, `DATABASE_URL`, Bedrock model IDs
4. Deploy: [aws-deploy-quickstart.md](./aws-deploy-quickstart.md)

## Request paths (target state)

```text
Voice book:  Lex → Next /api/book → FastAPI /v1/booking → Oryx | Internal
Web book:    Browser → Next /api/t/.../book → FastAPI /v1/booking
FAQ SLM:     Lex → Next /api/internal/faq-escalate → FastAPI /v1/faq/escalate → Bedrock Nova
FAQ premium: Lex → Next /api/internal/faq-premium → FastAPI /v1/faq/premium → Bedrock Claude
After book:  FastAPI → SQS writeback + notifications (+ Postgres audit)
FAQ session: FastAPI → DynamoDB (when table env set)
```
