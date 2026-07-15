@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "JAR_NAME=booking-system-0.0.1-SNAPSHOT.jar"
set "STAGING_DIR=%BACKEND_DIR%\target-build"
set "STAGING_JAR=%STAGING_DIR%\%JAR_NAME%"
set "TARGET_DIR=%BACKEND_DIR%\target"
set "TARGET_JAR=%TARGET_DIR%\%JAR_NAME%"

echo =======================================================
echo          BOOKINGBASE PRODUCTION BUILD
echo =======================================================
echo.

echo [1/4] Build frontend dist...
cd /d "%ROOT%frontend"
call npm.cmd run build
if errorlevel 1 (
  echo [ERROR] Frontend build that bai.
  pause
  exit /b 1
)
echo.

echo [2/4] Build backend jar vao staging...
cd /d "%BACKEND_DIR%"
call mvnw.cmd clean package -DskipTests "-Dbooking.build.directory=%STAGING_DIR%"
if errorlevel 1 (
  echo [ERROR] Backend package that bai.
  echo Backend dang chay van duoc giu nguyen.
  pause
  exit /b 1
)

if not exist "%STAGING_JAR%" (
  echo [ERROR] Khong tim thay staging jar:
  echo         %STAGING_JAR%
  pause
  exit /b 1
)
echo.

echo [3/4] Smoke test Web Push trong production jar...
java -Xms32m -Xmx256m "-Dloader.path=%STAGING_DIR%\test-classes" "-Dloader.main=com.booking.system.config.WebPushExecutableJarSmoke" -cp "%STAGING_JAR%" org.springframework.boot.loader.launch.PropertiesLauncher
if errorlevel 1 (
  echo [ERROR] Production jar Web Push smoke test that bai.
  echo Backend dang chay va production jar cu van duoc giu nguyen.
  echo Jar loi van con tai de kiem tra:
  echo   %STAGING_JAR%
  pause
  exit /b 1
)
echo.

echo [4/4] Kich hoat production jar moi...
echo       Dung Backend va Tunnel cu sau khi build da thanh cong...
taskkill /FI "WINDOWTITLE eq BookingBase - Backend PROD*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq BookingBase - Tunnel*" /T /F >nul 2>nul
timeout /t 2 /nobreak >nul

if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

if exist "%TARGET_JAR%" (
  copy /Y "%TARGET_JAR%" "%TARGET_JAR%.previous" >nul
)

copy /Y "%STAGING_JAR%" "%TARGET_JAR%" >nul
if errorlevel 1 (
  echo [ERROR] Khong the thay production jar.
  echo Jar moi van con tai:
  echo   %STAGING_JAR%
  echo Hay dong cua so Backend cu roi chay lai build-prod.bat.
  pause
  exit /b 1
)

rmdir /S /Q "%STAGING_DIR%" >nul 2>nul

echo.
echo =======================================================
echo [OK] Build production xong.
echo Jar:
echo   %TARGET_JAR%
echo.
echo Backend va Tunnel cu da dung. Chay production moi bang:
echo   run.bat
echo =======================================================
pause
