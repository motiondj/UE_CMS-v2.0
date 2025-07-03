@echo off
title UE CMS v2.0 Client (Tray Icon) - Package
cd /d "%~dp0"
echo.
echo  Launching UE CMS v2.0 Client (Tray Icon) - Package
echo.
echo  서버 IP 주소를 입력하세요:
echo  예시: 192.168.1.100
echo  또는 전체 URL: http://192.168.1.100:8000
echo  (Enter만 누르면 localhost:8000 사용)
echo.
set /p server_ip="서버 주소: "

if "%server_ip%"=="" (
    set server_ip=localhost:8000
)

echo.
echo  ✅ 서버 주소 설정: %server_ip%
echo.

REM 환경 변수 설정
set UE_CMS_SERVER_URL=http://%server_ip%

REM 트레이 클라이언트 실행
ue_cms_tray_client.exe

pause 