@echo off
setlocal
title EventCut Studio
cd /d "%~dp0"

set "VENV_PY=%~dp0.venv\Scripts\python.exe"
set "DEPS_MARK=%~dp0.venv\.deps_installed"

if not exist "%VENV_PY%" goto :need_setup
if exist "%DEPS_MARK%" goto :check_ffmpeg
"%VENV_PY%" -c "import fastapi, uvicorn, multipart" >nul 2>nul
if not errorlevel 1 (
    echo ok> "%DEPS_MARK%"
    goto :check_ffmpeg
)

:need_setup
echo.
echo ================================================================
echo   EventCut Studio - First-time automatic setup
echo   Pierwsze uruchomienie - automatyczna konfiguracja srodowiska
echo ================================================================
echo.

REM 1. Check for real system Python 3.10+ (ignores Microsoft Store stub)
set "SYS_PY="
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if not errorlevel 1 (
    set "SYS_PY=python"
    goto :setup_with_sys_python
)

py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if not errorlevel 1 (
    set "SYS_PY=py -3"
    goto :setup_with_sys_python
)

REM 2. No Python on this PC - download portable Python 3.12 via uv (no admin rights)
echo [INFO] Python 3.10+ not found on this PC.
echo [INFO] Nie wykryto Pythona 3.10+ - pobieram przenosna wersje...
echo.

set "TOOLS_DIR=%~dp0.tools"
set "UV_DIR=%TOOLS_DIR%\uv"
set "UV_EXE=%UV_DIR%\uv.exe"
set "UV_PYTHON_INSTALL_DIR=%TOOLS_DIR%\python"
set "UV_PYTHON_PREFERENCE=only-managed"

if exist "%UV_EXE%" goto :uv_ready

echo [1/3] Downloading portable Python manager...
if not exist "%UV_DIR%" mkdir "%UV_DIR%"
set "UV_ARCH=x86_64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "UV_ARCH=aarch64"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $url='https://github.com/astral-sh/uv/releases/latest/download/uv-' + $env:UV_ARCH + '-pc-windows-msvc.zip'; $zip=Join-Path $env:UV_DIR 'uv.zip'; Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing; Expand-Archive -Path $zip -DestinationPath $env:UV_DIR -Force; Remove-Item $zip -Force -ErrorAction SilentlyContinue; $found=Get-ChildItem -Path $env:UV_DIR -Filter 'uv.exe' -Recurse | Select-Object -First 1; if ($found -and $found.FullName -ne $env:UV_EXE) { Copy-Item $found.FullName $env:UV_EXE -Force }"
if errorlevel 1 goto :setup_failed
if not exist "%UV_EXE%" goto :setup_failed

:uv_ready
echo [2/3] Downloading portable Python 3.12 and creating .venv...
"%UV_EXE%" venv "%~dp0.venv" --python 3.12
if errorlevel 1 goto :setup_failed

echo [3/3] Installing app dependencies...
"%UV_EXE%" pip install --python "%VENV_PY%" -r "%~dp0requirements.txt"
if errorlevel 1 goto :setup_failed

echo ok> "%DEPS_MARK%"
goto :check_ffmpeg

:setup_with_sys_python
echo [1/2] Creating virtual environment .venv using system Python...
if not exist "%VENV_PY%" (
    %SYS_PY% -m venv "%~dp0.venv"
    if errorlevel 1 goto :setup_failed
)

echo [2/2] Installing app dependencies...
"%VENV_PY%" -m pip install -r "%~dp0requirements.txt"
if errorlevel 1 goto :setup_failed

echo ok> "%DEPS_MARK%"
goto :check_ffmpeg

:check_ffmpeg
set "NEED_FFMPEG=0"
if not exist "%~dp0bin\ffmpeg.exe" set "NEED_FFMPEG=1"
if not exist "%~dp0bin\ffprobe.exe" set "NEED_FFMPEG=1"
if "%NEED_FFMPEG%"=="0" goto :launch

where ffmpeg >nul 2>nul
if errorlevel 1 goto :download_ffmpeg
where ffprobe >nul 2>nul
if errorlevel 1 goto :download_ffmpeg
goto :launch

:download_ffmpeg
echo.
echo [FFmpeg] Downloading portable FFmpeg + FFprobe (~80 MB, one-time setup)...
echo [FFmpeg] Pobieranie przenosnego FFmpeg + FFprobe (jednorazowo)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; New-Item -ItemType Directory -Force -Path '.\bin' | Out-Null; $zip='.\bin\ffmpeg.zip'; Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $zip -UseBasicParsing; Expand-Archive -Path $zip -DestinationPath '.\bin\_tmp' -Force; Get-ChildItem '.\bin\_tmp' -Recurse -Include 'ffmpeg.exe','ffprobe.exe' | Move-Item -Destination '.\bin\' -Force; Remove-Item -Recurse -Force '.\bin\_tmp', $zip"
if not exist "%~dp0bin\ffmpeg.exe" goto :ffmpeg_failed
echo [FFmpeg] Ready!
goto :launch

:ffmpeg_failed
echo.
echo [ERROR] Failed to download FFmpeg automatically.
echo Download manually from https://www.gyan.dev/ffmpeg/builds/
echo and place ffmpeg.exe and ffprobe.exe inside the bin folder.
pause
exit /b 1

:launch
echo.
echo Starting EventCut Studio...
"%VENV_PY%" "%~dp0run_app.py" %*
if errorlevel 1 (
    echo.
    echo [ERROR] Application exited with an error.
    pause
)
exit /b 0

:setup_failed
echo.
echo [ERROR] Automatic setup failed. Check your internet connection and try again.
echo [BLAD] Automatyczna konfiguracja nie powiodla sie. Sprawdz polaczenie z internetem i sprobuj ponownie.
pause
exit /b 1
