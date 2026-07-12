@echo off
setlocal
chcp 65001 >nul
title BookingBase - Tunnel

set "ROOT=%~dp0"
set "TUNNEL_ID=745ab8be-c55c-4e72-b985-d918206ca82f"
set "TUNNEL_CONFIG=cloudflared-config.yml"
set "TUNNEL_CONFIG_PATH=%ROOT%%TUNNEL_CONFIG%"

echo =======================================================
echo          BOOKINGBASE CLOUDFLARE TUNNEL
echo =======================================================
echo.

where cloudflared >nul 2>nul
if errorlevel 1 goto missing_cloudflared

if not exist "%TUNNEL_CONFIG_PATH%" goto missing_config

cd /d "%ROOT%"
echo Cloudflared: cloudflared
echo Config: %TUNNEL_CONFIG%
echo Tunnel ID: %TUNNEL_ID%
echo.
echo Dang ket noi Cloudflare Tunnel...
echo.

cloudflared tunnel --config "%TUNNEL_CONFIG%" run "%TUNNEL_ID%"

echo.
echo [WARN] Cloudflare Tunnel da dung hoac gap loi. Xem log phia tren.
pause
exit /b

:missing_cloudflared
echo [ERROR] Khong tim thay cloudflared trong PATH.
echo Hay kiem tra lenh:
echo   where cloudflared
echo.
pause
exit /b 1

:missing_config
echo [ERROR] Khong tim thay tunnel config:
echo         %TUNNEL_CONFIG_PATH%
echo.
pause
exit /b 1
