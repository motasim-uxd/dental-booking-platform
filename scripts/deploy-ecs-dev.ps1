# Build dental-booking-platform, push to ECR (oryx-agent repo), roll ECS dev service.
# Prereqs: AWS CLI v2, Docker Desktop running, Terraform state in infra/
param(
  [string]$Region = "us-east-1",
  [string]$ImageTag = "dev",
  [string]$EcsCluster = "",
  [string]$EcsService = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Assert-LastExit($step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$step failed (exit $LASTEXITCODE). Fix Docker/AWS, then re-run this script."
  }
}

# PowerShell: piping to --password-stdin can corrupt the token (ECR 400). stderr warnings must not abort Stop.
function Login-EcrRegistry {
  param([string]$Region, [string]$Registry)
  docker logout $Registry 2>$null | Out-Null

  $token = (aws ecr get-login-password --region $Region 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $token) {
    throw "aws ecr get-login-password failed: $token"
  }

  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $hadNative = Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue
  if ($hadNative) { $prevNative = $PSNativeCommandUseErrorActionPreference; $PSNativeCommandUseErrorActionPreference = $false }

  try {
    # --password avoids stdin encoding issues on Windows; Docker prints a stderr WARNING (not a failure).
    docker login --username AWS --password $token $Registry 2>&1 | ForEach-Object {
      $line = "$_"
      if ($line -match "Login Succeeded") { Write-Host $line -ForegroundColor Green }
      elseif ($line -match "WARNING") { Write-Host $line -ForegroundColor DarkYellow }
      else { Write-Host $line }
    }
    Assert-LastExit "docker login to ECR ($Registry)"
  } finally {
    $ErrorActionPreference = $prevEap
    if ($hadNative) { $PSNativeCommandUseErrorActionPreference = $prevNative }
  }
}

$AccountId = (aws sts get-caller-identity --query Account --output text).Trim()
Assert-LastExit "aws sts get-caller-identity"
if (-not $AccountId) { throw "AWS CLI not configured or no account id." }

$Repo = "oryx-agent"
$EcrUri = "$AccountId.dkr.ecr.$Region.amazonaws.com/$Repo"

$BuildId = "unknown"
try {
  $git = git -C $Root rev-parse --short HEAD 2>$null
  if ($git) { $BuildId = $git.Trim() }
} catch { }

Write-Host "ECR: $EcrUri`:$ImageTag  NEXT_PUBLIC_BUILD_ID=$BuildId"

$beforePush = aws ecr describe-images --repository-name $Repo --region $Region --image-ids "imageTag=$ImageTag" --query "imageDetails[0].imagePushedAt" --output text 2>$null
Write-Host "ECR image before push: $beforePush"

Write-Host "Checking Docker..."
try {
  docker info *> $null
  Assert-LastExit "docker info"
} catch {
  Write-Host ""
  Write-Host "Docker Desktop engine is not responding (500 on dockerDesktopLinuxEngine)."
  Write-Host "Fix: powershell -ExecutionPolicy Bypass -File .\scripts\docker-desktop-recover.ps1"
  Write-Host "     Then start Docker Desktop and re-run this deploy script."
  throw
}

$EcrRegistry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
Write-Host "Logging in to ECR registry $EcrRegistry ..."
Login-EcrRegistry -Region $Region -Registry $EcrRegistry
Write-Host "ECR login OK."

docker build --build-arg "NEXT_PUBLIC_BUILD_ID=$BuildId" -t "${Repo}:$ImageTag" .
Assert-LastExit "docker build"

docker tag "${Repo}:$ImageTag" "${EcrUri}:$ImageTag"
Assert-LastExit "docker tag"

docker push "${EcrUri}:$ImageTag"
Assert-LastExit "docker push"

$afterPush = aws ecr describe-images --repository-name $Repo --region $Region --image-ids "imageTag=$ImageTag" --query "imageDetails[0].imagePushedAt" --output text
Assert-LastExit "ecr describe-images"
Write-Host "ECR image after push:  $afterPush"
if ($afterPush -eq $beforePush) {
  throw "ECR tag '$ImageTag' push did not update imagePushedAt. Push may have failed silently."
}

