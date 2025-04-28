@echo off
setlocal
cd /d %~dp0
call .\Venv\Scripts\activate.bat
python app.py 