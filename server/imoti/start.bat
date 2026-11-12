@echo off
rem ============================================
rem   Imoti i Imperii - startirane pod Windows
rem   (samo ASCII v tozi fail - cmd.exe ne chete
rem    nadezhdno kirilica v .bat failove)
rem ============================================

chcp 65001 >nul
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1

where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo  GRESHKA: Python ne e instaliran ili ne e v PATH.
    echo  Izteglete go ot https://www.python.org/downloads/
    echo  Pri instalaciya otbelezhete "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\activate.bat" (
    echo  Syzdavane na virtualna sreda .venv ...
    python -m venv .venv
    if errorlevel 1 (
        echo  GRESHKA: Neuspeshno syzdavane na virtualna sreda.
        pause
        exit /b 1
    )
)

call ".venv\Scripts\activate.bat"

if not exist ".venv\.deps_installed" (
    echo  Instalirane na paketite - pyrviyat pyt otnema minuta-dve...
    python -m pip install --upgrade pip >nul
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo  GRESHKA: Neuspeshna instalaciya na paketite.
        pause
        exit /b 1
    )
    echo ok > ".venv\.deps_installed"
)

python start.py %*

pause
