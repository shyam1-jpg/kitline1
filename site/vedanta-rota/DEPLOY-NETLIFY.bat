@echo off
cd /d "%~dp0"
echo.
echo  Vedanta Staff Rota — Deploy to Netlify
echo  ======================================
echo.
where netlify >nul 2>&1
if errorlevel 1 (
  echo  Netlify CLI not found. Opening Netlify Drop...
  echo  Drag this entire vedanta-rota folder onto the page.
  start https://app.netlify.com/drop
  pause
  exit /b 0
)
netlify deploy --prod --dir=. --site=shimmering-cuchufli-bed2c6
pause
