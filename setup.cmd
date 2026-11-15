@echo off
setlocal
title TutorMatching - First-time setup
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-windows.ps1" %*
set "SETUP_EXIT=%ERRORLEVEL%"
echo.
if not "%SETUP_EXIT%"=="0" echo Setup needs attention. Read the message above.
pause
exit /b %SETUP_EXIT%
