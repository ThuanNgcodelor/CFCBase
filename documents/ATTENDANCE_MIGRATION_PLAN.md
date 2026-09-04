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
   (07:30 hoặc 16:30) và đánh dấu `AUTO_FILLED` để người dùng biết đây là dữ
   liệu suy ra. Nếu không có lượt chấm, dòng vẫn được giữ nguyên với trạng thái
   `NO_PUNCH`.
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
| Dòng thiếu một lượt | Có thể 0.5 hoặc tự điền tùy cấu hình | Tự điền mặc định 07:30/16:30 |
| Dòng không có lượt | Giữ ngày để đối soát | Giữ nguyên dòng, không tính lỗi |
| Người đi thị trường | Xử lý thủ công sau file tổng hợp | Danh sách mã miễn chấm công trong cấu hình |

## Trạng thái triển khai Phase 2

### Đã hoàn thành

- Có kiểm thử cho ngày Excel numeric, `dd-MMM-yy`, ISO và `d/M/yyyy`.
- UI tách riêng `Hợp lệ`, `Tự điền`, `Không chấm`, `Miễn chấm` và `Lỗi`.
- Cấu hình có công tắc **Tự điền lượt chấm còn thiếu**. Quy tắc chỉ kích hoạt
  khi dòng đã có đúng một phía; không tự tạo công cho dòng trống hoàn toàn.
- Import có bước **Xác nhận**; báo cáo tháng chỉ đọc batch `CONFIRMED`.
- Endpoint tổng hợp tháng tính ngày công, số lần/phút đi trễ, về sớm và tỷ lệ
  đúng giờ; hỗ trợ lọc phòng ban/mã nhân viên.
- UI có KPI tháng, bảng chi tiết nhân viên và xuất `TONGHOP_MM-YYYY.xlsx`.
- Khi nhiều file đã xác nhận trùng mã nhân viên/ngày, tổng hợp chỉ lấy một dòng
  tốt nhất, ưu tiên `VALID` hơn `AUTO_FILLED`, để không nhân đôi ngày công.
- Ghi audit khi đổi cấu hình, import, xác nhận và xóa batch.
- Migration `V16__complete_hr_attendance_workflow.sql` bổ sung số liệu phân loại,
  người/thời điểm xác nhận và index theo tháng/trạng thái.

### Việc vận hành còn lại

- Smoke test trên file thật TCHC/PTC/XNK/KCS sau khi deploy migration V16.
- Chốt chính sách số ngày lưu batch `PREVIEWED`; sau đó mới bật job dọn tự động.
- Dashboard phòng ban chuyên sâu và biểu đồ xu hướng là phần mở rộng, không chặn
  luồng chấm công tháng hiện tại.

## Tiêu chí nghiệm thu

- Import được đồng thời các file TCHC/PTC/XNK/KCS.
- Ngày `01-Jul-26` được nhận là `2026-07-01`, không còn báo “Ngày chấm công
  không hợp lệ”.
- Một dòng chỉ có check-in hoặc check-out được điền lượt còn thiếu và có lý do
  rõ ràng trong bản xem trước.
- File sạch và file `CONG_...` tải được, mở được bằng Excel.
- File phải được xác nhận trước khi xuất hiện trong KPI và `TONGHOP_...xlsx`.
- Có thể xóa một file import và không còn bản ghi xem trước tương ứng.
- `./mvnw test`, `npm run lint` và `npm run build` chạy đạt trước khi deploy.
