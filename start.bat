@echo off
title ShortsMaker Studio PRO
echo ========================================================
echo       ShortsMaker PRO - Baslatiliyor...
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Python Kontrolu
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Python bulunamadi!
    echo Lutfen https://www.python.org adresinden Python'i kurun ve
    echo "Add Python to PATH" secenegini isaretlemeyi unutmayin.
    echo.
    pause
    exit /b
)

:: 2. FFmpeg Kontrolu
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [UYARI] FFmpeg sisteminizde yuklu degil veya PATH'e eklenmemis!
    echo Video kesme ve render islemleri icin FFmpeg gereklidir.
    echo Kolay kurulum icin su komutu calistirabilirsiniz:
    echo     winget install Gyan.FFmpeg
    echo Veya https://ffmpeg.org/download.html adresinden indirebilirsiniz.
    echo.
    echo Yine de devam ediliyor...
    echo.
)

:: 3. Sanal Ortam (.venv) Kontrolu ve Otomatik Kurulum
if not exist ".venv\Scripts\activate.bat" (
    echo [.venv] Ilk calistirma tespit edildi. Sanal ortam olusturuluyor...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [HATA] Sanal ortam olusturulamadi!
        pause
        exit /b
    )
    echo [PIP] Gerekli kutuphaneler yukleniyor [requirements.txt]...
    call .venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [UYARI] Bazi paketler yuklenememis olabilir, devam ediliyor...
    )
) else (
    call .venv\Scripts\activate.bat
)

:: 4. Tarayiciyi ve Sunucuyu Ac
echo.
echo ========================================================
echo Web Arayuzu Aciliyor: http://localhost:8000
echo ========================================================
echo.

start "" "http://localhost:8000"

python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

pause
