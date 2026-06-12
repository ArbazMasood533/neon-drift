@echo off
title NEON DRIFT
echo.
echo   ===============================
echo      NEON DRIFT  -  starting...
echo   ===============================
echo.
echo   Opening http://localhost:5050
echo   (close this window to stop the server)
echo.
start "" http://localhost:5050
where py >nul 2>nul && ( py -m http.server 5050 ) || ( python -m http.server 5050 )
