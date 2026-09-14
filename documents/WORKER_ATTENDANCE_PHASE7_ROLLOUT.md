# Phase 7 — rollout Chấm công ca sản xuất

- Ngày cập nhật: **14/09/2026**.
- Máy chủ: Linux, dùng luồng deploy hiện có trong `deployserver/linux/`.
- Nguyên tắc: chạy **SHADOW** trước; không dùng kết quả trả lương cho đến khi HR ký nghiệm thu.

## 1. Cơ chế an toàn đã có

| Biến | Ý nghĩa |
|---|---|
| `HR_PRODUCTION_ATTENDANCE_ENABLED=false` | Ẩn tab ca sản xuất và không đăng ký controller API; dữ liệu V21 không bị xóa. |
| `HR_PRODUCTION_ATTENDANCE_ENABLED=true` | Bật UI/API ca sản xuất. |
| `HR_PRODUCTION_ATTENDANCE_SHADOW_MODE=true` | Hiện cảnh báo chạy thử; tên và tiêu đề Excel có dấu `SHADOW`/`KHÔNG DÙNG TRẢ LƯƠNG`. |
| `HR_PRODUCTION_ATTENDANCE_SHADOW_MODE=false` | Chế độ chính thức sau khi HR ký nghiệm thu. |

Mặc định của source/deploy hiện tại là `ENABLED=true` và `SHADOW_MODE=true`: tab được mở để demo nhưng kết quả vẫn mang dấu SHADOW. Đặt rõ `ENABLED=false` trong `.env` khi cần rollback khẩn cấp.

`build-prod.sh` nạp hai biến từ `deployserver/linux/.env`, truyền đúng cờ vào Vite và backend, sau đó `run.sh` kiểm tra Flyway V21, 10 bảng, seed ca/ngưỡng công và biên bảo vệ API trước khi mở Cloudflare Tunnel.

## 2. Kiểm tra source trước deploy

Tại thư mục gốc dự án:

```bash
./scripts/verify-worker-attendance-phase7.sh
```

Gate này chạy toàn bộ backend test, frontend lint, frontend build ở chế độ shadow và `git diff --check`. Chỉ deploy khi kết thúc bằng `PASS`.

Lần chạy local gần nhất đạt **191 test backend: 190 pass, 0 failure/error, 1 fixture tùy chọn skipped**; frontend lint/build SHADOW và kiểm tra patch đều đạt.

## 3. Deploy lần đầu ở chế độ SHADOW

Mở file riêng trên server, không commit file này:

```bash
nano deployserver/linux/.env
```

Thêm hoặc sửa đúng một lần mỗi khóa:

```dotenv
HR_PRODUCTION_ATTENDANCE_ENABLED=true
HR_PRODUCTION_ATTENDANCE_SHADOW_MODE=true
```

Không in toàn bộ `.env` ra terminal. Sau đó chạy một lệnh:

```bash
./deployserver/linux/build-prod.sh
```

Kết quả đúng ở cuối log:

```text
Cham cong ca san xuat: enabled (shadow=true)
```

Nếu gate schema/seed thất bại, script dừng trước khi mở tunnel. Không sửa tay bảng Flyway; đọc lỗi và khôi phục nguyên nhân trước.

## 4. Checklist shadow trên web

Đăng nhập tài khoản HR, vào **Nhân sự → Chấm công → Ca sản xuất** và xác nhận có banner màu vàng **Đang chạy thử (SHADOW)**.

### Dữ liệu bắt buộc

- Import `CongXn.xlsx`, tháng `08/2026`.
- Import các file phòng ban tháng 08 khi đối soát KCS/hành chính.
- Không xóa hoặc sửa file báo cáo cũ; đặt hai kết quả cạnh nhau để so sánh.

### Nghiệm thu B124 — Đỗ Đình Cường

- [ ] Có đủ 31 ngày.
- [ ] Ngày 09 = 0 công.
- [ ] Ngày 25, 30, 31 = 1,5 công theo quyết định đã chốt.
- [ ] Tổng = 45 công.
- [ ] Có 19 ca đêm.
- [ ] Phụ cấp đêm = 950.000 đồng.
- [ ] Lượt ra qua tháng chỉ dùng một lần.
- [ ] Ca thiếu lượt vẫn giữ bên thiếu trống; không sinh giờ giả.

### Nghiệm thu KCS và ngoại lệ

- [ ] A057 khoảng 13:00–22:00 nhận `KCS_CA2`, không thành `NO_PUNCH`.
- [ ] Người KD/KHVT chỉ bị loại khi có miễn chấm hiệu lực theo mã và ngày.
- [ ] Sự cố máy tối 17/08 chỉ áp dụng ca được HR chọn và có lịch sử/lý do.
- [ ] Tab Hành chính vẫn import, xem trước, xác nhận và xuất như trước.
- [ ] Manager không thấy nút mở khóa; ADMIN mở khóa phải nhập lý do.

### Nghiệm thu Excel

- [ ] Tên file bắt đầu bằng `SHADOW_`.
- [ ] Tiêu đề có `BẢN SHADOW - KHÔNG DÙNG TRẢ LƯƠNG`.
- [ ] Sheet **Bảng công** khớp KPI trên web.
- [ ] Sheet **Đối soát** liệt kê dòng trùng, dấu chưa dùng và điều chỉnh.

Ghi tên người kiểm tra, ngày kiểm tra và các sai lệch còn lại vào biên bản HR. Không tắt shadow nếu còn bất kỳ mục bắt buộc nào chưa đạt.

## 5. Bật chính thức sau khi HR ký

Chỉ sửa:

```dotenv
HR_PRODUCTION_ATTENDANCE_ENABLED=true
HR_PRODUCTION_ATTENDANCE_SHADOW_MODE=false
```

Sau đó chạy lại đúng một lệnh:

```bash
./deployserver/linux/build-prod.sh
```

Kiểm tra cuối log phải là `enabled (shadow=false)`. Import một file nhỏ hoặc mở tháng đã chốt để xác nhận banner SHADOW biến mất; Excel mới không còn tiền tố `SHADOW_`.

## 6. Rollback

Nếu phát hiện sai lệch sau khi bật chính thức, sửa `.env`:

```dotenv
HR_PRODUCTION_ATTENDANCE_ENABLED=false
HR_PRODUCTION_ATTENDANCE_SHADOW_MODE=true
```

Rồi chạy:

```bash
./deployserver/linux/build-prod.sh
```

Rollback chỉ ẩn UI/tắt API ca sản xuất; không xóa import, dấu chấm, ca, điều chỉnh hoặc cấu hình V21. Tab Hành chính tiếp tục hoạt động. Không rollback migration V21 và không xóa bảng bằng SQL.

## 7. Smoke API có đăng nhập tùy chọn

`run.sh` luôn kiểm tra DB và biên 401/403. Nếu người vận hành có access token HR ngắn hạn, có thể kiểm tra controller thật mà không lưu token vào `.env`:

```bash
BOOKINGBASE_ACCESS_TOKEN='TOKEN_NGAN_HAN' ./deployserver/linux/verify-production-attendance.sh
```

Không chụp màn hình hoặc gửi log chứa token. Xóa biến khỏi shell sau khi kiểm tra.
