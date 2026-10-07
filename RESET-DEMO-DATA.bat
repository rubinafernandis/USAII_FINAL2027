@echo off
cd /d "%~dp0"
echo This restores all demo accounts, courses and progress to their original state.
echo Stop the LMS first (close its window) before continuing.
choice /M "Reset demo data now"
if errorlevel 2 exit /b 0
if not exist "node_modules\" call npm install --no-audit --no-fund
call npm run reset-data
pause
