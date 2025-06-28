# UE CMS Web UI Builder PowerShell Script
Write-Host "🔨 Building UE CMS Web UI..." -ForegroundColor Green
Write-Host ""

Set-Location -Path "$PSScriptRoot\web-ui-react"

try {
    Write-Host "[1/3] Installing dependencies..." -ForegroundColor Yellow
    npm install
    
    Write-Host "[2/3] Building React app..." -ForegroundColor Yellow
    npm run build
    
    Write-Host "[3/3] Copying to server public folder..." -ForegroundColor Yellow
    Copy-Item -Path "build\*" -Destination "..\server\public\" -Recurse -Force
    
    Write-Host ""
    Write-Host "✅ Web UI build completed!" -ForegroundColor Green
    Write-Host "📱 Access at: http://localhost:8000" -ForegroundColor Cyan
}
catch {
    Write-Host "❌ Error building web UI: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    Read-Host "Press Enter to exit"
} 