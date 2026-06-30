@echo off
REM Start Speech Recognition Server with Google Cloud Speech-to-Text API
REM Make sure you have set GOOGLE_APPLICATION_CREDENTIALS environment variable first!

setlocal enabledelayedexpansion

echo.
echo ========================================
echo  Speech Recognition Server Starter
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo.
    echo WARNING: .env file not found!
    echo.
    echo You need to create .env file with:
    echo   GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
    echo.
    echo Steps:
    echo   1. Create Google Cloud project
    echo   2. Enable Speech-to-Text API
    echo   3. Create service account and download JSON
    echo   4. Create .env file with credentials path
    echo   5. Restart this script
    echo.
    pause
    exit /b 1
)

REM Install/upgrade dependencies
echo Installing Python dependencies...
python -m pip install --upgrade pip >nul 2>&1
python -m pip install -r speech_requirements.txt

if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Starting Speech Server...
echo ========================================
echo.
echo Server will run on: http://localhost:5000
echo Free tier: 60 minutes/month
echo Press Ctrl+C to stop
echo.

REM Start the server
python speech_server.py

pause
