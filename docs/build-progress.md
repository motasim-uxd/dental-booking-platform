# Build progress (priorities 1–6)

| Priority | Status | Notes |
|----------|--------|-------|
| P1 Secrets alignment | Done | Synced from AWS DEV → `.env.local`; [secrets-alignment.md](./secrets-alignment.md) |
| P2 MVP chain test | Done | [mvp-chain-test.md](./mvp-chain-test.md); `external_id=17920` local run |
| P3 PMS factory | Done | `integration_mode` migration + `adapters/factory.py` |
| P4 DUAL booking | Done | `DualAdapter` + admin toggle `dual_booking_enabled`; `partial` booking status |
| P5 Internal PMS | Done | `patients` / `providers` / `appointments`; `InternalAdapter`; `GET /v1/availability`; seed `demo-internal` |
| P6 FastAPI on ECS | Ready to deploy | [deploy-all-dev.ps1](../scripts/deploy-all-dev.ps1), [aws-deploy-quickstart.md](./aws-deploy-quickstart.md) |
| Architecture gaps (BFF) | Done | All book routes → FastAPI when configured; internal availability via FastAPI |
| Diagram: FAQ SLM/Premium | Done | Bedrock Nova + Claude via FastAPI; Next internal routes |
| Diagram: SQS + DynamoDB | Done | Terraform + FastAPI integrations (optional env locally) |
| Diagram: ECS FastAPI + Cloud Map | Terraform | `infra/fastapi.tf` — enable on apply + deploy script |

Branch: `feature/fastapi-booking-service`
