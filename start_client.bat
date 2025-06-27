@echo off
CHCP 65001
cls
title Switchboard Plus Client

echo.
echo =========================================
echo  Launching Switchboard Plus v2.0 Client
echo =========================================
echo.

echo 🚀 Starting client with computer name
echo To stop the client, press Ctrl+C in this window.
echo.

cd client
call venv\Scripts\activate.bat
python client_tray.py

echo.
echo Client has been stopped.
pause 