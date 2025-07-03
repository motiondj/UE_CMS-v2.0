@echo off
chcp 65001 >nul
title UE CMS Client - 서버 연결 설정

echo.
echo ========================================
echo        UE CMS Client v2.0
echo ========================================
echo.

echo 📡 서버 연결 설정
echo.

REM 현재 네트워크 정보 표시
echo 🌐 현재 네트워크 정보:
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    set ip=%%i
    set ip=!ip: =!
    if not "!ip!"=="" (
        echo    📶 !ip!
    )
)

echo.
echo 💡 서버 IP 주소를 입력하세요:
echo    예시: 192.168.1.100
echo    또는 전체 URL: http://192.168.1.100:8000
echo    (Enter만 누르면 localhost:8000 사용)
echo.

set /p server_input="서버 주소: "

if "%server_input%"=="" (
    set server_url=http://localhost:8000
    echo ✅ 기본 서버 주소 사용: %server_url%
) else (
    if not "%server_input%"=="http://" (
        if not "%server_input:~0,7%"=="http://" (
            if not "%server_input:~0,8%"=="https://" (
                if "%server_input%"==":" (
                    set server_url=http://%server_input%:8000
                ) else (
                    set server_url=http://%server_input%:8000
                )
            ) else (
                set server_url=%server_input%
            )
        ) else (
            set server_url=%server_input%
        )
    ) else (
        set server_url=%server_input%:8000
    )
    echo ✅ 서버 주소 설정: %server_url%
)

echo.
echo 📋 클라이언트 정보:
echo    서버: %server_url%
echo    이름: %COMPUTERNAME%
echo.

echo 🚀 클라이언트 시작 중...
echo ========================================
echo.

REM 클라이언트 실행
ue_cms_client.exe --server "%server_url%" --name "%COMPUTERNAME%"

echo.
echo 클라이언트가 종료되었습니다.
pause 