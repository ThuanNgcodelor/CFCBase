# Triển khai với Cloudflare Tunnel

## 1. Cloudflare Tunnel là gì?

Cloudflare Tunnel (trước đây gọi là Argo Tunnel) là dịch vụ giúp bạn mở một đường hầm an toàn từ server hoặc máy local lên mạng Internet qua Cloudflare, mà không cần mở port trên firewall/public IP.

Nó phù hợp khi bạn muốn:
- Triển khai nhanh backend từ máy local hoặc server trong mạng nội bộ.
- Giữ backend chạy 8080 nhưng vẫn truy cập qua tên miền an toàn.
- Không cần public IP hoặc cấu hình NAT/Port Forwarding.

## 2. Các bước cơ bản triển khai

### Bước 1: Chuẩn bị tài khoản và domain

1. Đăng ký tài khoản Cloudflare.
2. Thêm domain bạn muốn dùng vào Cloudflare (ví dụ: `cfbooking.io.vn` hoặc `bookingbase.cfc.com`).
3. Cloudflare sẽ cung cấp 2 hoặc 4 tên máy chủ (Name Server). Ví dụ:
   - `ns1.zonedns.vn`
   - `ns2.zonedns.vn`
   - `ns3.zonedns.vn`
   - `ns4.zonedns.vn`

### Bước 2: Cấu hình Name Server tại nhà đăng ký domain

1. Vào trang quản lý domain tại nơi bạn mua domain (nhà đăng ký).
2. Thay đổi Name Server từ giá trị mặc định sang Name Server của Cloudflare.
3. Lưu và chờ DNS thay đổi toàn cầu, thường 5-30 phút, có thể tới 24-48 giờ.

> Lưu ý: Name Server là nơi quản lý DNS cho domain của bạn. Nếu domain không trỏ về Cloudflare, Cloudflare không thể điều phối tên miền đó.

### Bước 3: Cài đặt `cloudflared`

- Trên Windows: tải từ https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation
- Trên Linux/macOS: cài bằng package manager hoặc tải binary.

### Bước 4: Đăng nhập Cloudflare từ `cloudflared`

```
cloudflared login
```

Sau khi chạy, trình duyệt sẽ mở Cloudflare và yêu cầu bạn chọn zone/domain.

### Bước 5: Tạo Tunnel

```
cloudflared tunnel create bookingbase
```

Kết quả sẽ tạo tunnel mới và file credential JSON ở thư mục `~/.cloudflared/`.

### Bước 6: Cấu hình Tunnel

Tạo file cấu hình `cloudflared-config.yml` như sau:

```yaml
tunnel: <TUNNEL_ID_CỦA_BẠN>
credentials-file: C:\Users\<Username>\.cloudflared\<TUNNEL_ID_CỦA_BẠN>.json
ingress:
  - hostname: api.bookingbase.cfc.com
    service: http://localhost:8080
  - service: http_status:404
```

- `hostname`: tên miền bạn muốn dùng để truy cập backend.
- `service`: dịch vụ nội bộ chạy trên cổng `8080`.

### Bước 7: Đăng ký DNS route cho Tunnel

Trong Cloudflare CLI, bạn có thể cấu hình DNS route:

```
cloudflared tunnel route dns bookingbase api.bookingbase.cfc.com
```

Hoặc thêm record thủ công trong Cloudflare DNS:
- Tên: `api`
- Loại: `CNAME`
- Giá trị: `<tunnel-name>.cfargotunnel.com` (Cloudflare tự tạo khi route DNS).

### Bước 8: Chạy Tunnel

```
cloudflared tunnel --config D:\Đường_dẫn\cloudflared-config.yml run bookingbase
```

Hoặc nếu dùng service/daemon, cấu hình chạy tự động khi server khởi động.

## 3. Triển khai thực tế cho BookingBase

### Nếu chỉ cần backend API

- Backend Spring Boot chạy `localhost:8080`.
- Tunnel định tuyến `api.bookingbase.cfc.com` → `http://localhost:8080`.
- Frontend có thể gọi API qua `https://api.bookingbase.cfc.com`.

### Nếu muốn cả frontend và backend

- Với frontend chạy Vite dev: thêm route riêng như `app.bookingbase.cfc.com`.
- Với frontend đã build và phục vụ bằng Nginx: có thể deploy cùng server và route cùng qua `localhost:3000` hoặc bất kỳ cổng nội bộ nào.

## 4. Giải thích Name Server (NS) và DNS

- Name Server (NS) là máy chủ chịu trách nhiệm lưu và trả về bản ghi DNS cho domain.
- Khi bạn đổi Name Server về Cloudflare, Cloudflare quản lý DNS của domain đó.
- Trong Cloudflare DNS, bạn thêm record như `A`, `CNAME`, `TXT`.
- Với Tunnel, bạn chỉ cần thêm record `CNAME` cho hostname bạn muốn sử dụng.

Ví dụ với domain `cfbooking.io.vn`:
- `Name Server 1`: `ns1.zonedns.vn`
- `Name Server 2`: `ns2.zonedns.vn`
- `api.cfbooking.io.vn` trỏ đến tunnel
- `app.cfbooking.io.vn` trỏ đến tunnel (nếu cần frontend)

## 5. Khi nào cần dùng Tunnel?

Phù hợp khi:
- bạn không có server public IP hoặc không muốn mở port 8080 ra Internet.
- bạn muốn preview hoặc demo nhanh trên môi trường local.

Không phù hợp nếu:
- bạn cần production thật sự với hiệu năng cao, ổn định lâu dài.
- bạn cần quản lý hoàn toàn traffic, logging và bảo mật riêng.

## 6. Gợi ý cho tài liệu `BookingBase`

- Giữ `cloudflared-config.yml` trong repo để team dùng chung.
- Thêm bước chạy Tunnel vào README/deploy guide.
- Nếu cần deploy thực tế, nên dùng thêm service systemd / Windows Service để `cloudflared` tự khởi động.
