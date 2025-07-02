#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import shutil
import subprocess
import sys
from pathlib import Path

def build_client_package():
    """클라이언트 패키지를 빌드합니다."""
    
    print("🔨 UE CMS 클라이언트 패키지 빌드 시작...")
    
    # 현재 디렉토리
    current_dir = Path(__file__).parent
    client_dir = current_dir / "client"
    package_dir = current_dir / "client_package_new"
    
    # 기존 패키지 디렉토리 삭제
    if package_dir.exists():
        shutil.rmtree(package_dir)
    
    # 새 패키지 디렉토리 생성
    package_dir.mkdir(exist_ok=True)
    
    print(f"📁 패키지 디렉토리 생성: {package_dir}")
    
    # 필요한 파일들 복사
    files_to_copy = [
        "client_tray.py",
        "requirements.txt",
        "config.json"
    ]
    
    for file_name in files_to_copy:
        src_file = client_dir / file_name
        dst_file = package_dir / file_name
        
        if src_file.exists():
            shutil.copy2(src_file, dst_file)
            print(f"✅ 파일 복사: {file_name}")
        else:
            print(f"⚠️ 파일 없음: {file_name}")
    
    # 실행 스크립트 생성
    create_batch_script(package_dir)
    create_powershell_script(package_dir)
    create_config_file(package_dir)
    create_readme(package_dir)
    
    print("✅ 클라이언트 패키지 빌드 완료!")
    print(f"📦 패키지 위치: {package_dir}")
    
    return package_dir

def build_executable():
    """클라이언트 실행파일을 빌드합니다."""
    
    print("🔨 UE CMS 클라이언트 실행파일 빌드 시작...")
    
    # 현재 디렉토리
    current_dir = Path(__file__).parent
    client_dir = current_dir / "client"
    dist_dir = current_dir / "dist"
    
    # PyInstaller 설치 확인 및 설치
    try:
        import PyInstaller
        print("✅ PyInstaller 이미 설치됨")
    except ImportError:
        print("📦 PyInstaller 설치 중...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)
        print("✅ PyInstaller 설치 완료")
    
    # 기존 dist 디렉토리 삭제
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    
    # PyInstaller로 실행파일 생성
    print("🔨 실행파일 빌드 중...")
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",  # 단일 실행파일
        "--windowed",  # 콘솔 창 숨김
        "--name=UE_CMS_Client",  # 실행파일 이름
        "--icon=client/icon.ico" if (client_dir / "icon.ico").exists() else None,  # 아이콘 (있는 경우)
        str(client_dir / "client_tray.py")
    ]
    
    # None 값 제거
    cmd = [arg for arg in cmd if arg is not None]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ 실행파일 빌드 완료!")
        exe_path = dist_dir / "UE_CMS_Client.exe"
        if exe_path.exists():
            print(f"📦 실행파일 위치: {exe_path}")
            return exe_path
        else:
            print("❌ 실행파일을 찾을 수 없습니다.")
            return None
    else:
        print("❌ 실행파일 빌드 실패!")
        print("오류:", result.stderr)
        return None

def create_batch_script(package_dir):
    """Windows 배치 스크립트를 생성합니다."""
    script_content = '''@echo off
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
call venv\\Scripts\\activate.bat

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
'''
    
    with open(package_dir / "start_client.bat", "w", encoding="utf-8") as f:
        f.write(script_content)
    
    print("✅ 배치 스크립트 생성: start_client.bat")

def create_powershell_script(package_dir):
    """PowerShell 스크립트를 생성합니다."""
    script_content = '''# UE CMS Client v2.0 PowerShell Script
Write-Host "UE CMS Client v2.0" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green
Write-Host ""

# Python 설치 확인
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python 버전: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python이 설치되지 않았습니다." -ForegroundColor Red
    Write-Host "Python 3.7 이상을 설치해주세요: https://www.python.org/downloads/" -ForegroundColor Yellow
    Read-Host "Enter를 눌러 종료"
    exit 1
}

# 서버 IP 주소 입력 받기
$serverIP = Read-Host "서버 IP 주소를 입력하세요 (예: 192.168.1.100)"

# 클라이언트 이름 입력 받기
$clientName = Read-Host "클라이언트 이름을 입력하세요 (예: Display_01)"

Write-Host ""
Write-Host "서버 연결 시도: http://$serverIP:8000" -ForegroundColor Cyan
Write-Host "클라이언트 이름: $clientName" -ForegroundColor Cyan
Write-Host ""

# 가상환경 생성 및 활성화
if (-not (Test-Path "venv")) {
    Write-Host "🔧 가상환경 생성 중..." -ForegroundColor Yellow
    python -m venv venv
}

Write-Host "🔧 가상환경 활성화 중..." -ForegroundColor Yellow
& "venv\\Scripts\\Activate.ps1"

Write-Host "📦 pip 업그레이드 중..." -ForegroundColor Yellow
python -m pip install --upgrade pip

Write-Host "📦 필요한 패키지 설치 중..." -ForegroundColor Yellow
Write-Host "⚠️ Pillow 설치 중... (시간이 걸릴 수 있습니다)" -ForegroundColor Yellow
pip install pillow==9.5.0

Write-Host "📦 나머지 패키지 설치 중..." -ForegroundColor Yellow
pip install python-socketio==5.8.0 requests==2.31.0 psutil==5.9.5 pystray==0.19.4 wmi==1.5.1 websocket-client==1.6.4

Write-Host "🚀 클라이언트 시작 중..." -ForegroundColor Green
python client_tray.py --server "http://$serverIP:8000" --name "$clientName"

Read-Host "Enter를 눌러 종료"
'''
    
    with open(package_dir / "start_client.ps1", "w", encoding="utf-8") as f:
        f.write(script_content)
    
    print("✅ PowerShell 스크립트 생성: start_client.ps1")

