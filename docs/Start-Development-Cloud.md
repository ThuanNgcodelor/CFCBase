# Hướng dẫn chạy dự án BookingBase qua Cloudflare Tunnel (Local Dev)

Tài liệu này hướng dẫn bạn cách khởi chạy cả Frontend, Backend và Cloudflare Tunnel ở máy local để có thể truy cập dự án trực tiếp qua tên miền **`https://cfcbooking.io.vn`** với đầy đủ tính năng PWA.

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

#### 2. Build & khởi động Frontend (Production Mode — có PWA)
Mở một cửa sổ Terminal mới, di chuyển vào thư mục `frontend` và chạy:
```bash
cd frontend
npm run build && npm run preview
```
*Frontend sẽ build ra bản production rồi serve trên cổng `4173`.*
*Chế độ này có đầy đủ PWA: Service Worker, nút cài app, hoạt động offline.*

> **Lưu ý:** Mỗi khi bạn thay đổi code frontend, cần chạy lại `npm run build && npm run preview` để cập nhật.

---

### Bước 3: Bật Cloudflare Tunnel
Mở một Terminal mới tại thư mục gốc của dự án và chạy:
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
1.  **Giao diện web (Frontend):** Truy cập **`https://cfcbooking.io.vn`**
2.  **Dữ liệu API (Backend):** Truy cập **`https://api.cfcbooking.io.vn/api/v1/...`**

---

## 📱 Cài đặt app PWA lên điện thoại

Khi đang ở `https://cfcbooking.io.vn`:

**Android (Chrome):** Bấm menu `⋮` → **"Thêm vào Màn hình chính"**

**iOS (Safari):** Bấm nút Share `⬆` → **"Thêm vào Màn hình chính"**

---

## 🛠️ Chế độ Dev (chỉ dùng khi phát triển tính năng mới)

Khi cần hot-reload để code nhanh hơn, dùng chế độ dev (không có PWA):
```bash
cd frontend
npm run dev
```
*Frontend sẽ chạy trên cổng `5173` với hot-reload nhưng không có PWA.*

> Nhớ đổi lại port trong `~/.cloudflared/config.yml` từ `4173` về `5173` nếu muốn chạy dev qua domain.

---

## ⚠️ Giải quyết lỗi "DNS_PROBE_POSSIBLE" hoặc "Site can't be reached"

Nếu bạn gặp lỗi này khi truy cập domain:
1.  **Kiểm tra Nameserver đã kích hoạt chưa:** Nhà đăng ký tên miền có thể mất **5 phút đến 24 giờ** để cập nhật NameServer mới (`lynn.ns.cloudflare.com` và `nancy.ns.cloudflare.com`).
    *   Bạn có thể kiểm tra trạng thái domain trên Cloudflare Dashboard. Nếu hiện dòng chữ **Active** (Xanh lá) nghĩa là đã xong.
2.  **Đảm bảo Cloudflare Tunnel đang chạy:** Kiểm tra lại Terminal chạy `start-tunnel.sh` xem có bị tắt hay báo lỗi không.
3.  **Đảm bảo Frontend đã được build và preview:** Nếu bạn chưa chạy `npm run build && npm run preview`, cổng `4173` sẽ không có gì và Cloudflare sẽ báo lỗi 502.
