@echo off
title Kiteline — start server + public link
cd /d "%~dp0"

echo.
echo  Kiteline — starting server and Cloudflare tunnel
echo  (same app, no redesign)
echo.

for %%P in (4000 4001 4002) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    taskkill /F /PID %%A >nul 2>&1
  )
)

if not exist "kiteline-logo.png" (
  if exist "..\Sattva-Kitchen-Business-Plan\assets\kiteline-logo.png" (
    copy /Y "..\Sattva-Kitchen-Business-Plan\assets\kiteline-logo.png" "kiteline-logo.png" >nul
  )
)

start "Kiteline Server" cmd /k "cd /d "%~dp0" && node server/server.js"
timeout /t 3 /nobreak >nul
start "Kiteline Tunnel" cmd /k "cd /d "%~dp0" && npm run tunnel"

echo.
echo  Server:  http://localhost:4001/app
echo  Tunnel:  watch the "Kiteline Tunnel" window for your https://....trycloudflare.com link
echo  App URL: add /app to that link
echo.
pause
