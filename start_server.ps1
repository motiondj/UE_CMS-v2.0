# UE CMS Server PowerShell Script
Write-Host "🚀 Launching UE CMS v2.0 Server" -ForegroundColor Green
Write-Host ""

Set-Location -Path "$PSScriptRoot\server"

try {
    npm start
}
catch {
    Write-Host "❌ Error starting server: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
} 