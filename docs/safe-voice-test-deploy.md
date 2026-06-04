# Safe deploy for voice testing (new Lambda / alias)

Deploy **application code only**. Do **not** overwrite the production Lex Lambdas.

## What this deploy changes

| Changes | Does not change |
|---------|-----------------|
| ECS `oryx-agent-dev` (Next.js image tag `dev`) | `smilesquad-lex-fulfillment-dev` / `ssbooking-dev` Lambda **code** |
| ECR image `oryx-agent:dev` | Lex bot **production** alias (unless you point it yourself) |
| Optional: `oryx-agent-fastapi-dev` service | Connect production flow (unless you use new alias only) |

## 1. Deploy Next.js (required)

```powershell
cd e:\Projects\dental-booking-platform
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-ecs-dev.ps1
```

If new ECS tasks fail with `invalid character 'A' looking for beginning of object key string`, the task definition is pulling **per-key** Secrets Manager refs but DEV uses pseudo-JSON in `APP_ENV_JSON` only. Fix and roll:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-ecs-secrets-dev.ps1
```

Wait until the running task is revision **:41+** (not old `:34`), then verify:

```powershell
Invoke-RestMethod http://oryx-agent-dev-alb-25246280.us-east-1.elb.amazonaws.com/api/t/smilesquad/public-config
```

Wait 2–3 minutes. ALB (DEV):

`http://oryx-agent-dev-alb-25246280.us-east-1.elb.amazonaws.com`

Verify:

```powershell
Invoke-RestMethod http://oryx-agent-dev-alb-25246280.us-east-1.elb.amazonaws.com/api/health
```

## 2. Configure **only your new** test Lambda

In AWS Console → Lambda → **your new function** → Environment:

| Variable | Value |
|----------|--------|
| `API_BASE_URL` | `http://oryx-agent-dev-alb-25246280.us-east-1.elb.amazonaws.com/api/book` |
| `CONNECT_WEBHOOK_SECRET` | Same as Secrets Manager / old Lambda (do not rotate alone) |
| `PLATFORM_INTERNAL_SECRET` | Same as old Lambda |
| `WEB_FORM_PREVIEW_CODE` | e.g. `SSQ-PREVIEW-2026` if used |
| `DEFAULT_TENANT_SLUG` | `smilesquad` (fallback) |

Upload handler code **only** to this function (copy from repo `scripts/lex-patient-booking-handler.js` as `index.mjs` in a zip), or:

```powershell
# Replace YourNewLambdaName — NOT the default dev function names
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-lex-lambda-dev.ps1 -Functions @("YourNewLambdaName")
```

## 3. Connect + Lex

- **Get customer input** → Lex bot → **your new alias** (not the live prod alias).
- Pass called DID: session attribute `calledDid` = `$.SystemEndpoint.Address`.
- Test dial the number that uses **this** contact flow / alias.

## 4. Optional: FastAPI on ECS

Only needed for `internal_only` / full middleware path. Oryx voice (`smilesquad`) can work without FastAPI if `FASTAPI_BASE_URL` is unset on ECS Next.

```powershell
# After S2S_SHARED_SECRET + DATABASE_URL exist in oryx-agent-dev/env
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-fastapi-dev.ps1 -CreateService
# Then append FASTAPI_BASE_URL to SM and redeploy Next — see aws-deploy-quickstart.md
```

## 5. Do not run

```powershell
# Overwrites BOTH legacy dev Lambdas — skip unless intentional
.\scripts\deploy-lex-lambda-dev.ps1
```

## Rollback

ECS console → `oryx-agent-dev` → previous task definition revision, or redeploy an older git commit with `deploy-ecs-dev.ps1`.
