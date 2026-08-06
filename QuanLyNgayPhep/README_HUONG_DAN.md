# QuanLyNgayPhep

App Google Apps Script riêng để quản lý ngày nghỉ phép từ file danh sách tháng.

## Mục tiêu

- Không cần đăng nhập trong app.
- Ai có link đều xem được toàn bộ phòng ban.
- Chỉ hiển thị dữ liệu phục vụ ngày phép, không đưa lương, CCCD, BHXH, địa chỉ lên giao diện.
- Trưởng phòng hoặc người nhập liệu tạo đề xuất nghỉ phép.
- Quản lý duyệt hoặc từ chối.
- Quản lý có thể chỉnh số ngày phép năm của từng nhân sự và lưu log điều chỉnh.

## File mẫu để upload lên Google Sheet

File đã sinh từ `/home/david-nguyen/Downloads/hr-T8-26.xlsx`:

```text
output/QuanLyNgayPhep_Template.xlsx
```

File này chỉ giữ dữ liệu sạch trong sheet `LEAVE_EMPLOYEES` và tạo sẵn các sheet quản lý:

```text
LEAVE_EMPLOYEES
DEPARTMENT_HEADS
LEAVE_REQUESTS
LEAVE_ADJUSTMENTS
APPROVAL_LOGS
IMPORT_LOGS
CONFIG
```

## Cách dùng

1. Upload `output/QuanLyNgayPhep_Template.xlsx` lên Google Drive.
2. Mở bằng Google Sheets.
3. Vào sheet `DEPARTMENT_HEADS`, điền email trưởng phòng theo từng phòng ban.
4. Vào `Extensions -> Apps Script`.
5. Copy nội dung `Code.js` vào file `Code.gs`.
6. Tạo file HTML tên `Index`, copy nội dung `Index.html` vào.
7. Kiểm tra `Project Settings -> Time zone` là `Asia/Ho_Chi_Minh`.
8. Chạy hàm `setupLeaveWorkbook` một lần để cấp quyền và tạo/chuẩn hóa sheet.
9. Deploy dạng Web app.

## Quyền trưởng phòng

App không cần login riêng, nhưng khu duyệt dùng email Google đang mở web app.

Trong sheet `DEPARTMENT_HEADS`, nhập:

```text
department | head_name | email | active
Tổ chức hành chính | Nguyễn Văn A | truongphong.tchc@gmail.com | TRUE
ALL | Quản lý tổng | admin@gmail.com | TRUE
```

Email có `department = ALL` được duyệt tất cả phòng ban.

Khi deploy Web app nên chọn:

```text
Execute as: User accessing the web app
Who has access: Anyone with Google account
```

Vì app chạy theo người đang mở, hãy share Google Sheet cho những người cần dùng app. Sheet này đã là dữ liệu ngày phép sạch, không có lương, CCCD, BHXH hoặc địa chỉ.

### Cách cho trưởng phòng login và duyệt

1. Mở Google Sheet ngày phép.
2. Vào sheet `DEPARTMENT_HEADS`.
3. Điền đúng email Google của trưởng phòng vào cột `email`.
4. Để cột `active` là `TRUE`.
5. Share Google Sheet cho email trưởng phòng với quyền `Editor`.
6. Deploy Web app với cấu hình:

```text
Execute as: User accessing the web app
Who has access: Anyone with Google account
```

7. Gửi link Web app cho trưởng phòng.
8. Trưởng phòng mở link bằng đúng email đã khai báo.
9. Trên app bấm `Khu duyệt trưởng phòng`.

Nếu email đúng, khu `Duyệt ngày nghỉ` sẽ hiện ra. Nếu email chưa có trong `DEPARTMENT_HEADS`, app sẽ báo chưa có quyền duyệt.

Lưu ý: nhân viên bình thường vẫn không có tài khoản riêng trong app. Họ chỉ mở link, chọn phòng ban, chọn tên, chọn ngày nghỉ và gửi đề xuất.

## Cache tốc độ

App dùng `CacheService` để cache các sheet đọc nhiều như nhân sự, phòng ban, đề xuất nghỉ và trưởng phòng. Cache mặc định khoảng 5 phút.

Khi có thao tác ghi như gửi nghỉ phép, duyệt, từ chối, chỉnh phép năm hoặc import dữ liệu, app tự tăng version cache để lần đọc sau lấy dữ liệu mới.

Nếu bạn sửa tay dữ liệu trực tiếp trong Google Sheet và muốn app nhận ngay, mở Apps Script rồi chạy:

```text
clearLeaveCache
```

Hoặc chờ cache hết hạn trong vài phút.

## Import từ file tháng gốc

Nếu Google Sheet của bạn vẫn giữ sheet tháng gốc như `T8-26`, mở web app rồi bấm:

```text
Import danh sách ngày phép
```

App sẽ đọc header dòng có `HỌ VÀ TÊN` và `NGÀY NGHỈ PHÉP`, sau đó chỉ lấy các cột an toàn:

```text
MÃ SỐ
HỌ VÀ TÊN
ĐƠN VỊ CÔNG TÁC
CHỨC VỤ
NGÀY LÀM
MÔI TRƯỜNG LÀM VIỆC
NĂM CÔNG TÁC
NGÀY NGHỈ PHÉP
```

## Quy tắc tính còn lại

```text
Còn lại = Ngày phép năm - Đã nghỉ được duyệt
```

`Chờ duyệt` được hiển thị riêng để quản lý thấy rủi ro sắp phát sinh, nhưng chưa trừ vào phép còn lại cho tới khi duyệt.

## Lưu ý vận hành

- Nhân viên chỉ nhập tên ở ô `Người nhập`; app không quản lý tài khoản nhân viên.
- Trưởng phòng phải mở khu duyệt bằng email Google có trong `DEPARTMENT_HEADS`.
- Khi gửi đề xuất nghỉ, app gửi email cho trưởng phòng theo phòng ban nếu đã cấu hình email.
- Không sửa tay cấu trúc header các sheet quản lý.
- Nếu thay file tháng mới, upload sheet mới rồi import lại theo tên sheet, ví dụ `T9-26`.
