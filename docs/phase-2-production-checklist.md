# Production voice checklist (Phase 2 deploy)

Use this when Smile Squad (or any tenant) should take **real calls** on Connect.

## 1. Host the platform API

- Deploy `dental-booking-platform` (ECS, etc.): `.\scripts\deploy-ecs-dev.ps1`
- Update **Secrets Manager** (`oryx-agent-dev/env` or your `${project}-dev/env`) — `APP_ENV_JSON` must be valid JSON, for example:

```json
{
  "DATABASE_URL": "postgresql://USER:PASS@your-rds-host:5432/dental_booking",
  "PLATFORM_INTERNAL_SECRET": "...",
  "CONNECT_WEBHOOK_SECRET": "...",
  "PLATFORM_ADMIN_SECRET": "...",
  "WEB_FORM_PREVIEW_CODE": "SSQ-PREVIEW-2026"
}
```

- Run `npx prisma migrate deploy` against that RDS once
- Force new ECS tasks after secret changes: re-run deploy script or `aws ecs update-service --force-new-deployment`

## 2. Database

- Run migrations on production RDS
- In `/admin` (or seed): tenant, Oryx realm, operatory rules
- **Phone numbers:** map Connect DID → `booking` bot (E.164, e.g. `+17178848807`)

## 3. Verify resolve-phone

```bash
curl -s -H "x-platform-secret: YOUR_SECRET" \
  "https://YOUR_APP/api/internal/resolve-phone?did=%2B17178848807"
```

Expect `tenantSlug`, `botDisplayName`, `operatoryRules`.

## 4. Lex Lambda

- `API_BASE_URL` → your `/api/book` URL
- `CONNECT_WEBHOOK_SECRET`, `PLATFORM_INTERNAL_SECRET`
- `DEFAULT_TENANT_SLUG` only as fallback
- Deploy: `scripts/deploy-lex-lambda-dev.ps1` (adjust for prod)

## 5. Amazon Connect

- Contact flow passes **called number** into Lex session: `calledDid` or `CalledNumber`
- Value: `$.SystemEndpoint.Address` (the DID the patient dialed)

## 6. Test

- Call the practice line from a mobile phone (not from the admin app)

## Stripe

Billing and auto-suspend on payment failure come in the **last** phase (after 3b and PMS adapters).
