@echo off
echo UE CMS Client Package Builder
echo =============================
echo.

REM Python 설치 확인 (여러 방법 시도)
echo Python 검색 중...

REM 1. py 명령어 시도
py --version >nul 2>&1
if not errorlevel 1 (
    echo ✅ Python 발견 (py 명령어)
    set PYTHON_CMD=py
    goto :python_found
)

REM 2. python 명령어 시도
python --version >nul 2>&1
if not errorlevel 1 (
    echo ✅ Python 발견 (python 명령어)
    set PYTHON_CMD=python
    goto :python_found
)

REM 3. python3 명령어 시도
python3 --version >nul 2>&1
if not errorlevel 1 (
    echo ✅ Python 발견 (python3 명령어)
    set PYTHON_CMD=python3
    goto :python_found
)

REM 4. 일반적인 Python 설치 경로 확인
if exist "C:\Python*\python.exe" (
    for /d %%i in (C:\Python*) do (
        if exist "%%i\python.exe" (
            echo ✅ Python 발견 (%%i\python.exe)
            set PYTHON_CMD="%%i\python.exe"
            goto :python_found
        )
    )
)

REM 5. 사용자 AppData 경로 확인
if exist "%LOCALAPPDATA%\Programs\Python\*\python.exe" (
    for /d %%i in ("%LOCALAPPDATA%\Programs\Python\*") do (
        if exist "%%i\python.exe" (
            echo ✅ Python 발견 (%%i\python.exe)
            set PYTHON_CMD="%%i\python.exe"
            goto :python_found
        )
    )
)

echo ❌ Python이 설치되지 않았습니다.
echo.
echo 해결 방법:
echo 1. https://www.python.org/downloads/ 에서 Python 다운로드
echo 2. 설치 시 "Add Python to PATH" 체크박스 반드시 체크!
echo 3. 설치 후 컴퓨터 재시작
echo.
echo 또는 직접 터미널에서 실행:
echo py build_client_package.py
echo.
pause
exit /b 1

:python_found
echo 🔨 클라이언트 패키지 빌드 시작...
%PYTHON_CMD% build_client_package.py

if errorlevel 1 (
    echo ❌ 패키지 빌드 실패!
    pause
    exit /b 1
)

echo.
echo ✅ 패키지 빌드 완료!
echo 📦 패키지 위치: client_package_new
echo.
echo 🚀 사용 방법:
echo 1. client_package_new 폴더를 테스트할 PC로 복사
echo 2. start_client.bat 또는 start_client.ps1 실행
echo 3. 서버 IP와 클라이언트 이름 입력
echo.
pause 