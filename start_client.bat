@echo off
title UE CMS Client
cd /d "%~dp0client"
echo.
echo  Launching UE CMS v2.0 Client
echo.
set UECMS_FORCE_RUN=1
call venv\Scripts\activate.bat
python client.py
pause 