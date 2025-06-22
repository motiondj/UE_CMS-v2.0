@echo off
CHCP 65001
cls
title Switchboard Plus Server

echo.
echo =========================================
echo  Launching Switchboard Plus v2.0 Server
echo =========================================
echo.

cd server
npm start

echo.
echo Server has been stopped.
pause 