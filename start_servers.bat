@echo off
echo Starting CoChat servers...

:: Activate virtual environment if it exists
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

:: Start the backend server
start "CoChat Backend" cmd /c "python -m uvicorn app.main:app --reload --port 8000"

:: Wait a moment for the backend to initialize
timeout /t 2 /nobreak > nul

:: Start the frontend server
cd frontend
start "CoChat Frontend" cmd /c "npm run dev"
cd ..

echo Servers started successfully!
echo Backend running on http://localhost:8000
echo Frontend running on http://localhost:5174

:: Keep the window open to show server status
echo.
echo Press Ctrl+C to stop the servers
pause > nul 