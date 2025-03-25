@echo off
echo ===== FLASK SERVER STARTUP DIAGNOSTICS =====
echo.

REM Check if Venv exists
if not exist "Venv" (
    echo ERROR: Virtual environment "Venv" not found!
    echo Please make sure you have created a virtual environment named "Venv" in this directory.
    goto :error
)

REM Check if app.py exists
if not exist "app.py" (
    echo ERROR: app.py not found in current directory!
    echo Current directory: %CD%
    goto :error
)

echo Activating virtual environment...
call Venv\Scripts\activate.bat

if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment!
    goto :error
)

echo Virtual environment activated successfully.
echo.
echo Checking for required packages...
pip list
echo.

echo Starting Flask server with detailed output...
echo ----------------------------------------
python -u app.py

if errorlevel 1 (
    echo ----------------------------------------
    echo ERROR: Flask server failed to start!
    goto :error
)

goto :end

:error
echo.
echo Server startup FAILED! Please check the errors above.
pause
exit /b 1

:end
pause 