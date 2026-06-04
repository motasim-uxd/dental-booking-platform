# MVP chain test (local DEV)

Validates: **Next.js `POST /api/book`** → **FastAPI `/v1/booking`** → **Oryx** → **`booking_attempts`** mirror.

## Prerequisites

- `docker compose up -d postgres fastapi`
- `.env.local` aligned with AWS DEV ([secrets-alignment.md](./secrets-alignment.md))
- Root `.env` includes `S2S_SHARED_SECRET` (docker compose reads `.env`, not `.env.local`)
- `npm run dev` on port 3000

## 1. Health

```powershell
Invoke-RestMethod http://localhost:3000/api/internal/fastapi-health
```

Expect FastAPI reachable.

## 2. Pick a real slot (Oryx availability)

Legacy route with preview code (Smile Squad):

```powershell
$h = @{ "x-preview-code" = "SSQ-PREVIEW-2026" }
Invoke-RestMethod "http://localhost:3000/api/availability?date=2026-06-10&apptType=Cleaning&firstAvail=true" -Headers $h
```

Use a returned slot’s `date`, `start`, `end`, `dayOfWeek`, `operatoryId`, `oralId` in the book payload.

## 3. Book (Lex-shaped `BookSchema` body)

```powershell
$secret = "<CONNECT_WEBHOOK_SECRET from secrets-alignment>"
$body = @{
  apptType = "Cleaning"
  reason = "Cleaning"
  date = @{ year = 2026; month = 6; day = 10 }
  start = @{ hour = 15; minute = 30; second = 0; millis = 0 }
  end = @{ hour = 16; minute = 0; second = 0; millis = 0 }
  dayOfWeek = 3
  operatoryId = 6
  oralId = 2336
  firstName = "Mvp"
  lastName = "ChainTest"
  dob = @{ year = 2018; month = 3; day = 15 }
  email = "unique@example.com"
  phoneNumber = "+15555550199"
  newOrExisting = "new"
} | ConvertTo-Json -Depth 6

$h = @{
  "x-api-key" = $secret
  "Content-Type" = "application/json"
  "x-tenant-slug" = "smilesquad"
}
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/book" -Headers $h -Body $body
```

**Do not** use Lex slot names like `patientName` — use `firstName` / `lastName` per `lib/schemas.ts` (same as `buildPayloadFromSlots` in `scripts/lex-patient-booking-handler.js`).

## 4. Verify mirror row

```powershell
docker exec dental-booking-platform-postgres-1 psql -U dental -d dental_booking -c `
  "SELECT status, external_id, channel FROM booking_attempts ORDER BY created_at DESC LIMIT 5;"
```

## Last run (2026-06-04, local)

| Step | Result |
|------|--------|
| `/api/book` | `success: true`, `externalAppointmentId: 17920` |
| `booking_attempts` | `status=confirmed`, `external_id` set |

## AWS DEV (after P6)

Repeat with ALB URL and secrets from SM; Lex Lambdas already target `.../api/book` with aligned `CONNECT_WEBHOOK_SECRET`.
