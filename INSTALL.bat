@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-app-center-windows.ps1"
if errorlevel 1 pause
