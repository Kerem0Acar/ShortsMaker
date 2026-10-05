@echo off
title ShortsMaker Studio PRO
echo ========================================================
echo       ShortsMaker PRO - Baslatiliyor...
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Python Kontrolu (python veya py launcher)
set PYTHON_CMD=
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=python
) else (
    py -3 --version >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_CMD=py -3
    ) else (
        echo [HATA] Python bulunamadi!
        echo Lutfen https://www.python.org adresinden Python'i kurun ve
        echo "Add Python to PATH" secenegini isaretlemeyi unutmayin.
        echo.
        pause
        exit /b
    )
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

:: 3. Sanal Ortam (.venv) Kontrolu
set VENV_PY=%~dp0.venv\Scripts\python.exe

:: Eger .venv baska bir bilgisayardan kopyalanmissa veya bozulmussa tespit et
if exist "%VENV_PY%" (
    "%VENV_PY%" -c "import sys" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [.venv] Baska bir bilgisayardan kopyalanmis veya gecersiz sanal ortam tespit edildi!
        echo [.venv] Sanal ortam sifirlaniyor ve bu bilgisayara gore yeniden kuruluyor...
        rmdir /s /q .venv
    )
)

:: .venv yoksa olustur
if not exist "%VENV_PY%" (
    echo [.venv] Sanal ortam olusturuluyor...
    %PYTHON_CMD% -m venv .venv
    if %errorlevel% neq 0 (
        echo [HATA] Sanal ortam olusturulamadi!
        pause
        exit /b
    )
)

:: 4. Paketlerin (requirements.txt) Kontrolu ve Kurulumu
"%VENV_PY%" -c "import uvicorn, fastapi" >nul 2>&1
if %errorlevel% neq 0 (
    echo [PIP] Gerekli kutuphaneler eksik, yukleniyor [requirements.txt]...
    echo Lutfen bekleyin, bu islem ilk acilista 1-2 dakika surebilir...
    echo.
    "%VENV_PY%" -m pip install --upgrade pip
    "%VENV_PY%" -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo.
        echo [HATA] Paketler yuklenirken bir sorun olustu!
        echo Lutfen internet baglantinizi kontrol edip tekrar deneyin.
        pause
        exit /b
    )
    echo [PIP] Tum kutuphaneler basariyla kuruldu!
    echo.
)

:: 5. Tarayiciyi ve Sunucuyu Ac
echo ========================================================
echo Web Arayuzu Aciliyor: http://localhost:8000
echo ========================================================
echo.

start "" "http://localhost:8000"

"%VENV_PY%" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

pause
