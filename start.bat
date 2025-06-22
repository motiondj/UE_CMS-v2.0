@echo off
echo Switchboard Plus v2.0 시작 중...
echo.

echo 1. 서버 의존성 설치 중...
cd server
if not exist node_modules (
    npm install
)
echo 서버 의존성 설치 완료.
echo.

echo 2. 웹 UI 의존성 설치 중...
cd ..\web-ui-react
if not exist node_modules (
    npm install
)
echo 웹 UI 의존성 설치 완료.
echo.

echo 3. 웹 UI 빌드 중...
npm run build
echo 웹 UI 빌드 완료.
echo.

echo 4. 빌드된 파일을 서버로 복사 중...
xcopy /E /I /Y build ..\server\public
echo 복사 완료.
echo.

echo 5. 서버 시작 중...
cd ..\server
start "Switchboard Plus Server" cmd /k "npm start"
echo 서버가 백그라운드에서 실행 중입니다.
echo.

echo 6. 웹 브라우저에서 http://localhost:8000 으로 접속하세요.
echo.
echo Python 클라이언트를 실행하려면:
echo cd client
echo pip install -r requirements.txt
echo python client.py --name "Display-PC-01"
echo.

pause 