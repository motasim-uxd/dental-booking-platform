# Deploy to AWS (dev) — public URL

## 1. Push code (done via GitHub)

```bash
git push origin main
```

## 2. Prerequisites

- Docker Desktop **running**
- AWS CLI logged in (`aws sts get-caller-identity`)
- Terraform already applied once in `infra/` (ECS + ALB exist)

## 3. Deploy app image + roll ECS

From repo root:

```powershell
cd e:\Projects\dental-booking-platform
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-ecs-dev.ps1
```

Wait 10–20 minutes (Docker build + push). If build fails on `prisma/schema.prisma not found`, pull latest `main` (Dockerfile copies `prisma/` before `npm ci`).

At the end you should see a line like:

```text
http://oryx-agent-dev-alb-xxxxxxxx.us-east-1.elb.amazonaws.com/book?code=...
```

**Use `http://`**, not `https://`, until ACM/HTTPS is added.

## 4. Public URLs (replace `<alb-dns>`)

| Page | URL |
|------|-----|
| Web booking | `http://<alb-dns>/book/smilesquad` |
| Platform admin | `http://<alb-dns>/admin` |
| Practice portal | `http://<alb-dns>/practice/login` |
| Health | `http://<alb-dns>/api/health` |

Get `<alb-dns>`:

```powershell
cd infra
terraform output -raw alb_dns_name
```

If that errors, refresh outputs: `terraform apply -var-file=dev.tfvars -var="app_image=264627803620.dkr.ecr.us-east-1.amazonaws.com/oryx-agent:dev"` (use your account id from `aws sts get-caller-identity`).

Or AWS Console → EC2 → Load Balancers → `oryx-agent-dev-alb` → DNS name.

## 5. Secrets Manager (required for admin / practice / multi-tenant)

ECS reads **`APP_ENV_JSON`** from secret `oryx-agent-dev/env` (name may vary).

In AWS Console → Secrets Manager → edit JSON:

```json
{
  "DATABASE_URL": "postgresql://USER:PASS@HOST:5432/dental_booking",
  "PLATFORM_INTERNAL_SECRET": "...",
  "CONNECT_WEBHOOK_SECRET": "...",
  "PLATFORM_ADMIN_SECRET": "...",
  "WEB_FORM_PREVIEW_CODE": "SSQ-PREVIEW-2026"
}
```

Then re-run deploy script or:

```bash
aws ecs update-service --region us-east-1 --cluster oryx-agent-dev --service oryx-agent-dev --force-new-deployment
```

Run migrations against that database (from your PC or a one-off task):

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
npm run db:seed
```

Without `DATABASE_URL`, `/book` may still work in legacy mode; `/admin` and `/practice` need Postgres.

## 6. Verify

- Open `/api/health` → `200`
- Open `/admin` → login with `PLATFORM_ADMIN_SECRET`
- Open `/book/smilesquad` (with web form enabled + preview code if set)
