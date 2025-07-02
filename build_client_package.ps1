# UE CMS Client Package Builder
Write-Host "UE CMS Client Package Builder" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""

Write-Host "🔨 클라이언트 패키지 빌드 시작..." -ForegroundColor Yellow

try {
    python build_client_package.py
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ 패키지 빌드 완료!" -ForegroundColor Green
        Write-Host "📦 패키지 위치: client_package_new" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "🚀 사용 방법:" -ForegroundColor Yellow
        Write-Host "1. client_package_new 폴더를 테스트할 PC로 복사" -ForegroundColor White
        Write-Host "2. start_client.bat 또는 start_client.ps1 실행" -ForegroundColor White
        Write-Host "3. 서버 IP와 클라이언트 이름 입력" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "❌ 패키지 빌드 실패!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ 오류 발생: $_" -ForegroundColor Red
}

Read-Host "Enter를 눌러 종료" 