# Phase 3b — Practice owner portal

## URLs

| URL | Purpose |
|-----|---------|
| http://localhost:3000/practice/register | New practice signup |
| http://localhost:3000/practice/login | Practice admin login |
| http://localhost:3000/practice | Dashboard (status, request web form) |

Platform operator admin remains at `/admin` (separate login).

## What signup creates

- `tenants` row — `status: trial`, `features: { voice: true, webForm: false }`
- `tenant_pms_config` — Oryx, realm from form or slug
- Default `booking` bot (Amy)
- `platform_users` — one **practice_admin** per tenant (email + password)
- `subscriptions` stub — billing in a later phase (Stripe last)

## Environment

Practice sessions need a signing secret. **Any one** of these in `.env.local` works (first wins):

```env
PRACTICE_SESSION_SECRET=any-long-random-string
# or reuse an existing secret:
PLATFORM_INTERNAL_SECRET=...
PLATFORM_ADMIN_SECRET=...   # same value you use for /admin login
```

Restart `npm run dev` after changing env.

```env
# Set to false to disable public registration
PRACTICE_SIGNUP_ENABLED=true
```

## Web form add-on workflow

1. Owner clicks **Request web booking form** on `/practice`
2. Sets `features.webFormRequestedAt` in DB
3. Platform ops enables `webForm` in `/admin` and optional access code

## Not included (later)

- Stripe checkout
- Multiple staff users per practice
- Self-service DID / Connect provisioning
- In-app phone test

## Migrate

```bash
npx prisma migrate deploy
```
