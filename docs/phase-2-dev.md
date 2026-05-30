# Phase 2 — Multi-tenant voice (Lex / Amy)

## What changed

- **Lex Lambda** (`scripts/lex-patient-booking-handler.js`):
  - On first invoke, calls `GET /api/internal/resolve-phone?did=...` (or falls back to `DEFAULT_TENANT_SLUG`)
  - Stores `tenantSlug`, `practiceName`, `botDisplayName`, `operatoryRulesJson` in **session attributes**
  - Uses **tenant operatory rules** from DB (not duplicated `SMILE_SQUAD_*` env logic)
  - Availability: `GET /api/t/{slug}/availability`
  - Book: `POST /api/book` with `x-api-key` + **`X-Tenant-Slug`**
  - Farewell messages use **practice name** from tenant config

- **Platform APIs**:
  - `/api/t/[slug]/availability` and `/book` accept **preview code OR `CONNECT_WEBHOOK_SECRET`** (Lex server-to-server)

## Lambda environment variables

| Variable | Purpose |
|----------|---------|
| `API_BASE_URL` | e.g. `https://your-app.example.com/api/book` |
| `CONNECT_WEBHOOK_SECRET` | Same as Next.js; sent as `x-api-key` |
| `PLATFORM_INTERNAL_SECRET` | For `resolve-phone`; header `x-platform-secret` |
| `WEB_FORM_PREVIEW_CODE` | Optional; passed to availability if set |
| `DEFAULT_TENANT_SLUG` | Fallback when DID unknown (default `smilesquad`) |
| `DEFAULT_CALLED_DID` | Dev only: force DID when Connect does not pass one |
| `DEFAULT_PRACTICE_NAME` | Fallback display if resolve skipped |

## Connect / Lex setup

1. In the **Connect contact flow**, pass the called number into Lex session attributes, e.g.:
   - Attribute name: `calledDid` or `CalledNumber`
   - Value: `$.SystemEndpoint.Address` (the practice DID the patient dialed)

2. Seed the DID in Postgres:
   ```bash
   SEED_TENANT_PHONE_E164=+1XXXXXXXXXX npm run db:seed
   ```

3. Deploy Lambda:
   ```powershell
   .\scripts\deploy-lex-lambda-dev.ps1
   ```

4. Ensure ECS / Lambda env includes `DATABASE_URL` on the **Next.js** service (resolve-phone reads DB).

## Verify resolve-phone

```bash
curl -s -H "x-platform-secret: YOUR_SECRET" \
  "http://localhost:3000/api/internal/resolve-phone?did=%2B1XXXXXXXXXX"
```

Expect: `tenantSlug`, `botDisplayName`, `operatoryRules`, no PMS secrets.

## Fallback behavior

If DID is missing or not in DB → **`DEFAULT_TENANT_SLUG`** (`smilesquad`) + env operatory overrides.

If tenant has `features.voice: false` → call ends with a short unavailable message.

## Next: Phase 3

Admin portal to enable bots, map DIDs, edit display names (Amy, etc.).
