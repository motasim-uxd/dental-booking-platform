# AWS DEV deploy quickstart

Deploy **Next.js** + **FastAPI** so all booking goes through the platform middleware (aligned with architecture diagram).

## Prerequisites

- AWS CLI logged in (`aws sts get-caller-identity`)
- Docker Desktop running
- Secrets in `oryx-agent-dev/env` (see [secrets-alignment.md](./secrets-alignment.md))
- Postgres `DATABASE_URL` on RDS (migrations applied)

## 1. Add Secrets Manager keys (one-time)

In **Secrets Manager** → `oryx-agent-dev/env`, ensure the blob or JSON includes:

| Key | Example (DEV) |
|-----|----------------|
| `CONNECT_WEBHOOK_SECRET` | (existing — do not rotate alone) |
| `PLATFORM_INTERNAL_SECRET` | (existing) |
| `DATABASE_URL` | `postgresql://user:pass@rds-host:5432/dental_booking` |
| `S2S_SHARED_SECRET` | same as local `.env.local` |
| `FASTAPI_BASE_URL` | internal URL to FastAPI task (see below) |
| `PLATFORM_ADMIN_SECRET` | (for `/admin`) |

**FASTAPI_BASE_URL options (pick one after FastAPI service exists):**

- **Service Connect / Cloud Map** (recommended): `http://oryx-agent-fastapi-dev:8001`
- **Same VPC private IP** (temporary): task ENI IP — fragile across deploys

Until FastAPI is running, Next.js still falls back to in-process Oryx for booking if `FASTAPI_*` unset.

## 2. (Recommended) Terraform — diagram AWS resources

Creates Cloud Map (`fastapi.oryx-agent-dev.local`), DynamoDB conversation table, SQS queues, IAM for Bedrock/SQS.

```powershell
cd infra
terraform apply -var-file=dev.tfvars -var="app_image=264627803620.dkr.ecr.us-east-1.amazonaws.com/oryx-agent:dev" `
  -var="enable_fastapi_service=true" `
  -var="fastapi_image=264627803620.dkr.ecr.us-east-1.amazonaws.com/oryx-agent:fastapi-dev"
terraform output fastapi_internal_url
```

Set `FASTAPI_BASE_URL` in Secrets Manager to the `fastapi_internal_url` output.

## 3. Deploy from repo root

```powershell
# Next.js → ECR → ECS oryx-agent-dev
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-ecs-dev.ps1

# FastAPI → ECR tag fastapi-dev → ECS service (first time: -CreateService)
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-fastapi-dev.ps1 -CreateService

# Subsequent FastAPI-only deploys (no -CreateService)
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-fastapi-dev.ps1
```

Or both:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-all-dev.ps1
```

## 4. Database migrations (DEV RDS)

```powershell
$env:DATABASE_URL = "<from-secrets-manager>"
npx prisma migrate deploy
npm run db:seed
```

## 5. Lex (new Lambda)

Point **new** Lex alias fulfillment Lambda to:

`http://<alb-dns>/api/book`

Env: `CONNECT_WEBHOOK_SECRET`, `PLATFORM_INTERNAL_SECRET`, `API_BASE_URL` as above.

See [phase-2-dev.md](./phase-2-dev.md).

## 6. Verify

| Check | URL |
|-------|-----|
| Health | `http://<alb-dns>/api/health` |
| FastAPI via Next | `http://<alb-dns>/api/internal/fastapi-health` |
| Web book | `http://<alb-dns>/book/smilesquad` |
| Admin | `http://<alb-dns>/admin` |

Book a slot on DEV; confirm `booking_attempts` row on RDS when FastAPI path is active.

## Architecture alignment (this deploy)

- **Voice + web** → Next BFF → **FastAPI** `/v1/booking` (when `FASTAPI_BASE_URL` + `S2S` set)
- **Oryx** + **internal PMS** → FastAPI adapters
- **Not in this deploy:** Nova/Claude escalation, SQS writeback, SMS Lambda, DynamoDB (later phases)
