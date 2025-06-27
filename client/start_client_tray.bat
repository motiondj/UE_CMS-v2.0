@echo off
chcp 65001 >nul
title Switchboard Plus v2.0 Client (Tray Icon)

echo =========================================
echo  Switchboard Plus v2.0 Client (Tray Icon)
echo =========================================
echo.

:: Python 가상환경 활성화 (있는 경우)
if exist "venv\Scripts\activate.bat" (
    echo 가상환경을 활성화합니다...
    call venv\Scripts\activate.bat
    echo.
)

:: 필요한 패키지 설치 확인
echo 필요한 패키지를 확인합니다...
python -c "import socketio, requests, pystray, PIL, wmi" 2>nul
if errorlevel 1 (
    echo 필요한 패키지를 설치합니다...
    pip install python-socketio requests pystray pillow wmi
    echo.
)

:: 클라이언트 실행
echo 클라이언트를 시작합니다...
echo 트레이 아이콘이 생성되면 시스템 트레이를 확인하세요.
echo 종료하려면 트레이 아이콘을 우클릭하고 '종료'를 선택하세요.
echo.

python client_tray.py

echo.
echo 클라이언트가 종료되었습니다.
pause 