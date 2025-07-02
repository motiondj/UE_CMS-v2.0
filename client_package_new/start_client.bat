@echo off
echo UE CMS Client v2.0
echo =================
echo.

REM Python 설치 확인
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python이 설치되지 않았습니다.
    echo Python 3.7 이상을 설치해주세요: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 서버 IP 주소 입력 받기
set /p SERVER_IP="서버 IP 주소를 입력하세요 (예: 192.168.1.100): "

REM 클라이언트 이름 입력 받기
set /p CLIENT_NAME="클라이언트 이름을 입력하세요 (예: Display_01): "

echo.
echo 서버 연결 시도: http://%SERVER_IP%:8000
echo 클라이언트 이름: %CLIENT_NAME%
echo.

REM 가상환경 생성 및 활성화
if not exist "venv" (
    echo 🔧 가상환경 생성 중...
    python -m venv venv
)

echo 🔧 가상환경 활성화 중...
call venv\Scripts\activate.bat

echo 📦 pip 업그레이드 중...
python -m pip install --upgrade pip

echo 📦 필요한 패키지 설치 중...
echo ⚠️ Pillow 설치 중... (시간이 걸릴 수 있습니다)
pip install pillow==9.5.0

echo 📦 나머지 패키지 설치 중...
pip install python-socketio==5.8.0 requests==2.31.0 psutil==5.9.5 pystray==0.19.4 wmi==1.5.1 websocket-client==1.6.4

echo 🚀 클라이언트 시작 중...
python client_tray.py --server http://%SERVER_IP%:8000 --name %CLIENT_NAME%

pause
