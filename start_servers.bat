@echo off
SETLOCAL EnableDelayedExpansion

:: Check if Python virtual environment exists, create if it doesn't
IF NOT EXIST "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

:: Activate virtual environment
call venv\Scripts\activate.bat

:: Install Python dependencies if requirements.txt exists
IF EXIST "requirements.txt" (
    echo Installing Python dependencies...
    pip install -r requirements.txt
)

:: Set Python path to include the app directory
set PYTHONPATH=%PYTHONPATH%;%CD%

:: Start the backend server in a new window
start "CoChat Backend" cmd /c "venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Navigate to frontend directory and install dependencies if needed
cd frontend
IF EXIST "package.json" (
    IF NOT EXIST "node_modules" (
        echo Installing frontend dependencies...
        call npm install
    )
)

:: Start the frontend development server
echo Starting frontend server...
start "CoChat Frontend" cmd /c "npm run dev"

:: Return to root directory
cd ..

echo Servers are starting...
echo Backend will be available at: http://localhost:8000
echo Frontend will be available at: http://localhost:3000
echo.
echo Press any key to stop the servers...
pause

:: Kill the servers when user presses a key
taskkill /FI "WindowTitle eq CoChat Backend*" /T /F
taskkill /FI "WindowTitle eq CoChat Frontend*" /T /F

:: Deactivate virtual environment
deactivate

ENDLOCAL 