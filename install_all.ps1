# UE CMS Install All PowerShell Script
Write-Host "📦 Installing all dependencies for UE CMS v2.0..." -ForegroundColor Green
Write-Host ""

try {
    Write-Host "[1/4] Installing root dependencies..." -ForegroundColor Yellow
    npm install
    
    Write-Host "[2/4] Installing server dependencies..." -ForegroundColor Yellow
    Set-Location -Path "$PSScriptRoot\server"
    npm install
    
    Write-Host "[3/4] Installing web UI dependencies..." -ForegroundColor Yellow
    Set-Location -Path "$PSScriptRoot\web-ui-react"
    npm install
    
    Write-Host "[4/4] Installing Python dependencies..." -ForegroundColor Yellow
    Set-Location -Path "$PSScriptRoot\client"
    if (Test-Path "venv") {
        Write-Host "Virtual environment already exists, skipping creation" -ForegroundColor Gray
    } else {
        Write-Host "Creating Python virtual environment..." -ForegroundColor Gray
        python -m venv venv
    }
    
    # Activate virtual environment and install dependencies
    & ".\venv\Scripts\Activate.ps1"
    pip install -r requirements.txt
    
    Write-Host ""
    Write-Host "✅ All dependencies installed successfully!" -ForegroundColor Green
    Write-Host "🚀 You can now run the following commands:" -ForegroundColor Cyan
    Write-Host "   - .\start_server.ps1 (to start the server)" -ForegroundColor White
    Write-Host "   - .\start_client.ps1 (to start a client)" -ForegroundColor White
    Write-Host "   - .\build_web_ui.ps1 (to build the web UI)" -ForegroundColor White
}
catch {
    Write-Host "❌ Error during installation: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    Read-Host "Press Enter to exit"
} 