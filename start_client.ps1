# UE CMS Client PowerShell Script
Write-Host "🚀 Launching UE CMS v2.0 Client" -ForegroundColor Green
Write-Host ""

Set-Location -Path "$PSScriptRoot\client"

try {
    # Activate virtual environment
    & ".\venv\Scripts\Activate.ps1"
    
    # Start client
    python client.py
}
catch {
    Write-Host "❌ Error starting client: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
} 