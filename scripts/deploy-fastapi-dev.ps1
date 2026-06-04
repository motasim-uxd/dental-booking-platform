# Build FastAPI image (services/api), push to ECR, roll DEV ECS service.
# First-time: create service oryx-agent-fastapi-dev (see docs/deploy-aws-dev.md#fastapi-on-ecs-dev).
param(
  [string]$Region = "us-east-1",
  [string]$ImageTag = "fastapi-dev",
  [string]$EcsCluster = "oryx-agent-dev",
  [string]$EcsService = "oryx-agent-fastapi-dev",
  [string]$TaskFamily = "oryx-agent-fastapi-dev",
  [switch]$CreateService
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Assert-LastExit($step) {
  if ($LASTEXITCODE -ne 0) { throw "$step failed (exit $LASTEXITCODE)" }
}

function Login-EcrRegistry {
  param([string]$Region, [string]$Registry)
  $token = (aws ecr get-login-password --region $Region).Trim()
  Assert-LastExit "ecr get-login-password"
  docker login --username AWS --password $token $Registry 2>&1 | Out-Null
  Assert-LastExit "docker login $Registry"
}

$AccountId = (aws sts get-caller-identity --query Account --output text).Trim()
Assert-LastExit "sts"
$Repo = "oryx-agent"
$EcrUri = "$AccountId.dkr.ecr.$Region.amazonaws.com/$Repo"
$ImageUri = "${EcrUri}:$ImageTag"
$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"

aws logs create-log-group --log-group-name "/ecs/oryx-agent-fastapi-dev" --region $Region 2>$null | Out-Null

Write-Host "Building FastAPI -> $ImageUri"
docker build -t "${Repo}:$ImageTag" ./services/api
Assert-LastExit "docker build services/api"

Login-EcrRegistry -Region $Region -Registry $Registry
docker tag "${Repo}:$ImageTag" $ImageUri
docker push $ImageUri
Assert-LastExit "docker push"

$SecretArn = (aws secretsmanager describe-secret --secret-id oryx-agent-dev/env --region $Region --query ARN --output text).Trim()
Assert-LastExit "describe-secret"

$containers = @(
  @{
    name = "fastapi"
    image = $ImageUri
    essential = $true
    portMappings = @(@{ containerPort = 8001; protocol = "tcp" })
    environment = @(
      @{ name = "FASTAPI_PORT"; value = "8001" }
    )
    secrets = @(
      @{ name = "APP_ENV_JSON"; valueFrom = $SecretArn }
      @{ name = "S2S_SHARED_SECRET"; valueFrom = "${SecretArn}:S2S_SHARED_SECRET::" }
      @{ name = "DATABASE_URL"; valueFrom = "${SecretArn}:DATABASE_URL::" }
    )
    logConfiguration = @{
      logDriver = "awslogs"
      options = @{
        "awslogs-group" = "/ecs/oryx-agent-fastapi-dev"
        "awslogs-region" = $Region
        "awslogs-stream-prefix" = "fastapi"
      }
    }
  }
) | ConvertTo-Json -Depth 10 -Compress

$containersPath = Join-Path $env:TEMP "fastapi-containers.json"
[System.IO.File]::WriteAllText($containersPath, $containers, [System.Text.UTF8Encoding]::new($false))
$containersFile = "file://$($containersPath -replace '\\','/')"

$ExecRole = "arn:aws:iam::${AccountId}:role/oryx-agent-dev-task-exec"
$TaskRole = "arn:aws:iam::${AccountId}:role/oryx-agent-dev-task"

$rev = (
  aws ecs register-task-definition `
    --region $Region `
    --family $TaskFamily `
    --requires-compatibilities FARGATE `
    --network-mode awsvpc `
    --cpu 256 `
    --memory 512 `
    --execution-role-arn $ExecRole `
    --task-role-arn $TaskRole `
    --container-definitions $containersFile `
    --query "taskDefinition.revision" `
    --output text
).Trim()
Assert-LastExit "register-task-definition"
Write-Host "Registered ${TaskFamily}:$rev"

$existing = aws ecs describe-services --cluster $EcsCluster --services $EcsService --region $Region --query "services[?status!='INACTIVE'].serviceName" --output text 2>$null
if ($existing -and $existing.Trim() -eq $EcsService) {
  aws ecs update-service --cluster $EcsCluster --service $EcsService --task-definition "${TaskFamily}:$rev" --force-new-deployment --region $Region | Out-Null
  Assert-LastExit "update-service"
  Write-Host "Updated ECS service $EcsService"
} elseif ($CreateService) {
  $main = aws ecs describe-services --cluster $EcsCluster --services oryx-agent-dev --region $Region --query "services[0].networkConfiguration.awsvpcConfiguration" --output json | ConvertFrom-Json
  $subnets = ($main.subnets -join ",")
  $sgs = ($main.securityGroups -join ",")
  aws ecs create-service `
    --cluster $EcsCluster `
    --service-name $EcsService `
    --task-definition "${TaskFamily}:$rev" `
    --desired-count 1 `
    --launch-type FARGATE `
    --network-configuration "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$sgs],assignPublicIp=DISABLED}" `
    --region $Region | Out-Null
  Assert-LastExit "create-service"
  Write-Host "Created ECS service $EcsService (private tasks; wire FASTAPI_BASE_URL in Next SM after Service Connect or internal DNS)."
} else {
  Write-Host "Service '$EcsService' not found. Re-run with -CreateService after adding S2S_SHARED_SECRET and DATABASE_URL to Secrets Manager."
  Write-Host "Image pushed: $ImageUri"
}

Write-Host "Done."
Write-Host "Add to oryx-agent-dev/env (or terraform output fastapi_internal_url):"
Write-Host "  FASTAPI_BASE_URL=http://fastapi.oryx-agent-dev.local:8001"
Write-Host "  S2S_SHARED_SECRET=<same as local>"
Write-Host "  DATABASE_URL=<RDS>"
Write-Host "Optional (after terraform apply): DYNAMODB_CONVERSATION_TABLE, SQS_* URLs — set on FastAPI task env in infra/fastapi.tf"
