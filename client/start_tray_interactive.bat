@echo off
echo UE CMS Tray Client - 대화형 실행
echo ===================================

REM Python이 설치되어 있는지 확인
python --version >nul 2>&1
if errorlevel 1 (
    echo Python이 설치되지 않았습니다.
    echo https://python.org에서 Python을 다운로드하여 설치하세요.
    pause
    exit /b 1
)

REM 트레이 클라이언트 실행
echo 트레이 클라이언트를 시작합니다...
echo (서버 IP를 입력하라는 메시지가 나타날 것입니다)
echo.
python client_tray.py

pause 