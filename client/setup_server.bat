@echo off
echo UE CMS Client - 서버 설정 도구
echo ================================

REM Python이 설치되어 있는지 확인
python --version >nul 2>&1
if errorlevel 1 (
    echo Python이 설치되지 않았습니다.
    echo https://python.org에서 Python을 다운로드하여 설치하세요.
    pause
    exit /b 1
)

REM 서버 설정 도구 실행
echo 서버 설정 도구를 시작합니다...
echo.
python setup_server.py

pause 