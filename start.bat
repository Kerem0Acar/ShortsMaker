@echo off
title ShortsMaker Studio
echo ========================================================
echo       ShortsMaker PRO - Baslatiliyor...
echo ========================================================
echo.

cd /d "%~dp0"

if not exist ".venv\Scripts\activate.bat" (
    echo [HATA] Sanal ortam (.venv) bulunamadi!
    pause
    exit /b
)

call .venv\Scripts\activate.bat

echo Web Arayuzu aciliyor: http://localhost:8000
start "" "http://localhost:8000"

python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

pause
