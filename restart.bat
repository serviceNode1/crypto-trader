@echo off
REM Crypto Trading Bot - Quick Restart (Windows)
echo.
echo 🔄 Restarting Crypto AI Trading System...
echo.

REM Kill process on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo 🛑 Stopping existing server...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 2 >nul
)

echo.
echo 🚀 Starting fresh...
echo.

REM Start the server
call npm run dev
