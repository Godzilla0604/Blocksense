@echo off
cd /d "%~dp0frontend"
if not exist node_modules (
  echo Installing frontend packages (first run only)...
  call npm install
)
echo.
echo BlockSense UI starting. Open http://localhost:5173  (keep this window open)
call npm run dev
pause
