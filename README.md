# Dental Booking Platform

Multi-tenant dental practice SaaS: **voice booking (Amy)** via Amazon Connect + Lex, optional web booking, PMS integration (Oryx first). AWS-only; no GoHighLevel.

## Product model

- **Tenants** = dental practices (clinic owners register; patients do not).
- **Default:** one inbound **booking bot** per practice (display name e.g. Amy; editable in admin).
- **Add-on bots** (recall, intake, fax, etc.) enabled by platform admin on request.
- **Web booking form** is an optional add-on (`features.webForm`), not enabled by default for new tenants.

## Stack

- Next.js 16 (App Router), TypeScript, Prisma, Postgres
- Oryx MyChart HTTP APIs via `PmsAdapter`
- Amazon Connect + Lex (`scripts/lex-patient-booking-handler.js`)

## Quick start

```bash
cp .env.example .env.local
docker compose up -d postgres
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

- Web UI: http://localhost:3000/book  
- Docs: [docs/phase-0-dev.md](docs/phase-0-dev.md)  
- Roadmap PDF: [docs/Dental-Booking-Platform-Development-Phases.pdf](docs/Dental-Booking-Platform-Development-Phases.pdf)

## API overview

| Route | Purpose |
|-------|---------|
| `GET /api/t/[slug]/public-config` | Branding + feature flags |
| `GET /api/t/[slug]/availability` | Schedule slots |
| `POST /api/t/[slug]/book` | Web booking |
| `POST /api/book` | Lex/Connect booking (`x-api-key`) |
| `GET /api/internal/resolve-phone` | DID → tenant + bot |

Legacy Smile Squad routes: `/api/availability`, `/api/web/book` (tenant `smilesquad`).

## Development phases

| Phase | Focus |
|-------|--------|
| 0 ✓ | Postgres, tenants, Oryx adapter, APIs |
| 1 | `/book/[slug]`, web form feature gate |
| 2 | Multi-tenant Lex + `resolve-phone` |
| 3+ | Admin portal, extra bots, Stripe |

## HIPAA note

Store **minimum PHI** in platform DB; booking flows through to PMS. Encrypt RDS/S3 at rest, TLS in transit, AWS BAA for HIPAA-eligible services.

## Origin

Split from [dental-web-to-oryx](https://github.com/motasim-uxd/dental-web-to-oryx) (`oryx-agent`) — GHL integration removed.
