@echo off
setlocal
title TutorMatching - Populate linked database data
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\seed-data.ps1"
set "SEED_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %SEED_EXIT%