function Update-EcsServiceImage {
  param(
    [string]$Region,
    [string]$Cluster,
    [string]$Service,
    [string]$Family,
    [string]$ImageUri
  )

  if (-not $Family) { throw "ECS task family name is empty (check terraform output)." }

  $q = "taskDefinition"
  $containersJson = aws ecs describe-task-definition --task-definition $Family --region $Region --query "$q.containerDefinitions" --output json
  Assert-LastExit "describe-task-definition $Family"
  if (-not $containersJson -or $containersJson.Trim() -eq "null") {
    throw "No containerDefinitions returned for task family '$Family'."
  }

  # AWS returns one container as object; PowerShell needs an array for [0].
  $containers = $containersJson | ConvertFrom-Json
  if (-not $containers) { throw "Failed to parse containerDefinitions JSON." }
  if ($containers -isnot [System.Array]) { $containers = @($containers) }
  if ($containers.Count -lt 1) { throw "Task '$Family' has no containers." }

  # Per-key SM refs (e.g. :CONNECT_WEBHOOK_SECRET::) require strict JSON in Secrets Manager.
  # DEV secret uses pseudo-JSON in APP_ENV_JSON only — keep that single injection (see instrumentation.ts).
  $appEnvSecret = $null
  foreach ($s in $containers[0].secrets) {
    if ($s.name -eq "APP_ENV_JSON" -and $s.valueFrom -notmatch ":[A-Za-z0-9_]+::") {
      $appEnvSecret = $s
      break
    }
  }
  if (-not $appEnvSecret -and $containers[0].secrets.Count -gt 0) {
    $appEnvSecret = $containers[0].secrets | Where-Object { $_.valueFrom -notmatch ":[A-Za-z0-9_]+::" } | Select-Object -First 1
  }
  if ($appEnvSecret) {
    $containers[0].secrets = @($appEnvSecret)
    Write-Host "ECS secrets: APP_ENV_JSON only (removed per-key SM refs that break task startup)."
  }

  $containers[0].image = $ImageUri
  $patchedContainersJson = ($containers | ConvertTo-Json -Depth 12 -Compress)

  $taskFamily = (aws ecs describe-task-definition --task-definition $Family --region $Region --query "$q.family" --output text).Trim()
  $taskRoleArn = (aws ecs describe-task-definition --task-definition $Family --region $Region --query "$q.taskRoleArn" --output text).Trim()
  $executionRoleArn = (aws ecs describe-task-definition --task-definition $Family --region $Region --query "$q.executionRoleArn" --output text).Trim()
  $networkMode = (aws ecs describe-task-definition --task-definition $Family --region $Region --query "$q.networkMode" --output text).Trim()
  $cpu = (aws ecs describe-task-definition --task-definition $Family --region $Region --query "$q.cpu" --output text).Trim()
  $memory = (aws ecs describe-task-definition --task-definition $Family --region $Region --query "$q.memory" --output text).Trim()

  if (-not $taskFamily) { throw "Could not read task family from $Family." }

  $containersPath = Join-Path $env:TEMP "ecs-containers-$Family.json"
  [System.IO.File]::WriteAllText($containersPath, $patchedContainersJson, [System.Text.UTF8Encoding]::new($false))
  $containersFile = "file://$($containersPath -replace '\\','/')"

  $rev = (
    aws ecs register-task-definition `
      --region $Region `
      --family $taskFamily `
      --requires-compatibilities FARGATE `
      --network-mode $networkMode `
      --cpu $cpu `
      --memory $memory `
      --execution-role-arn $executionRoleArn `
      --task-role-arn $taskRoleArn `
      --container-definitions $containersFile `
      --query "taskDefinition.revision" `
      --output text
  ).Trim()
  Assert-LastExit "ecs register-task-definition"
  Write-Host "Registered task definition ${taskFamily}:$rev with image $ImageUri"

  aws ecs update-service --region $Region --cluster $Cluster --service $Service --task-definition "${taskFamily}:$rev" --force-new-deployment | Out-Null
  Assert-LastExit "ecs update-service"
}

function Get-TfOutputValue {
  param([string]$Name, [string]$InfraDir)
  $statePath = Join-Path $InfraDir "terraform.tfstate"
  if (Test-Path $statePath) {
    try {
      $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
      $val = $state.outputs.$Name.value
      if ($val) { return "$val".Trim() }
    } catch { }
  }

  Push-Location $InfraDir
  try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $hadNative = Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue
    if ($hadNative) { $prevNative = $PSNativeCommandUseErrorActionPreference; $PSNativeCommandUseErrorActionPreference = $false }
    try {
      $out = & terraform output -raw $Name 2>$null
      if ($LASTEXITCODE -eq 0 -and $out) { return "$out".Trim() }
    } finally {
      $ErrorActionPreference = $prevEap
      if ($hadNative) { $PSNativeCommandUseErrorActionPreference = $prevNative }
    }
  } finally {
    Pop-Location
  }
  return $null
}

$InfraDir = Join-Path $Root "infra"
if (-not (Test-Path $InfraDir)) { throw "Missing infra folder at $InfraDir" }

$Cluster = if ($EcsCluster) { $EcsCluster.Trim() } else { Get-TfOutputValue -Name "ecs_cluster_name" -InfraDir $InfraDir }
$Service = if ($EcsService) { $EcsService.Trim() } else { Get-TfOutputValue -Name "ecs_service_name" -InfraDir $InfraDir }

if (-not $Cluster) { $Cluster = "oryx-agent-dev" }
if (-not $Service) { $Service = "oryx-agent-dev" }

$Family = $Service
Write-Host "ECS cluster=$Cluster service=$Service family=$Family"
$ImageUri = "${AccountId}.dkr.ecr.$Region.amazonaws.com/${Repo}:$ImageTag"
Write-Host "Updating ECS to use pushed image (not only force-redeploy of an old pinned tag)..."
Update-EcsServiceImage -Region $Region -Cluster $Cluster -Service $Service -Family $Family -ImageUri $ImageUri

$AlbDns = Get-TfOutputValue -Name "alb_dns_name" -InfraDir $InfraDir
if ($AlbDns) {
  $BookUrl = "http://$AlbDns/book?code=SSQ-PREVIEW-2026"
  Write-Host ""
  Write-Host "Shareable booking URL (HTTP only - https will NOT work until ACM is added):" -ForegroundColor Cyan
  Write-Host $BookUrl
  Write-Host "Copy the full line including http://. Other devices cannot use localhost." -ForegroundColor DarkYellow
}

Write-Host "Done. Wait 2-3 min for the new task, then open /book in a private window."
Write-Host "Verify live HTML contains new UI, e.g. 'I am existing patient' and class ss-btn-success."
