@echo off
cd /d "%~dp0"
echo Starting MapHelper on http://localhost:5173 ...
start http://localhost:5173
npm run dev
pause
