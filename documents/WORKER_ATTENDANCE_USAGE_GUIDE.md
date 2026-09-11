# Hướng sử dụng Chấm công ca sản xuất

- Cập nhật: **11/09/2026**.
- Phạm vi: tab **Ca sản xuất** dành cho Công nhân và KCS.
- Trạng thái: chức năng đã hoàn tất và kiểm thử local; chưa thay thế bảng công production trước khi hoàn thành Phase 7 shadow/nghiệm thu HR.

## 1. Chuẩn bị lần đầu

1. Đăng nhập bằng tài khoản `MANAGER` hoặc `ADMIN`.
2. Vào **Nhân sự → Chấm công → Ca sản xuất**.
3. Mở **Cấu hình** và kiểm tra cửa nhận diện của các ca, ngưỡng 0/1/1,5/2 công và phụ cấp ca đêm.
4. Tra mã nhân viên để gán nhóm `Công nhân`, `KCS` hoặc `Hành chính` theo thời gian hiệu lực. Hệ thống có thể đề xuất Công nhân từ nhóm LĐ phổ thông và KCS từ phòng ban, nhưng nên gán rõ trước kỳ chạy chính thức.
5. Với người đi công tác/đi thị trường không cần chấm, tạo **Miễn chấm có thời hạn**. Dữ liệu gốc vẫn được giữ để đối soát.

Thay đổi cấu hình không tự sửa file đã chốt. Muốn áp dụng cấu hình mới cho file đang xem trước, bấm **Tính lại**.

## 2. Quy trình mỗi tháng

1. Chọn đúng tháng cần xử lý.
2. Chọn một hoặc nhiều file Time Attendance rồi bấm **Import**.
3. Chọn từng thẻ file và kiểm tra các chế độ **Công nhân**, **KCS**, **Cần kiểm tra**, **Sự cố máy** và **Đã xác nhận**.
4. Với ca tự ghép đúng, chọn nhiều dòng và bấm **Xác nhận**. Với ca thiếu/mơ hồ, mở **Review chi tiết** để xem dấu chấm gốc, chọn lượt vào/ra, ca, số công và phụ cấp; bắt buộc nhập lý do.
5. Nếu máy chấm công gặp sự cố, mở **Sự cố máy**, khai thời gian/phạm vi, bấm **Phân tích**, chọn đúng các ca được ảnh hưởng rồi xác nhận. Hệ thống không sinh giờ chấm giả.
6. Khi mọi ca cần kiểm tra đã được xử lý, bấm **Chốt** trên thẻ file. File chuyển sang chỉ đọc và mới được cộng vào tổng hợp tháng.
7. Kiểm tra KPI tháng rồi bấm **Xuất Excel**.

## 3. File Excel được xuất

- Sheet **Bảng công**: một nhân viên/một dòng, đủ cột ngày 1–31, tổng công, số ca ngày, số ca đêm và tổng phụ cấp đêm.
- Sheet **Đối soát**: ca sự cố/điều chỉnh, ngày bị trùng giữa các file, dấu chấm chưa được dùng và lịch sử sửa.
- Chỉ ca `CONFIRMED` thuộc file đã chốt được cộng công và phụ cấp.
- Nếu nhiều file chứa cùng mã nhân viên/ngày, hệ thống không cộng lặp; dòng trùng được đưa sang sheet **Đối soát**.

## 4. Khóa và mở khóa

- `MANAGER` có thể import, review, xác nhận và chốt nhưng không mở khóa file đã chốt.
- `ADMIN` thấy nút **Mở khóa** và phải nhập lý do. Sau khi mở khóa, file trở lại trạng thái xem trước để điều chỉnh hoặc tính lại, sau đó phải chốt lại.
- Khi file đang khóa, nút **Chi tiết** vẫn xem được dấu chấm và lịch sử nhưng không cho sửa.

## 5. Kiểm tra trước khi dùng production

1. Deploy backend để Flyway áp dụng V21, sau đó deploy frontend cùng phiên bản.
2. Chạy shadow tháng 08/2026, không dùng file xuất mới để trả lương ngay.
3. Đối chiếu B124: 31 ngày, 45 công, 19 ca đêm và 950.000 đồng phụ cấp theo bộ dữ liệu nghiệm thu.
4. HR kiểm tra thêm KCS ca 2, người miễn chấm và sự cố máy tối 17/08.
5. Chỉ chuyển sang sử dụng chính thức sau khi HR ký xác nhận web và Excel khớp bảng đối chiếu.

Nếu cần quay về luồng cũ trong thời gian shadow, chọn tab **Hành chính**; hai pipeline được lưu riêng và không ghi đè dữ liệu của nhau.
