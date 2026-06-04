# Internal PMS (DEV)

## Tenants

| Slug | Mode | Notes |
|------|------|-------|
| `smilesquad` | `external_only` | Live Oryx — unchanged |
| `demo-internal` | `internal_only` | Platform DB is source of truth |

Seed: `npm run db:seed`

## FastAPI

- **Book:** `POST /v1/booking` with same `BookSchema`-shaped `payload` as Lex.
- **Availability:** `GET /v1/availability?tenant_slug=demo-internal&date=YYYY-MM-DD&appt_type=Cleaning`

Requires `x-s2s-secret` (see [fastapi-dev-setup.md](./fastapi-dev-setup.md)).

## Dual mode (Smile Squad mirror)

In `/admin` → tenant → set **Integration mode** = `dual` and enable **Dual booking enabled**.

- External Oryx book runs first.
- Internal mirror runs second.
- If mirror fails, `booking_attempts.status` = `partial` (external id still set).

Leave Smile Squad on `external_only` until you intentionally test dual.

## View bookings in the practice portal

1. Seed: `npm run db:seed` (creates `demo-internal` + practice user).
2. Sign in: http://localhost:3000/practice/login  
   - Email: `demo-internal@example.com` (or `SEED_DEMO_INTERNAL_EMAIL`)  
   - Password: `DemoInternal1!` (or `SEED_DEMO_INTERNAL_PASSWORD`)
3. Open **Appointments**: http://localhost:3000/practice/appointments  
4. Create a booking via http://localhost:3000/book/demo-internal (preview code from seed / `WEB_FORM_PREVIEW_CODE`) or FastAPI `POST /v1/booking`.
5. Click **Refresh** on the appointments page — the row appears from the `appointments` table.

Requires `DATABASE_URL`, and for web/voice book paths: FastAPI + `FASTAPI_BASE_URL` + `S2S_SHARED_SECRET` when Next proxies booking to FastAPI.

## Local test (PowerShell)

```powershell
$s2s = "<S2S_SHARED_SECRET>"
$h = @{ "x-s2s-secret" = $s2s }
Invoke-RestMethod "http://localhost:8001/v1/availability?tenant_slug=demo-internal&date=2026-06-12&apptType=Cleaning&first_avail=true" -Headers $h
```

Then book using slot fields from `data[0]` in a `POST /v1/booking` body (see [mvp-chain-test.md](./mvp-chain-test.md) shape).
