@echo off
setlocal
title TutorMatching - Rebuild Docker
echo Building and starting TutorMatching...
echo Keep Docker Desktop running. Existing database volumes will be preserved.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-ha.ps1"
set "BUILD_EXIT=%ERRORLEVEL%"
echo.
if not "%BUILD_EXIT%"=="0" (
    echo Rebuild failed. See the error above.
) else (
    echo Ready: http://localhost:3000
    echo Mailpit: http://localhost:8025
    echo pgAdmin: http://localhost:5050 - login details in .env
)
echo.
pause
exit /b %BUILD_EXIT%
