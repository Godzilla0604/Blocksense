@echo off
cd /d "%~dp0backend"
if not exist .venv (
  echo Creating Python environment (first run only)...
  python -m venv .venv
  call .venv\Scripts\activate
  pip install -r requirements.txt
) else (
  call .venv\Scripts\activate
)
echo.
echo BlockSense API starting on http://localhost:8000  (keep this window open)
uvicorn main:app --port 8000
pause
