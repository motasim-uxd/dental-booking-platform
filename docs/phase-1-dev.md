# Phase 1 — Multi-tenant web booking form

## Delivered

- **`/book/[slug]`** — tenant-scoped booking wizard (e.g. `/book/smilesquad`)
- **`/book`** — redirects to `/book/smilesquad` (legacy URL)
- **Dynamic branding** from `tenants.branding` JSON (name, tagline, address, phone, website)
- **Tenant APIs** — wizard calls `/api/t/[slug]/availability` and `/api/t/[slug]/book`
- **Feature gate** — if `features.webForm` is `false`, shows “call the office” page (403-style UX, no wizard)
- **Access code** — when tenant has `web_form_access_code` or env `WEB_FORM_PREVIEW_CODE`, preview gate applies

## Try it

```bash
npm run dev
```

- Smile Squad: http://localhost:3000/book/smilesquad  
- Legacy redirect: http://localhost:3000/book  
- Public config: http://localhost:3000/api/t/smilesquad/public-config  

With preview code (if configured):

http://localhost:3000/book/smilesquad?code=YOUR_CODE

## Disable web form (test gate)

```sql
UPDATE tenants SET features = '{"voice":true,"webForm":false}' WHERE slug = 'smilesquad';
```

Reload `/book/smilesquad` — should show unavailable page.

## Next: Phase 2

Multi-tenant Lex (Amy) via `resolve-phone` and tenant `prompts_config`.
