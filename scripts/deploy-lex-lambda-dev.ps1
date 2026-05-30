# Deploy Lex V2 Connect code hook (PatientBooking) to dev Lambdas.
# Does not touch ECS / Next.js / app/book.
param(
  [string]$Region = "us-east-1",
  [string[]]$Functions = @(
    "smilesquad-lex-fulfillment-dev",
    "ssbooking-dev"
  ),
  [string]$Source = (Join-Path $PSScriptRoot "lex-patient-booking-handler.js")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Source)) {
  throw "Source not found: $Source"
}

$staging = Join-Path $env:TEMP "lex-lambda-deploy-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $staging -Force | Out-Null

try {
  Copy-Item -Path $Source -Destination (Join-Path $staging "index.mjs") -Force
  $zipPath = Join-Path $env:TEMP "lex-patient-booking-$(Get-Date -Format 'yyyyMMddHHmmss').zip"
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path (Join-Path $staging "index.mjs") -DestinationPath $zipPath -Force

  $zipItem = Get-Item $zipPath
  Write-Host "Package: $($zipItem.FullName) ($([math]::Round($zipItem.Length / 1KB, 1)) KB)"

  foreach ($fn in $Functions) {
    Write-Host "Updating $fn ..."
    aws lambda update-function-code `
      --region $Region `
      --function-name $fn `
      --zip-file "fileb://$zipPath" `
      --output json | ConvertFrom-Json | ForEach-Object {
        Write-Host "  OK  LastModified=$($_.LastModified)  CodeSha256=$($_.CodeSha256.Substring(0,12))..."
      }
  }

  Write-Host ""
  Write-Host "Deploy complete. Voice VAD: ~2s silence after speech ends a turn (see LEX_SPEECH_CAPTURE)."
  Write-Host "Tune LEX_SPEECH_CAPTURE.endSilenceMs in lex-patient-booking-handler.js if needed."
}
finally {
  if (Test-Path $staging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }
}
