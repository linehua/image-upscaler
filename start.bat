@echo off
cd /d "%~dp0"
echo Starting IMAGE放大...
start http://localhost:5173
npm run dev
pause
