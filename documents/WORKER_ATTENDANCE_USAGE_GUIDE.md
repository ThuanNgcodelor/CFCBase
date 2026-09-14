# Hướng sử dụng Chấm công ca sản xuất

- Cập nhật: **14/09/2026**.
- Phạm vi: tab **Ca sản xuất** dành cho Công nhân và KCS.
- Trạng thái: Phase 1–7 đã hoàn tất và qua gate local; chưa thay thế bảng công production trước khi deploy SHADOW và HR ký nghiệm thu.

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
3. Chọn thẻ file và làm theo thanh **Quy trình xử lý**. Mặc định hệ thống mở **Cần xử lý**, không hiển thị hàng trăm dòng hợp lệ trước.
4. Xem **Tổng quan theo nhân viên** để biết tổng công tạm tính, ca đêm, tăng ca 2 công và số ca cần xử lý của từng người. Cột **Đêm + tăng ca** là tổng số ca đêm cộng số ca có mức 2 công (ví dụ 4 + 4 = 8). Danh sách được tìm kiếm và phân trang từ máy chủ; bấm một nhân viên để mở chi tiết các ngày của người đó.
5. Nếu một nhân viên làm ca ngày theo mức cố định, mở **Cấu hình → Nhân viên và miễn chấm**, tra mã, chọn **Ca ngày cố định 1,5 công**, nhập thời gian hiệu lực và lý do. Sau đó bấm **Tính lại** trên file đang chờ xác nhận. Mức cố định chỉ áp dụng cho ca ngày có đủ cặp dấu vào/ra; không biến ca đêm hoặc ngày thiếu dấu thành ca hợp lệ.
6. Với ca thiếu/mơ hồ, bấm **Kiểm tra** để xem dấu chấm gốc, chọn lượt vào/ra, ca, số công và phụ cấp; bắt buộc nhập lý do. **Ngày không chấm** được giữ nguyên, tính 0 công và không bị coi là lỗi.
7. Mục **Sẵn sàng** chứa ca đã ghép đủ lượt. Có thể xác nhận theo từng trang; nếu không làm riêng, thao tác **Chốt file** sẽ tự xác nhận toàn bộ ca hợp lệ còn lại.
8. Nếu máy chấm công gặp sự cố, mở **Sự cố máy**, khai thời gian/phạm vi, bấm **Phân tích**, chọn đúng các ca được ảnh hưởng rồi xác nhận. Hệ thống không sinh giờ chấm giả.
9. Khi số **Cần xử lý** về 0, bấm **Chốt file**. Nút này bị khóa nếu vẫn còn bất thường; file đã chốt chuyển sang chỉ đọc và mới được cộng vào tổng hợp tháng.
10. Kiểm tra KPI tháng rồi bấm **Xuất Excel**.

Nếu chọn sai tháng khi import, hệ thống đọc tháng trong file, tự chuyển bộ lọc sang tháng đúng và yêu cầu bấm **Import** lại để người dùng xác nhận.

## 3. File Excel được xuất

- Sheet **Bảng công**: một nhân viên/một dòng, đủ cột ngày 1–31, tổng công, số ca ngày, chỉ tiêu **ca đêm + tăng ca 2 công** và tổng phụ cấp đêm.
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
3. Đối chiếu B124: 31 ngày, 45 công, đúng 5 ca đêm ngày 04–08 và 250.000 đồng phụ cấp. Ngày 18 chọn `CN_DAY`, để trống lượt vào, chọn lượt ra 17:24, nhập 1,5 công và phụ cấp 0; hệ thống sẽ tính lại các ngày chưa xác nhận phía sau.
4. HR kiểm tra thêm KCS ca 2, người miễn chấm và sự cố máy tối 17/08.
5. Chỉ chuyển sang sử dụng chính thức sau khi HR ký xác nhận web và Excel khớp bảng đối chiếu.

Nếu cần quay về luồng cũ trong thời gian shadow, chọn tab **Hành chính**; hai pipeline được lưu riêng và không ghi đè dữ liệu của nhau.

Các biến bật/tắt, lệnh deploy Linux, checklist nghiệm thu và rollback: [WORKER_ATTENDANCE_PHASE7_ROLLOUT.md](WORKER_ATTENDANCE_PHASE7_ROLLOUT.md).
