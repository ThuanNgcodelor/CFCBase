---
name: architecture-domain
description: Giải thích các khái niệm kiến trúc cấp cao (Domain Knowledge) của hệ thống Booking, dựa trên tài liệu Base Booking.
---

# Kiến trúc và Nghiệp vụ (Domain Architecture)

Đây là kim chỉ nam giúp AI hiểu hệ thống Booking này đang phục vụ ai, giải quyết bài toán gì và mô hình dữ liệu (Data model) vận hành như thế nào. Tránh việc suy diễn sai lệch so với logic kinh doanh ban đầu.

## 1. Khái niệm Cốt lõi (Core Concepts)
Hệ thống được thiết kế theo tư duy của Base.vn, quản lý vạn vật dưới dạng **"Tài nguyên" (Resources)**. Tài nguyên ở đây cụ thể là:
- **Phòng họp (Room)**: Sức chứa, tiện ích đi kèm (máy chiếu, bảng).
- **Xe đi lại (Vehicle/Car)**: Biển số xe, loại xe (4, 7, 16 chỗ), trạng thái đang bảo trì hay chạy chuyến.

Con người trong hệ thống:
- **Người sử dụng (Employee)**: Là những người dùng cuối, đăng nhập để tạo **Yêu cầu (Request)** mượn tài nguyên, kèm theo thông tin chi tiết (Thời gian mượn, Thời gian trả, Điểm đi/Điểm đến, Mục đích).
- **Quản trị viên (Admin/Manager)**: Người có quyền tối cao (Role ADMIN) - xem tổng quan, phê duyệt, từ chối các yêu cầu, thêm sửa xoá tài nguyên.

## 2. Quy trình (Workflow)
1. **Khởi tạo:** Nhân viên đăng nhập -> Chọn Tài nguyên đang rảnh -> Tạo lệnh (Request). Trạng thái lệnh lúc này là `PENDING` (Chờ duyệt).
2. **Xét duyệt:** Admin nhìn thấy lệnh `PENDING` trong màn hình Approvals -> Click xem chi tiết -> Bấm Duyệt (`APPROVED`) hoặc Từ chối (`REJECTED`, kèm lý do).
3. **Sử dụng:** Khi yêu cầu được Duyệt, tài nguyên chuyển sang trạng thái bận trong khung giờ đó. (Logic chống trùng lặp thời gian - Time Overlapping).
4. **Thông báo:** Quá trình duyệt sẽ sinh ra thông báo (Notification) cập nhật lên Header cho nhân viên.

## 3. Quy chuẩn Thiết kế Database (Sơ bộ)
- **User:** Lưu thông tin cá nhân (email, mật khẩu mã hoá, tên, avatar, role, bộ phận).
- **Department:** Bảng danh mục phòng ban (Sales, HR, Tech...).
- **Room / Vehicle:** Thông tin tài nguyên. Có thể gộp chung thành bảng `Resource` dạng Kế thừa (Inheritance) hoặc tách 2 bảng rời rạc tuỳ mức độ phình to, hiện tại đang tách rời.
- **BookingRoom / BookingCar:** Bảng giao dịch chứa khoá ngoại đến User và Resource. Lưu lịch trình cụ thể, trạng thái (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`).
- **ApprovalStep:** Ghi lại lịch sử duyệt, người duyệt, lý do từ chối.

## 4. Hướng dẫn cho AI
Mỗi khi bạn (AI) được yêu cầu bổ sung một tính năng (Ví dụ: Thêm chức năng mượn "Máy in"), hãy luôn map tính năng đó vào khái niệm "Tài nguyên" và tuân thủ chặt chẽ vòng đời (Khởi tạo -> Chờ duyệt -> Duyệt/Từ chối) này.
