@echo off
echo UE CMS Client v2.0
echo =================

REM 서버 IP 주소 입력 받기
set /p SERVER_IP="서버 IP 주소를 입력하세요 (예: 192.168.1.100): "

REM 클라이언트 이름 입력 받기
set /p CLIENT_NAME="클라이언트 이름을 입력하세요 (예: Display_01): "

echo.
echo 서버 연결 시도: http://%SERVER_IP%:8000
echo 클라이언트 이름: %CLIENT_NAME%
echo.

REM 클라이언트 실행
ue_cms_client.exe --server http://%SERVER_IP%:8000 --name %CLIENT_NAME%

pause 