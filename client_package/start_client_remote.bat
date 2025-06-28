@echo off
title UE CMS Client (Remote)
cd /d "%~dp0"
echo.
echo  Launching UE CMS v2.0 Client
echo.

:: 서버 URL 설정 (기본값: localhost:3000)
set SERVER_URL=http://localhost:3000

:: 명령줄 인자로 서버 URL을 받은 경우 사용
if not "%1"=="" set SERVER_URL=%1

echo 서버 URL: %SERVER_URL%
echo.

:: 환경 변수 설정
set UECMS_SERVER_URL=%SERVER_URL%

:: 클라이언트 실행
ue_cms_client.exe

echo.
echo 클라이언트가 종료되었습니다.
pause 