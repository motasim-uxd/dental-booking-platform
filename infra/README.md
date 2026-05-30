# AWS infra (Terraform)

This folder provisions the first AWS phase of the architecture:

- VPC (public + private subnets, NAT)
- ECR repo for the `oryx-agent` container
- ECS Fargate cluster + service behind an ALB
- CloudWatch logs for the service
- Secrets Manager placeholders for runtime secrets (you set values)

Later phases (Connect/Lex/Bedrock, event-driven pipeline, RDS/Dynamo, etc.) can be layered on.

## Prereqs

- Terraform installed
- AWS credentials for an account you control (ideally a dedicated non-prod account first)

## Usage (dev)

1) Create an ECR image

```bash
cd oryx-agent
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
docker build --build-arg "NEXT_PUBLIC_BUILD_ID=$(git rev-parse --short HEAD 2>/dev/null || echo dev)" -t oryx-agent:dev .
docker tag oryx-agent:dev <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/oryx-agent:dev
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/oryx-agent:dev
```

2) Deploy infra

```bash
cd infra
terraform init
terraform apply -var="app_image=<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/oryx-agent:dev"
```

3) Set secrets

The task injects **one** environment variable, `APP_ENV_JSON`, from Secrets Manager. It must be **valid JSON** (an object). On startup, the app merges these keys into `process.env` (see `oryx-agent/instrumentation.ts`), for example:

```json
{ "WEB_FORM_PREVIEW_CODE": "SSQ-PREVIEW-2026" }
```

If the secret is not JSON, or `WEB_FORM_PREVIEW_CODE` is missing while the form enforces a code, availability and booking can return **401**. Add any other string env keys the app reads the same way.

## Redeploy after code changes (common “I don’t see my changes” fix)

Terraform only updates the running tasks when the **task definition** changes (for example when `app_image` changes). If you keep pushing to the **same** tag (for example `:dev`), AWS may still run **old tasks** until you roll the service.

After each `docker push`, either:

- **Bump the image tag** (recommended): `oryx-agent:2026-05-04-gitsha` and `terraform apply -var="app_image=...:2026-05-04-gitsha"`, **or**
- **Force ECS to start new tasks** (same tag):

```bash
aws ecs update-service \
  --region us-east-1 \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --service "$(terraform output -raw ecs_service_name)" \
  --force-new-deployment
```

The `/book` page shows a small **Build** line when the image was built with `NEXT_PUBLIC_BUILD_ID` (see `Dockerfile` and `scripts/deploy-ecs-dev.ps1`). If that line is missing or stuck on an old value, the ALB is still hitting an old image.

## Public access (sharing the booking link)

The dev ALB is **internet-facing** and allows HTTP from anywhere (`0.0.0.0/0` on port 80). **AWS login on your PC does not gate access** — if only your machine works, you are usually hitting a different URL than everyone else.

| Works on your dev PC | Often fails on phones / other PCs |
|----------------------|----------------------------------|
| `http://oryx-agent-dev-alb-….elb.amazonaws.com/book?...` | `https://…` (no TLS listener yet — connection times out) |
| `http://localhost:3000/book` | Same localhost link on another device |
| Full hostname copied from Terraform/deploy output | Hostname only, no `http://` (browser tries HTTPS first) |

After deploy, print the shareable link:

```bash
cd infra
terraform output -raw book_preview_url
```

**Share exactly that string** (including `http://`). Test from another device on cellular (not office Wi‑Fi): open Safari/Chrome and paste the full URL.

Until you add **HTTPS (ACM + custom domain)**, do not send bare hostnames in SMS/QR — many clients upgrade to `https://` and the page will look “unreachable.”

`npm run dev` on `localhost` is only for your machine; other devices need the ALB URL above (or a future custom domain).

