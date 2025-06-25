@echo off
CHCP 65001
cls
title Switchboard Plus Client (Remote)

echo.
echo =========================================
echo  Launching Switchboard Plus v2.0 Client
echo =========================================
echo.

echo 🚀 Starting client with computer name
echo To stop the client, press Ctrl+C in this window.
echo.

REM 서버 주소 설정 (필요시 수정)
set SERVER_URL=http://192.168.1.100:8000
echo 서버 주소: %SERVER_URL%

REM 환경 변수로 서버 주소 전달
set SWITCHBOARD_SERVER_URL=%SERVER_URL%

echo.
echo 클라이언트를 시작합니다...
echo 서버: %SERVER_URL%
echo.

switchboard_client.exe

echo.
echo Client has been stopped.
pause 