def create_config_file(package_dir):
    """기본 설정 파일을 생성합니다."""
    config_content = '''{
  "server_url": "http://localhost:8000",
  "client_name": "",
  "auto_start": false,
  "heartbeat_interval": 5,
  "log_level": "INFO",
  "enable_tray": true
}'''
    
    with open(package_dir / "config.json", "w", encoding="utf-8") as f:
        f.write(config_content)
    
    print("✅ 설정 파일 생성: config.json")

def create_readme(package_dir):
    """README 파일을 생성합니다."""
    readme_content = '''# UE CMS Client v2.0

UE CMS 시스템의 클라이언트 패키지입니다.

## 📁 패키지 내용

- `client_tray.py` - 메인 클라이언트 실행 파일
- `start_client.bat` - Windows 배치 파일 실행 스크립트
- `start_client.ps1` - PowerShell 실행 스크립트
- `config.json` - 클라이언트 설정 파일
- `requirements.txt` - Python 패키지 의존성
- `README.md` - 사용법 안내서

## 🚀 실행 방법

### 방법 1: 배치 파일 사용 (권장)
1. `start_client.bat` 파일을 더블클릭
2. 서버 IP 주소 입력 (예: 192.168.1.100)
3. 클라이언트 이름 입력 (예: Display_01)

### 방법 2: PowerShell 스크립트 사용
1. PowerShell을 관리자 권한으로 실행
2. `start_client.ps1` 파일을 더블클릭하거나 실행

### 방법 3: 직접 실행
```cmd
python client_tray.py --server http://192.168.1.100:8000 --name Display_01
```

## ⚙️ 설정

`config.json` 파일에서 기본 설정을 변경할 수 있습니다:

```json
{
  "server_url": "http://192.168.1.100:8000",
  "client_name": "",
  "auto_start": false,
  "heartbeat_interval": 5,
  "log_level": "INFO",
  "enable_tray": true
}
```

## 🔧 요구사항

- Windows 10/11
- Python 3.7 이상
- 네트워크 연결 (서버와 통신 가능)
- 고정 IP 주소 설정 권장

## 📦 설치된 패키지

- `python-socketio` - Socket.IO 클라이언트
- `requests` - HTTP 요청
- `psutil` - 프로세스 관리
- `pystray` - 시스템 트레이 아이콘
- `Pillow` - 이미지 처리

## 📝 주의사항

1. **서버 IP 주소**: 서버가 실행 중인 컴퓨터의 IP 주소를 정확히 입력하세요
2. **클라이언트 이름**: 각 클라이언트마다 고유한 이름을 사용하세요
3. **네트워크 설정**: 클라이언트와 서버가 같은 네트워크에 있어야 합니다
4. **방화벽**: 포트 8000이 차단되지 않도록 설정하세요

## 🆘 문제 해결

### Python이 설치되지 않은 경우
1. Python 3.7 이상을 설치: https://www.python.org/downloads/
2. 설치 시 "Add Python to PATH" 옵션을 체크하세요

### 클라이언트가 서버에 연결되지 않는 경우
1. 서버 IP 주소가 올바른지 확인
2. 서버가 실행 중인지 확인
3. 네트워크 연결 상태 확인
4. 방화벽 설정 확인

### 클라이언트가 자동으로 재연결되는 경우
이는 정상적인 동작입니다. 클라이언트는 5초마다 서버에 하트비트를 보내며, 연결이 끊어지면 자동으로 재연결을 시도합니다.

## 📞 지원

문제가 발생하면 로그 파일을 확인하거나 시스템 관리자에게 문의하세요.
'''
    
    with open(package_dir / "README.md", "w", encoding="utf-8") as f:
        f.write(readme_content)
    
    print("✅ README 파일 생성: README.md")

def main():
    """메인 함수"""
    print("UE CMS Client Package Builder")
    print("=" * 40)
    print()
    print("1. 패키지 빌드 (Python 스크립트)")
    print("2. 실행파일 빌드 (exe)")
    print("3. 둘 다 빌드")
    print()
    
    try:
        choice = input("선택하세요 (1-3): ").strip()
        
        if choice == "1":
            build_client_package()
        elif choice == "2":
            build_executable()
        elif choice == "3":
            build_client_package()
            print()
            build_executable()
        else:
            print("❌ 잘못된 선택입니다.")
            return
        
        print()
        print("🎉 빌드 완료!")
        
    except KeyboardInterrupt:
        print("\n🛑 사용자에 의해 취소됨")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 