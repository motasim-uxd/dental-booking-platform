# Phase 3 — Platform admin portal

## URL

http://localhost:3000/admin

Password = value of `PLATFORM_ADMIN_SECRET` in `.env.local`.

## Capabilities

- List / create / edit **tenants** (practices)
- Toggle **voice** and **web form** add-on (`features.voice`, `features.webForm`)
- Edit **branding** (web) and **Oryx realm**
- Manage **bots** (up to `maxBots`, default 8): enable/disable, edit display name (Amy, etc.)
- Map **phone DIDs** to bots for Lex `resolve-phone`

## API (optional automation)

All routes accept session cookie or header:

```
x-admin-secret: <PLATFORM_ADMIN_SECRET>
```

- `GET/POST /api/admin/tenants`
- `GET/PATCH/DELETE /api/admin/tenants/:id`
- `POST /api/admin/tenants/:id/bots`
- `PATCH/DELETE /api/admin/tenants/:id/bots/:botId`
- `POST /api/admin/tenants/:id/phones`
- `DELETE /api/admin/tenants/:id/phones/:phoneId`

## After changing a tenant

`TenantService` cache clears automatically. Redeploy Lex only if bot **display** or Connect ARNs change — operatory rules refresh on next call via `resolve-phone`.

## Not in Phase 3

- Practice-owner portal → [phase-3b-dev.md](phase-3b-dev.md)
- S3 logo upload (use branding JSON URLs for now)
- Stripe billing (last phase — see README)

## Generate session token (optional)

For edge middleware, login uses HMAC of `PLATFORM_ADMIN_SECRET`. You may set `ADMIN_SESSION_TOKEN` to a precomputed hex if needed.

```bash
node -e "const c=require('crypto');const s=process.env.PLATFORM_ADMIN_SECRET||'';console.log(c.createHmac('sha256',s).update('platform-admin-session-v1').digest('hex'))"
```
