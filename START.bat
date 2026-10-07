@echo off
setlocal EnableExtensions
title USAII Intuitive LMS 5.4
cd /d "%~dp0"

rem Find the project folder: next to this file, or in a "usaii-intuitive-lms" subfolder.
if not exist "package.json" (
  if exist "usaii-intuitive-lms\package.json" (
    cd /d "%~dp0usaii-intuitive-lms"
  ) else (
    echo.
    echo   Could not find the LMS files next to START.bat.
    echo.
    echo   If you opened START.bat from inside the ZIP file, Windows cannot run it there.
    echo   1. Right-click the .zip and choose "Extract All..."
    echo   2. Open the extracted "usaii-intuitive-lms" folder
    echo   3. Double-click START.bat inside that folder
    echo.
    pause
    exit /b 1
  )
)

echo.
echo   ====================================================
echo     USAII Intuitive LMS 5.4 - starting on your computer
echo   ====================================================
echo.
echo   Project folder: %CD%
echo.

rem ---- Node.js check -------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js was not found on this computer.
  echo   Install the LTS version from https://nodejs.org  ^(version 20 or newer^),
  echo   then double-click START.bat again.
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -v') do set NODE_RAW=%%v
set NODE_MAJOR=%NODE_RAW:v=%
if %NODE_MAJOR% LSS 20 (
  echo   Your Node.js version is too old:
  node -v
  echo   Please install Node.js 20 or newer from https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo   Node.js found:
node -v

rem ---- npm check ------------------------------------------------------
where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo   npm was not found. It normally comes with Node.js.
  echo   Reinstall Node.js from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

rem ---- First run: install packages -------------------------------------
if not exist "node_modules\" (
  echo.
  echo   First run: downloading the packages this app needs.
  echo   This takes 1-3 minutes and needs an internet connection.
  echo   It happens only once.
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   Package installation failed.
    echo   Check your internet connection ^(or your company proxy^) and run START.bat again.
    echo.
    pause
    exit /b 1
  )
)

rem ---- Start ------------------------------------------------------------
echo.
echo   Starting the LMS...
echo.
echo   It will be available at:  http://localhost:4600
echo   Your browser opens by itself when the server is ready.
echo   ^(If port 4600 is busy, the next free port is used - watch the
echo    address printed below.^)
echo.
echo   Sign in with the accounts printed below.
echo   KEEP THIS WINDOW OPEN while you use the LMS. Close it to stop.
echo.

set OPEN_BROWSER=1
call npm run dev

echo.
echo   The server has stopped. You can close this window.
echo.
pause
