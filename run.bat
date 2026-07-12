@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "JAR_NAME=booking-system-0.0.1-SNAPSHOT.jar"
set "JAR=%BACKEND_DIR%\target\%JAR_NAME%"
set "TUNNEL_SCRIPT=%ROOT%start-tunnel.bat"
set "JAVA_OPTS=-Xms256m -Xmx768m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -Dfile.encoding=UTF-8"

echo =======================================================
echo          BOOKINGBASE PRODUCTION START
echo =======================================================
echo.

if not exist "%JAR%" (
  echo [ERROR] Khong tim thay backend jar:
  echo         %JAR%
  echo.
  echo Hay build production truoc bang:
  echo   build-prod.bat
  echo.
  pause
  exit /b 1
)

echo [1/3] Khoi dong database va redis...
docker compose up -d db redis
if errorlevel 1 (
  echo [ERROR] Docker compose khoi dong that bai.
  pause
  exit /b 1
)
echo.

echo [2/3] Khoi dong Backend + Frontend production jar...
echo       RAM Java: %JAVA_OPTS%
start "BookingBase - Backend PROD" /D "%BACKEND_DIR%" cmd /k java %JAVA_OPTS% -jar "target\%JAR_NAME%" --spring.profiles.active=prod
echo.

echo [3/3] Khoi dong Cloudflare Tunnel...
if exist "%TUNNEL_SCRIPT%" (
  start "BookingBase - Tunnel" /D "%ROOT%" cmd /k call "%TUNNEL_SCRIPT%"
) else (
  echo [WARN] Khong tim thay tunnel script:
  echo        %TUNNEL_SCRIPT%
  echo        Bo qua tunnel, app van chay local tai http://localhost:8080
)

echo.
echo =======================================================
echo [OK] Production da duoc khoi dong.
echo - Web + API local: http://localhost:8080
echo - Domain qua tunnel: https://cfcbooking.io.vn
echo - API domain qua tunnel: https://api.cfcbooking.io.vn
echo.
echo Luu y:
echo - run.bat khong build va khong npm install de tiet kiem RAM/CPU.
echo - Khi code thay doi, hay chay build-prod.bat truoc roi moi chay run.bat.
echo =======================================================
pause
