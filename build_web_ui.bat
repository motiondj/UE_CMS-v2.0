@echo off
title UE CMS Web UI Builder
echo.
echo  Building UE CMS Web UI...
echo.

cd /d "%~dp0web-ui-react"

echo [1/3] Installing dependencies...
call npm install

echo [2/3] Building React app...
call npm run build

echo [3/3] Copying to server public folder...
xcopy /E /Y build\* ..\server\public\

echo.
echo  ✅ Web UI build completed!
echo  📱 Access at: http://localhost:8000
echo.
pause 