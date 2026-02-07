@echo off
setlocal enabledelayedexpansion
REM LeverApp Windows Startup Script
REM Based on macOS version: app/macOS/run_leverapp.sh

echo ========================================
echo   LeverApp - Position Visualizer
echo ========================================
echo.

REM Change to the script directory
cd /d "%~dp0"

REM Load configuration from config.json
set "HOSTNAME=localhost"
set "HTTP_PORT=8000"

if exist "config.json" (
    for /f "tokens=2 delims=:," %%a in ('findstr "hostname" config.json') do (
        set "HOSTNAME=%%~a"
        set "HOSTNAME=!HOSTNAME: =!"
    )
    for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"port\"" config.json') do (
        set "LINE=%%a"
        set "LINE=!LINE: =!"
        if not defined HTTP_PORT_SET (
            set "HTTP_PORT=!LINE!"
            set "HTTP_PORT_SET=1"
        )
    )
)

REM Remove quotes and spaces from variables
set "HOSTNAME=%HOSTNAME:"=%"
set "HTTP_PORT=%HTTP_PORT:"=%"

REM Check if executables exist
if not exist "LeverAPI.exe" (
    echo [ERROR] LeverAPI.exe not found
    echo Please ensure you are running this script from the app/Windows directory
    pause
    exit /b 1
)

if not exist "LeverBridge.exe" (
    echo [ERROR] LeverBridge.exe not found
    pause
    exit /b 1
)

if not exist "LeverHTTP.exe" (
    echo [ERROR] LeverHTTP.exe not found
    pause
    exit /b 1
)

REM Check for config.json
if exist "..\config.json" (
    echo [Config] Found config.json
) else (
    echo [Config] No config.json found, using defaults
)

echo.
echo Starting LeverApp components...
echo.

REM Start LeverAPI
echo [1/3] Starting LeverAPI server...
start "LeverAPI" /MIN LeverAPI.exe

REM Wait for LeverAPI to start
timeout /t 2 /nobreak >nul

REM Start LeverBridge
echo [2/3] Starting WebSocket bridge...
start "LeverBridge" /MIN LeverBridge.exe

REM Wait for bridge to start
timeout /t 1 /nobreak >nul

REM Start LeverHTTP
echo [3/3] Starting HTTP server...
start "LeverHTTP" /MIN LeverHTTP.exe

REM Wait for HTTP server to start
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   All components started successfully!
echo ========================================
echo.
echo Access URLs:
echo - Main View:    http://%HOSTNAME%:%HTTP_PORT%
echo - Overlay View: http://%HOSTNAME%:%HTTP_PORT%/overlay.html
echo.
echo To stop all components:
echo   1. Close all minimized console windows, or
echo   2. Run: taskkill /F /IM LeverAPI.exe /IM LeverBridge.exe /IM LeverHTTP.exe
echo.
echo Press any key to open browser...
pause >nul

REM Open browser (only if autoOpen is true in config)
start http://%HOSTNAME%:%HTTP_PORT%
start http://%HOSTNAME%:%HTTP_PORT%/overlay.html

echo.
echo Browser opened. Keep this window open.
echo Press any key to exit this launcher (servers will keep running)...
pause >nul
