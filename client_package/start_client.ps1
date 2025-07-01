Write-Host "UE CMS Client v2.0" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan
Write-Host ""

# 서버 IP 주소 입력 받기
$SERVER_IP = Read-Host "서버 IP 주소를 입력하세요 (예: 192.168.1.100)"

# 클라이언트 이름 입력 받기
$CLIENT_NAME = Read-Host "클라이언트 이름을 입력하세요 (예: Display_01)"

Write-Host ""
$serverUrl = "http://$SERVER_IP:8000"
Write-Host "서버 연결 시도: $serverUrl" -ForegroundColor Yellow
Write-Host "클라이언트 이름: $CLIENT_NAME" -ForegroundColor Yellow
Write-Host ""

# 클라이언트 실행
try {
    .\ue_cms_client.exe --server "http://$SERVER_IP:8000" --name $CLIENT_NAME
} catch {
    Write-Host "클라이언트 실행 중 오류가 발생했습니다: $_" -ForegroundColor Red
}

Read-Host "계속하려면 아무 키나 누르세요" 