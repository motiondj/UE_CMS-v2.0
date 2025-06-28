@echo off
title UE CMS v2.0 Client (Tray Icon)
cd /d "%~dp0"
echo.
echo  UE CMS v2.0 Client (Tray Icon)
echo.
call venv\Scripts\activate.bat
python client_tray.py
pause 