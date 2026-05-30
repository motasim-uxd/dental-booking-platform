# Phase 0 — Multi-tenant foundation (local dev)

Phase 0 adds Postgres, Prisma, tenant registry, PMS adapter layer, and tenant-scoped API stubs. Smile Squad is seeded as tenant `smilesquad`.

## Prerequisites

- Node.js 20+
- Docker Desktop (or compatible runtime)

## 1. Start Postgres

From `oryx-agent/`:

```bash
docker compose up -d postgres
```

Connection string (default):

```
postgresql://dental:dental@localhost:5433/dental_booking
```

## 2. Environment

```bash
cp .env.example .env.local
```

Set at minimum:

- `DATABASE_URL` — as above
- `PLATFORM_INTERNAL_SECRET` — any long random string (resolve-phone)
- `CONNECT_WEBHOOK_SECRET` — same value Lex uses for `/api/book`
- `WEB_FORM_PREVIEW_CODE` — optional; gates web availability/book when set

Optional for seed:

- `SEED_TENANT_PHONE_E164=+1XXXXXXXXXX` — registers a DID for resolve-phone tests

## 3. Install and migrate

```bash
npm install
npx prisma migrate deploy
npm run db:seed
```

For iterative schema work use `npm run db:migrate` instead of `migrate deploy`.

Browse data: `npm run db:studio`

## 4. Run the app

```bash
npm run dev
```

## Manual verification

### resolve-phone

```bash
curl -s -H "x-platform-secret: YOUR_PLATFORM_INTERNAL_SECRET" \
  "http://localhost:3000/api/internal/resolve-phone?did=%2B15551234567"
```

Expect `404` until `SEED_TENANT_PHONE_E164` is set and seed re-run. With a seeded DID, expect JSON with `tenantSlug`, `botId`, `operatoryRules` (no PMS secrets).

Suspended tenant → `403`.

### Tenant public config

```bash
curl -s "http://localhost:3000/api/t/smilesquad/public-config"
```

### Availability (tenant-scoped)

Same query params as legacy `/api/availability`:

```bash
curl -s "http://localhost:3000/api/t/smilesquad/availability?date=2026-06-02&apptType=Cleaning"
```

If `WEB_FORM_PREVIEW_CODE` is set, add header `x-preview-code: YOUR_CODE` or `?code=YOUR_CODE`.

Legacy route should match shape:

```bash
curl -s "http://localhost:3000/api/availability?date=2026-06-02&apptType=Cleaning"
```

### Secure internal book

```bash
curl -s -X POST http://localhost:3000/api/book \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expect `401` without `x-api-key`. With valid `CONNECT_WEBHOOK_SECRET`, invalid body returns `400`.

Optional tenant header:

```
X-Tenant-Slug: smilesquad
```

## Architecture notes

- Operatory rules live in `tenant_pms_config.operatory_rules` (JSON), not `SMILE_SQUAD_*` env for tenant API paths.
- Legacy env vars still apply when `DATABASE_URL` is unset (single-tenant fallback).
- Lex Lambda multi-tenant wiring is **Phase 2** — see TODO in `scripts/lex-patient-booking-handler.js`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Can't reach database` | `docker compose ps` — wait for postgres healthy |
| Prisma client missing | `npm run db:generate` |
| 401 on availability | Set or pass `WEB_FORM_PREVIEW_CODE` |
| resolve-phone 503 | Set `PLATFORM_INTERNAL_SECRET` |
