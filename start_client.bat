@echo off
title UE CMS Client
cd /d "%~dp0client"
echo.
echo  Launching UE CMS v2.0 Client
echo.
call venv\Scripts\activate.bat
python "%~dp0client\client_tray.py"
pause 