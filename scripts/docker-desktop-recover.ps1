# Recover Docker Desktop when "500 Internal Server Error" on dockerDesktopLinuxEngine.
# Run from PowerShell (Admin not required). Then start Docker Desktop manually.
$ErrorActionPreference = "Continue"

Write-Host "Stopping WSL (this stops the Docker Desktop Linux engine)..."
wsl --shutdown
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Open Docker Desktop from the Start menu."
Write-Host "  2. Wait until it shows Running (whale icon steady, no Starting...)."
Write-Host "  3. In PowerShell: docker info"
Write-Host "     (must complete without 500 errors)"
Write-Host "  4. Deploy: powershell -ExecutionPolicy Bypass -File .\scripts\deploy-ecs-dev.ps1"
Write-Host ""
Write-Host "If docker info still fails:"
Write-Host "  Docker Desktop -> Troubleshoot -> Restart Docker Desktop"
Write-Host "  or Reset to factory defaults (last resort)"
Write-Host "  Ensure WSL2 is enabled and Docker Desktop is updated."
