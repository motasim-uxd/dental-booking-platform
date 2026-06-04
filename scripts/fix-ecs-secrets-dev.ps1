# Register oryx-agent-dev task with APP_ENV_JSON only (DEV SM is pseudo-JSON, not per-key JSON).
# Use after deploy when new tasks fail: invalid character 'A' looking for beginning of object key string
param(
  [string]$Region = "us-east-1",
  [string]$Cluster = "oryx-agent-dev",
  [string]$Service = "oryx-agent-dev",
  [string]$Family = "oryx-agent-dev",
  [string]$ImageUri = "264627803620.dkr.ecr.us-east-1.amazonaws.com/oryx-agent:dev"
)

$ErrorActionPreference = "Stop"

$q = "taskDefinition"
$base = aws ecs describe-task-definition --task-definition $Family --region $Region --query $q --output json | ConvertFrom-Json

$containers = $base.containerDefinitions
if ($containers -isnot [System.Array]) { $containers = @($containers) }

$appArn = ($containers[0].secrets | Where-Object { $_.name -eq "APP_ENV_JSON" }).valueFrom
if (-not $appArn) { throw "APP_ENV_JSON secret ARN not found on task family $Family" }

$containers[0].image = $ImageUri
$containers[0].secrets = @(@{ name = "APP_ENV_JSON"; valueFrom = $appArn })

$path = Join-Path $env:TEMP "ecs-containers-app-env-only.json"
$json = if ($containers.Count -eq 1) {
  "[$(($containers[0] | ConvertTo-Json -Depth 15 -Compress))]"
} else {
  $containers | ConvertTo-Json -Depth 15 -Compress
}
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $json, $utf8)
$file = "file://$($path -replace '\\','/')"

$rev = (
  aws ecs register-task-definition `
    --region $Region `
    --family $base.family `
    --requires-compatibilities FARGATE `
    --network-mode $base.networkMode `
    --cpu $base.cpu `
    --memory $base.memory `
    --execution-role-arn $base.executionRoleArn `
    --task-role-arn $base.taskRoleArn `
    --container-definitions $file `
    --query "taskDefinition.revision" `
    --output text
).Trim()

Write-Host "Registered $($base.family):$rev (APP_ENV_JSON only)"
aws ecs update-service --region $Region --cluster $Cluster --service $Service --task-definition "$($base.family):$rev" --force-new-deployment | Out-Null
Write-Host "Service $Service rolling to :$rev - wait 2-3 min, then open /book/smilesquad"
