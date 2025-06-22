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
C:\Users\motiondjHome\AppData\Local\Programs\Python\Python311\python.exe client.py

echo.
echo Client has been stopped.
pause 