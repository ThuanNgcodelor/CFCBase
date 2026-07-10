@echo off
chcp 65001 >nul
echo =======================================================
echo          KHỞI ĐỘNG HỆ THỐNG BOOKING BASE
echo =======================================================
echo.

echo [1/5] Kiem tra Docker...
docker ps
echo.

echo [2/5] Khoi dong Database va Cache (Docker Compose)...
docker compose up -d
echo.

echo [3/5] Build va Khoi dong Backend (Spring Boot)...
cd backend
call mvnw clean package -DskipTests
echo ---^> Dang mo cua so chay Backend...
start "BookingBase - Backend" cmd /k "java -jar target\booking-system-0.0.1-SNAPSHOT.jar"
echo.

echo [4/5] Build va Khoi dong Frontend (React/Vite)...
cd ..\frontend
call npm install
call npm run build
echo ---^> Dang mo cua so chay Frontend Preview...
start "BookingBase - Frontend" cmd /k "npm run preview"
echo.

echo [5/5] Khoi dong Cloudflare Tunnel...
cd ..
start "BookingBase - Tunnel" cmd /k ""C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --config cloudflared-config.yml run 745ab8be-c55c-4e72-b985-d918206ca82f"

echo =======================================================
echo [HOAN TAT] He thong dang duoc khoi dong!
echo - Backend, Frontend va Tunnel dang chay o cac cua so rieng.
echo - Web se truc tuyen tai: https://cfcbooking.io.vn
echo - De tat he thong: Ban chi can tat cac cua so cmd do la duoc.
echo =======================================================
pause
