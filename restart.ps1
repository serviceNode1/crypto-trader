#!/usr/bin/env pwsh
# Crypto Trading Bot - Restart Script
# Stops any running instance and starts fresh with full logs

Write-Host "🔄 Restarting Crypto AI Trading System..." -ForegroundColor Cyan
Write-Host ""

# Kill any process running on port 3000
Write-Host "🛑 Stopping any existing server on port 3000..." -ForegroundColor Yellow
try {
    $process = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($process) {
        Stop-Process -Id $process -Force
        Write-Host "✅ Stopped existing server (PID: $process)" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "ℹ️  No existing server found" -ForegroundColor Gray
    }
} catch {
    Write-Host "ℹ️  No existing server found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🚀 Starting server with fresh configuration..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""

# Start the development server
npm run dev
