# Kế hoạch migration Attendance sang CFCBase

Tài liệu này đối chiếu pipeline trong `Attendance/docs` với module HR hiện tại
trong CFCBase. Mục tiêu là giữ cách dùng quen thuộc của Apps Script nhưng dữ
liệu, quyền truy cập và file đầu ra được quản lý trong CFCBase.

## Luồng đã có trong CFCBase

1. Quản trị viên mở **HR → Chấm công** và cấu hình dòng tiêu đề, cột mã, tên,
   ngày, các cột giờ và các khung giờ vào/ra.
2. Có thể chọn tháng (`MM/YYYY`) để đối chiếu và chọn nhiều file Excel trong
   một lần import.
3. Backend đọc từng dòng, nhận dạng ngày Excel (kể cả `01-Jul-26`), tìm nhân
   viên theo mã, lấy lượt vào sớm nhất và lượt ra muộn nhất trong khung cấu
   hình.
4. Nếu chỉ có một lượt chấm, hệ thống tự điền lượt còn thiếu theo giờ mặc định
   (mặc định giao diện là 07:30 và 17:00) và đánh dấu `AUTO_FILLED` để người
   dùng biết đây là dữ liệu suy ra.
5. Mã nhân viên nằm trong danh sách **miễn chấm công** được lưu để đối soát,
   nhưng không tính công và không xuất vào file sạch.
6. Mỗi lần import có bản xem trước, lý do lỗi theo từng dòng, tải file đã format,
   tải bảng `CONG_...` dạng pivot và xoá được toàn bộ lần import.

## Khác biệt cần giữ rõ

| Nội dung | Apps Script | CFCBase hiện tại |
|---|---|---|
| Lưu file | Google Drive/Sheet | Database + file Excel tải trực tiếp |
| Nhiều file | Có | Có qua endpoint batch |
| File sạch | Archive 8 cột | `*-da-format.xlsx` |
| Bảng Công | `CONG_...` pivot | `CONG_...xlsx` theo nhân viên/ngày |
| Dòng thiếu một lượt | Có thể 0.5 hoặc tự điền tùy cấu hình | Tự điền mặc định nếu đã cấu hình; nếu không thể thì báo lỗi |
| Người đi thị trường | Xử lý thủ công sau file tổng hợp | Danh sách mã miễn chấm công trong cấu hình |

## Giai đoạn tiếp theo

### 1. Hoàn thiện dữ liệu chấm công

- Bổ sung bộ kiểm thử cho ngày dạng số Excel, `dd-MMM-yy`, ngày ISO và ngày
  ngoài tháng đã chọn.
- Hiển thị riêng số dòng `Hợp lệ`, `Tự điền`, `Bỏ qua` và `Lỗi`; không gộp
  `AUTO_FILLED` vào lỗi.
- Cân nhắc thêm tùy chọn “cho phép tự điền” thay vì chỉ dựa vào giờ mặc định.

### 2. Tổng hợp đi trễ/về sớm

- Tạo endpoint tổng hợp theo tháng từ các record đã import.
- Dùng giờ chuẩn và phút miễn trừ trong cấu hình để tính số lần/phút đi trễ,
  về sớm.
- Cho phép lọc theo phòng ban, mã nhân viên và xuất `TONGHOP_...xlsx`.

### 3. Dashboard

- KPI: tổng nhân sự, tổng ngày công, số lượt đi trễ, tổng phút trễ.
- Bảng top nhân viên/phòng ban và tỷ lệ đúng giờ.
- Chỉ lấy dữ liệu đã được quản trị viên xác nhận; không coi bản xem trước là
  dữ liệu chốt.

### 4. Vận hành và an toàn

- Giới hạn kích thước/số file mỗi batch, chống upload trùng bằng SHA-256.
- Ghi actor tạo/xóa/cấu hình vào activity log.
- Phân quyền chỉ HR/Admin; giữ cascade khi xóa một lần import.
- Thêm job dọn dữ liệu xem trước quá hạn sau khi có chính sách lưu trữ.

## Tiêu chí nghiệm thu

- Import được đồng thời các file TCHC/PTC/XNK/KCS.
- Ngày `01-Jul-26` được nhận là `2026-07-01`, không còn báo “Ngày chấm công
  không hợp lệ”.
- Một dòng chỉ có check-in hoặc check-out được điền lượt còn thiếu và có lý do
  rõ ràng trong bản xem trước.
- File sạch và file `CONG_...` tải được, mở được bằng Excel.
- Có thể xóa một file import và không còn bản ghi xem trước tương ứng.
- `./mvnw test`, `npm run lint` và `npm run build` chạy đạt trước khi deploy.
