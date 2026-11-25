@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo Node.js and npm are required. Install Node.js, then try again.
    pause
    exit /b 1
)
echo Starting Book Warehouse. Keep this window open.
echo Press Ctrl+C to stop the server.
call npm.cmd run dev -- --open /spark.html
if errorlevel 1 (
    echo The server could not start. See the error above.
    pause
    exit /b 1
)
