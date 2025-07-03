@echo off
echo UE CMS Client Package Builder
echo ================================

REM Python이 설치되어 있는지 확인
python --version >nul 2>&1
if errorlevel 1 (
    echo Python이 설치되지 않았습니다.
    echo https://python.org에서 Python을 다운로드하여 설치하세요.
    pause
    exit /b 1
)

REM PyInstaller 설치 확인 및 설치
echo PyInstaller 설치 확인 중...
python -c "import PyInstaller" >nul 2>&1
if errorlevel 1 (
    echo PyInstaller 설치 중...
    pip install pyinstaller
    if errorlevel 1 (
        echo PyInstaller 설치 실패
        pause
        exit /b 1
    )
)

REM 클라이언트 패키징 스크립트 실행
echo 클라이언트 패키징 시작...
python build_client_package.py

if errorlevel 1 (
    echo 패키징 실패
    pause
    exit /b 1
)

echo.
echo 패키징 완료!
pause 