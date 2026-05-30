# Quick check that ALB serves /book HTML and static assets (run from any PC on the network).
param(
  [string]$BaseUrl = "http://oryx-agent-dev-alb-25246280.us-east-1.elb.amazonaws.com"
)

$ErrorActionPreference = "Stop"
$book = "$BaseUrl/book?code=SSQ-PREVIEW-2026"
$health = "$BaseUrl/api/health"

Write-Host "Health: $health"
$h = curl.exe -sS -m 15 -w "`nHTTP %{http_code}`n" $health
Write-Host $h

Write-Host "`nBook HTML: $book"
$html = curl.exe -sS -m 20 $book
if ($html -notmatch "ss-ssr-fallback") { throw "Book HTML missing server shell" }
Write-Host "  OK: server shell present"

$scripts = [regex]::Matches($html, 'src="(/_next/static/[^"]+\.js)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
Write-Host "`nChecking $($scripts.Count) script tags..."
$failed = @()
foreach ($s in $scripts) {
  $code = curl.exe -sS -m 45 -o NUL -w "%{http_code}" "$BaseUrl$s"
  if ($code -ne "200") { $failed += "$code $s" }
  Write-Host "  $code $s"
}
if ($failed.Count) {
  Write-Host "`nFAILED assets (page may hang in browser):" -ForegroundColor Red
  $failed | ForEach-Object { Write-Host "  $_" }
  exit 1
}
Write-Host "`nAll checked scripts returned 200. If browser still hangs, open DevTools -> Network on /book." -ForegroundColor Green
