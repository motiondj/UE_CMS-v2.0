# UE CMS Client Package Builder (PowerShell)
# 클라이언트를 실행 파일로 빌드하고 배포 패키지를 생성합니다.

Write-Host "🚀 UE CMS Client Package Builder" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Python 설치 확인
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python 발견: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python이 설치되지 않았습니다." -ForegroundColor Red
    Write-Host "https://python.org에서 Python을 다운로드하여 설치하세요." -ForegroundColor Yellow
    Read-Host "계속하려면 아무 키나 누르세요"
    exit 1
}

# PyInstaller 설치 확인 및 설치
Write-Host "PyInstaller 설치 확인 중..." -ForegroundColor Yellow
try {
    python -c "import PyInstaller" 2>$null
    Write-Host "✅ PyInstaller가 이미 설치되어 있습니다." -ForegroundColor Green
} catch {
    Write-Host "PyInstaller 설치 중..." -ForegroundColor Yellow
    try {
        pip install pyinstaller
        Write-Host "✅ PyInstaller 설치 완료" -ForegroundColor Green
    } catch {
        Write-Host "❌ PyInstaller 설치 실패" -ForegroundColor Red
        Read-Host "계속하려면 아무 키나 누르세요"
        exit 1
    }
}

# 클라이언트 패키징 스크립트 실행
Write-Host "클라이언트 패키징 시작..." -ForegroundColor Yellow
try {
    python build_client_package.py
    if ($LASTEXITCODE -ne 0) {
        throw "패키징 스크립트 실행 실패"
    }
} catch {
    Write-Host "❌ 패키징 실패: $_" -ForegroundColor Red
    Read-Host "계속하려면 아무 키나 누르세요"
    exit 1
}

Write-Host ""
Write-Host "🎉 패키징 완료!" -ForegroundColor Green
Write-Host "📦 생성된 파일들을 확인하세요:" -ForegroundColor Yellow
Write-Host "   - ue_cms_client_package 폴더" -ForegroundColor Cyan
Write-Host "   - ue_cms_client_package_YYYYMMDD_HHMMSS.zip" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 사용 방법:" -ForegroundColor Yellow
Write-Host "1. ZIP 파일을 다른 컴퓨터로 전송" -ForegroundColor White
Write-Host "2. 압축 해제 후 config.json에서 서버 IP 설정" -ForegroundColor White
Write-Host "3. ue_cms_client.exe 또는 ue_cms_tray_client.exe 실행" -ForegroundColor White

Read-Host "계속하려면 아무 키나 누르세요" 