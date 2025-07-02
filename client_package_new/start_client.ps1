# UE CMS Client v2.0 PowerShell Script
Write-Host "UE CMS Client v2.0" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green
Write-Host ""

# Python 설치 확인
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python 버전: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python이 설치되지 않았습니다." -ForegroundColor Red
    Write-Host "Python 3.7 이상을 설치해주세요: https://www.python.org/downloads/" -ForegroundColor Yellow
    Read-Host "Enter를 눌러 종료"
    exit 1
}

# 서버 IP 주소 입력 받기
$serverIP = Read-Host "서버 IP 주소를 입력하세요 (예: 192.168.1.100)"

# 클라이언트 이름 입력 받기
$clientName = Read-Host "클라이언트 이름을 입력하세요 (예: Display_01)"

Write-Host ""
Write-Host "서버 연결 시도: http://$serverIP:8000" -ForegroundColor Cyan
Write-Host "클라이언트 이름: $clientName" -ForegroundColor Cyan
Write-Host ""

# 가상환경 생성 및 활성화
if (-not (Test-Path "venv")) {
    Write-Host "🔧 가상환경 생성 중..." -ForegroundColor Yellow
    python -m venv venv
}

Write-Host "🔧 가상환경 활성화 중..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"

Write-Host "📦 pip 업그레이드 중..." -ForegroundColor Yellow
python -m pip install --upgrade pip

Write-Host "📦 필요한 패키지 설치 중..." -ForegroundColor Yellow
Write-Host "⚠️ Pillow 설치 중... (시간이 걸릴 수 있습니다)" -ForegroundColor Yellow
pip install pillow==9.5.0

Write-Host "📦 나머지 패키지 설치 중..." -ForegroundColor Yellow
pip install python-socketio==5.8.0 requests==2.31.0 psutil==5.9.5 pystray==0.19.4 wmi==1.5.1 websocket-client==1.6.4

Write-Host "🚀 클라이언트 시작 중..." -ForegroundColor Green
python client_tray.py --server "http://$serverIP:8000" --name "$clientName"

Read-Host "Enter를 눌러 종료"
