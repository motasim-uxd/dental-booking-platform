# Secrets alignment (DEV)

Last synced: **2026-06-04** from AWS account `264627803620` (`motasim_dev`), region **us-east-1**.

## Principle

**Voice and Lex use AWS as source of truth** for `CONNECT_WEBHOOK_SECRET` and `PLATFORM_INTERNAL_SECRET`. Local `.env.local` is updated to match — do not rotate these in one place without updating Lambda + Secrets Manager + ECS together.

**FastAPI S2S** (`S2S_SHARED_SECRET`, `FASTAPI_BASE_URL`) is **local/docker-only** until FastAPI runs on DEV ECS (Priority 6). Then add both to `oryx-agent-dev/env` without changing Lex secrets.

## Where each secret lives

| Secret | Local `.env.local` | SM `oryx-agent-dev/env` | Lambda (Lex) | ECS Next.js |
|--------|-------------------|-------------------------|--------------|-------------|
| `CONNECT_WEBHOOK_SECRET` | Yes | Yes (pseudo-JSON blob) | `smilesquad-lex-fulfillment-dev`, `ssbooking-dev` | Via `APP_ENV_JSON` |
| `PLATFORM_INTERNAL_SECRET` | Yes | Yes | Same as webhook on Lex | Via `APP_ENV_JSON` |
| `WEB_FORM_PREVIEW_CODE` | Yes | Yes | Yes | Via `APP_ENV_JSON` |
| `S2S_SHARED_SECRET` | Yes (local value) | **Not yet** | N/A | **Not yet** (P6) |
| `FASTAPI_BASE_URL` | `http://localhost:8001` | **Not yet** | N/A | **Not yet** (P6 → internal ALB URL) |
| `DATABASE_URL` | Local Postgres :5433 | RDS (ECS only) | N/A | ECS task |

## AWS read commands (DEV)

```powershell
# Secrets Manager (keys only — value is comma-separated KEY:value pairs, not strict JSON)
aws secretsmanager get-secret-value --secret-id oryx-agent-dev/env --region us-east-1 --query SecretString --output text

# Lex fulfillment
aws lambda get-function-configuration --function-name smilesquad-lex-fulfillment-dev --region us-east-1 --query Environment.Variables

# Booking helper Lambda
aws lambda get-function-configuration --function-name ssbooking-dev --region us-east-1 --query Environment.Variables
```

## Verified alignment (2026-06-04)

- SM, both Lambdas, and local `.env.local` use the **same** `CONNECT_WEBHOOK_SECRET` and `PLATFORM_INTERNAL_SECRET`.
- `WEB_FORM_PREVIEW_CODE=SSQ-PREVIEW-2026` matches SM and Lambda.
- Previous local-only webhook value was removed (duplicate key in `.env.local` fixed).

## Adding FastAPI to AWS (P6 checklist)

1. Generate or reuse a strong `S2S_SHARED_SECRET` (can match local dev value for first deploy).
2. Set `FASTAPI_BASE_URL` to the **internal** service URL (e.g. `http://fastapi.oryx-agent-dev.local:8001` or sidecar host — document actual target in `docs/deploy-aws-dev.md` after first deploy).
3. Patch `oryx-agent-dev/env` **append** keys only; do not change `CONNECT_WEBHOOK_SECRET`.
4. Redeploy ECS Next.js task so `APP_ENV_JSON` picks up new keys.
5. Re-run [mvp-chain-test.md](./mvp-chain-test.md) against DEV ALB.

## Do not

- Rotate `CONNECT_WEBHOOK_SECRET` on local only (breaks live Lex → `/api/book`).
- Commit `.env.local` (gitignored).
- Modify PROD secrets unless explicitly requested.
