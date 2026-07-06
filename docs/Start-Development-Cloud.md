# Hướng dẫn chạy dự án BookingBase qua Cloudflare Tunnel (Local Dev)

Tài liệu này hướng dẫn bạn cách khởi chạy cả Frontend, Backend và Cloudflare Tunnel ở máy local để có thể truy cập dự án trực tiếp qua tên miền **`https://cfcbooking.io.vn`**.

---

## 📌 Quy trình khởi động hàng ngày (3 bước)

### Bước 1: Khởi động Database & Cache (Docker)
Mở Terminal tại thư mục gốc của dự án và chạy:
```bash
docker compose up -d
```
*Lệnh này sẽ khởi động cơ sở dữ liệu MySQL và Redis chạy ngầm.*

---

### Bước 2: Khởi động Backend & Frontend

#### 1. Khởi động Backend (Spring Boot)
Bạn có thể chạy backend thông qua IntelliJ IDEA/VS Code (bằng cách click nút **Run**), hoặc chạy bằng dòng lệnh:
```bash
cd backend
./mvnw spring-boot:run
```
*Backend sẽ chạy trên cổng `8080`.*

#### 2. Khởi động Frontend (React/Vite)
Mở một cửa sổ Terminal mới, di chuyển vào thư mục `frontend` và chạy:
```bash
cd frontend
npm run dev
```
*Frontend sẽ chạy trên cổng `5173`.*

---

### Bước 3: Bật Cloudflare Tunnel
Mở một Terminal mới tại thư mục gốc của dự án và chạy file script hỗ trợ:
```bash
./start-tunnel.sh
```
Hoặc chạy lệnh thủ công:
```bash
cloudflared tunnel --config ~/.cloudflared/config.yml run 9af3b453-b2c4-4f31-a4a8-bbd2941c41d0
```

Sau khi chạy xong, bạn sẽ thấy thông báo:
> `Registered tunnel connection connIndex=...`

---

## 🔍 Cách truy cập trên trình duyệt

Khi cả 3 thành phần trên đã chạy:
1.  **Giao diện web (Frontend):** Truy cập **`https://cfcbooking.io.vn`** (Cloudflare Tunnel sẽ tự chuyển hướng về `http://localhost:5173` của bạn).
2.  **Dữ liệu API (Backend):** Truy cập **`https://api.cfcbooking.io.vn/api/v1/...`** (Cloudflare Tunnel sẽ tự chuyển hướng về `http://localhost:8080` của bạn).

---

## ⚠️ Giải quyết lỗi "DNS_PROBE_POSSIBLE" hoặc "Site can't be reached"

Nếu bạn gặp lỗi này khi truy cập domain:
1.  **Kiểm tra Nameserver đã kích hoạt chưa:** Nhà đăng ký tên miền có thể mất **5 phút đến 24 giờ** để cập nhật NameServer mới (`lynn.ns.cloudflare.com` và `nancy.ns.cloudflare.com`). 
    *   Bạn có thể kiểm tra trạng thái domain trên Cloudflare Dashboard. Nếu hiện dòng chữ **Active** (Xanh lá) nghĩa là đã xong.
2.  **Đảm bảo Cloudflare Tunnel đang chạy:** Kiểm tra lại Terminal chạy `start-tunnel.sh` xem có bị tắt hay báo lỗi không.
3.  **Đảm bảo Frontend & Backend đã được bật:** Nếu bạn tắt frontend (`npm run dev`) hoặc backend, khi vào domain sẽ gặp lỗi màn hình trắng hoặc báo lỗi kết nối từ Cloudflare (502 / 504 Bad Gateway).
