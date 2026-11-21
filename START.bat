@echo off
chcp 65001 >nul
title EventCut Studio
cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
    echo [EventCut Studio] Python 3.10+ not found / Nie znaleziono Python 3.10+.
    echo Download from / Pobierz z: https://www.python.org/downloads/
    echo Make sure to check "Add python.exe to PATH" during installation.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo [EventCut Studio] Setting up Python virtual environment / Tworzenie srodowiska Python...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    .venv\Scripts\pip.exe install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

set "NEED_FFMPEG=0"
if not exist "bin\ffmpeg.exe" set "NEED_FFMPEG=1"
if not exist "bin\ffprobe.exe" set "NEED_FFMPEG=1"

if "%NEED_FFMPEG%"=="1" (
    where ffmpeg >nul 2>&1
    if errorlevel 1 (
        echo [EventCut Studio] Downloading portable FFmpeg (~80 MB, one-time setup)...
        echo [EventCut Studio] Pobieranie przenosnego FFmpeg (jednorazowo)...
        powershell -NoProfile -ExecutionPolicy Bypass -Command ^
            "$ProgressPreference = 'SilentlyContinue'; New-Item -ItemType Directory -Force -Path '.\bin' | Out-Null; $zip = '.\bin\ffmpeg.zip'; Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $zip -UseBasicParsing; Expand-Archive -Path $zip -DestinationPath '.\bin\_tmp' -Force; Get-ChildItem '.\bin\_tmp' -Recurse -Include 'ffmpeg.exe','ffprobe.exe' | Move-Item -Destination '.\bin\' -Force; Remove-Item -Recurse -Force '.\bin\_tmp', $zip"
        if not exist "bin\ffmpeg.exe" (
            echo [ERROR] Failed to download FFmpeg. You can download it manually from https://www.gyan.dev/ffmpeg/builds/ and place ffmpeg.exe and ffprobe.exe in the bin\ folder.
            pause
            exit /b 1
        )
        echo [EventCut Studio] FFmpeg ready!
    )
)

.venv\Scripts\python.exe run_app.py
pause
