# Deploy Next.js + FastAPI to AWS DEV ECS.
param(
  [switch]$CreateFastApiService,
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Deploy Next.js (oryx-agent:dev) ===" -ForegroundColor Cyan
& "$Root\scripts\deploy-ecs-dev.ps1" -Region $Region
if ($LASTEXITCODE -ne 0) { throw "deploy-ecs-dev failed" }

Write-Host ""
Write-Host "=== Deploy FastAPI (oryx-agent:fastapi-dev) ===" -ForegroundColor Cyan
$fastapiArgs = @("-Region", $Region)
if ($CreateFastApiService) { $fastapiArgs += "-CreateService" }
& "$Root\scripts\deploy-fastapi-dev.ps1" @fastapiArgs
if ($LASTEXITCODE -ne 0) { throw "deploy-fastapi-dev failed" }

Write-Host ""
Write-Host "=== Next steps ===" -ForegroundColor Green
Write-Host "1. Add FASTAPI_BASE_URL + S2S_SHARED_SECRET + DATABASE_URL to Secrets Manager oryx-agent-dev/env"
Write-Host "2. Redeploy Next ECS (deploy-ecs-dev.ps1) after SM update"
Write-Host "3. See docs/aws-deploy-quickstart.md"
