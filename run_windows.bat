@echo off
setlocal
cd /d "%~dp0"
if not exist "backend\.venv\Scripts\python.exe" (
  echo Creating Python virtual environment...
  py -m venv backend\.venv
)
echo Installing backend dependencies...
call backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul
echo Starting ReviewLens API in a new window...
start "ReviewLens API" cmd /k "cd /d ""%~dp0backend"" && ""%~dp0backend\.venv\Scripts\python.exe"" -m uvicorn app.main:app --reload --port 8000"
echo Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install
echo Starting website...
call npm run dev
