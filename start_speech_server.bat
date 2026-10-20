@echo off
setlocal
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
if not exist ".venv\Scripts\python.exe" (
    echo Run: python -m venv .venv
    echo Then: .venv\Scripts\python.exe -m pip install -r speech_requirements.txt
    pause
    exit /b 1
)
".venv\Scripts\python.exe" speech_server.py
pause
