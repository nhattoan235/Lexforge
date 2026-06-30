@echo off
echo.
echo ========================================
echo   TOEIC Vocab Master - Game Server
echo ========================================
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js chua duoc cai dat!
    echo Tai tai: https://nodejs.org
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist "node_modules" (
    echo [INFO] Dang cai dat dependencies...
    npm install
    echo.
)

echo [INFO] Khoi dong Game Server...
echo.
echo ========================================
echo   Server dang chay tai: http://localhost:3001
echo ========================================
echo.
echo >> De choi qua Internet, mo terminal khac va chay:
echo    ngrok http 3001
echo    Sau do copy URL dang: https://xxx.ngrok.io
echo    Va chia se cho ban be!
echo.
echo >> De choi qua LAN (cung mang WiFi):
echo    Chia se dia chi IP cua ban: 
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    echo    http://%%a:3001
    goto :found_ip
)
:found_ip
echo.
echo ========================================
echo.
node server.js
pause
