# HR — Import Baseline T6-26 gồm 339 nhân sự

Cập nhật: 2026-07-23

Trạng thái: **artifact one-time khóa theo số liệu lịch sử đã được hiệu chỉnh; không phải chức năng import hàng loạt của Phase 6**.

## File phải dùng

Chỉ upload file sau:

```text
docs/hr-template/workforce-baseline-339-2026.xlsx
SHA-256: e35f22c83f5dacb542c7b3cff76238fcbaf8ac22f7e85b786d62d2c1de6cf6f7
```

Workbook có đúng ba sheet hiển thị: `TĂNG`, `GIẢM`, `T6-26`. Sheet `T6-26` chứa đúng 339 hồ sơ. Không có sheet ẩn, không có `T7-26` và không có công thức.

Không upload trực tiếp `Baseline-value-339-2026.xlsx`: đó là file nguồn do người dùng format. Backend chỉ nhận artifact có checksum ở trên.

## Ý nghĩa nghiệp vụ

Số liệu đúng là **tháng 6/2026 có 339 nhân sự**, không phải baseline 329 rồi tăng/giảm thành 339. Vì vậy import này:

- tạo một baseline `T6-26` duy nhất;
- tạo 339 Employee `ACTIVE`, 339 movement `INITIAL_LOAD` và một roster `T6-26 CLOSED` gồm 339 item;
- không tạo `T7-26`;
- không tự tạo movement `INCREASE` hoặc `DECREASE` và không tạo hồ sơ nghỉ việc giả.

Từ sau baseline này, Manager dùng chức năng Tăng/Giảm và Danh sách tháng bình thường để tạo `T7-26` khi tới kỳ.

## Điều kiện và kết quả

Preview chỉ cho confirm khi miền HR đang trống: không có Employee và không có roster. Nếu còn dữ liệu 329 cũ, roster cũ hoặc dữ liệu HR khác, không được confirm; cần dọn đúng theo quy trình trước khi import.

Sau confirm thành công:

```text
T6-26 CLOSED:        339 item
Employee ACTIVE:     339
Employee lịch sử:    339
INITIAL_LOAD:         339
T7-26:                chưa tồn tại
```

Nếu có lỗi, transaction rollback toàn bộ. Retry cùng `confirmationKey` trả kết quả cũ, không nhân đôi dữ liệu.

`G083` được để trống CCCD vì file nguồn lặp số với `G082`; Manager cần xác minh giấy tờ gốc rồi cập nhật qua hồ sơ nhân sự, không được đoán số giấy tờ.

## Cách thao tác

1. Backup database.
2. Đăng nhập bằng tài khoản `MANAGER`.
3. Vào `Quản lý nhân sự -> Tăng / Giảm`.
4. Chọn `workforce-baseline-339-2026.xlsx`, rồi bấm `Đọc và đối chiếu`.
5. Chỉ tiếp tục khi preview hiển thị mục tiêu `339`, hiện tại `0`, không có lỗi chặn và thông báo sẽ tạo `T6-26`.
6. Nhập `339`, đọc xác nhận, rồi bấm import.
7. Kiểm tra `Danh sách tháng`: chỉ có `T6-26`, trạng thái `CLOSED`, 339 item.
8. Kiểm tra `Nhân sự`: 339 người `ACTIVE`; `Tăng / Giảm` không có tăng/giảm tự sinh.

API giữ nguyên để frontend tương thích:

| Method | Endpoint | Tác dụng |
| --- | --- | --- |
| `POST` multipart | `/api/v1/hr/imports/workforce-snapshot/preview` | Đọc artifact khóa và đối chiếu, không ghi dữ liệu |
| `POST` multipart | `/api/v1/hr/imports/workforce-snapshot/confirm` | Import baseline T6-26 nguyên tử với `confirmationKey` và `expectedActiveEmployees=339` |

Chỉ `MANAGER` đang `ACTIVE` được gọi. Actor lấy từ authenticated principal, không nhận ID người thao tác từ request.
