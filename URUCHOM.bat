@echo off
title Fresh Client
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Nie znaleziono Node.js. Zainstaluj wersje LTS z https://nodejs.org i uruchom ponownie.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Pierwsze uruchomienie - instaluje zaleznosci, to potrwa chwile...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Instalacja nie powiodla sie.
    pause
    exit /b 1
  )
)

if not exist "build\icon.png" call node scripts\gen-icon.js

start "" "node_modules\electron\dist\electron.exe" .
