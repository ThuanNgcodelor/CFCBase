# Kế hoạch Triển khai (Phân tách Dashboard, Hoàn thiện Notifications, Cập nhật Calendar & Menu)

Tài liệu này trình bày các bước giải quyết 4 yêu cầu chính: Tách Dashboard Admin/Client, Hoàn thiện hệ thống Thông báo, Fix hiển thị người đặt trên Calendar, và Bố trí lại menu "Tài nguyên".

## Quyết định Kiến trúc: Email & Notification Queue

Sau khi phân tích, chúng ta sẽ áp dụng kiến trúc sau cho hệ thống gửi Email và Xác nhận:

1.  **Hệ thống Hàng đợi (Queue):**
    *   Sử dụng **BullMQ + Redis** trên Backend để xử lý gửi email bất đồng bộ (Asynchronous). Việc này giúp API đặt phòng phản hồi nhanh chóng mà không bị block bởi thời gian chờ SMTP server.
2.  **Cơ chế Gửi Email:**
    *   Dùng **Nodemailer** (hoặc JavaMailSender nếu dùng Java Backend) kết hợp với các mẫu HTML (HTML templates) có chứa logo công ty để gửi email thông báo.
3.  **Tính năng Duyệt qua Email (Quick Action):**
    *   Tạo ra một Endpoint trên Backend: `GET /api/v1/approvals/quick-action?token={JWT_TOKEN}&action=APPROVE`
    *   Trong email gửi đến Admin, sẽ đính kèm 2 nút bấm HTML (Duyệt / Từ chối). Khi Admin click vào, trình duyệt sẽ mở một trang đơn giản xử lý token và xác nhận thành công mà không cần đăng nhập lại (nhờ JWT token mã hóa sẵn thông tin).

## Proposed Changes

---

### 1. Phân tách Dashboard (Admin vs Client)

Hiện tại `Dashboard.jsx` đang gộp chung. Chúng ta sẽ chia ra để mỗi Role nhìn thấy những thông tin ý nghĩa nhất với họ.

#### [NEW] `frontend/src/pages/AdminDashboard.jsx`
- Hiển thị thống kê tổng quan (Phòng trống, Xe sẵn sàng).
- Bảng danh sách "Yêu cầu chờ duyệt" nổi bật ngay đầu trang.
- Biểu đồ tần suất sử dụng (sử dụng `recharts`).

#### [NEW] `frontend/src/pages/ClientDashboard.jsx`
- Lời chào cá nhân hoá.
- Nút bấm nhanh (Quick Actions): "Đặt phòng ngay", "Đặt xe ngay".
- Danh sách "Lịch trình của tôi sắp tới" (My upcoming bookings).
- Trạng thái các yêu cầu đang chờ duyệt của chính mình.

#### [MODIFY] `frontend/src/pages/Dashboard.jsx`
- Sửa thành Component điều hướng (Router-level Component).
- Kiểm tra role của `user`: Nếu là Admin -> render `<AdminDashboard />`, nếu là Client -> render `<ClientDashboard />`.

---

### 2. Hoàn thiện trang Notifications

Thông báo của Admin và Client thực chất chung 1 trang `Notifications.jsx`, nhưng khác nhau ở **Dữ liệu trả về** từ API và **Hành động khi click**.

#### [MODIFY] `frontend/src/pages/Notifications.jsx`
- **Giao diện:** Thêm Avatar của người gửi thông báo (người đặt lịch đối với admin, hoặc avatar hệ thống đối với client). 
- **Chi tiết nội dung:** Hiển thị rõ: "[Tên/Avatar] đã đặt [Phòng/Xe] vào [Thời gian]".
- **Action (Hành động):** Khi Admin click vào thông báo "Yêu cầu chờ duyệt", điều hướng thẳng đến `/admin/approvals/:id` để duyệt. Khi Client click vào thông báo "Đã được duyệt", điều hướng đến trang chi tiết lịch của họ.
- **Tích hợp Real-time:** Chuẩn bị sẵn cơ chế Polling (gọi API mỗi 30s) hoặc nhận sự kiện từ Socket.io để tự tăng số đếm (badge) chưa đọc.

---

### 3. Tối ưu hiển thị Calendar (Sticky Event Content)

**Phân tích vấn đề:** Khi một event trên lịch kéo dài (ví dụ từ 8h sáng đến 5h chiều), thẻ div của event rất dài. Nội dung (Avatar, Tên) nằm ở trên cùng (`top: 0`). Khi kéo chuột xuống (scroll), phần trên cùng bị che khuất, nên chỉ thấy một khối màu xanh.

**Giải pháp:** Sử dụng CSS `position: sticky` để nội dung luôn bám theo tầm nhìn của người dùng khi scroll qua khung giờ đó.

#### [MODIFY] `frontend/src/components/calendar/CustomEvent.jsx`
- Áp dụng class `sticky top-0 z-10` cho thẻ bọc nội dung (Avatar + Tên). 
- Đảm bảo khi scroll lịch, avatar và tên người đặt luôn trôi nổi (float) trên nền xanh của event đó, giúp user dễ dàng nhận diện ai đặt ở bất kỳ khung giờ nào.
- Thêm logic sắp xếp: Trong `react-big-calendar`, mặc định ai đặt trước sẽ nằm bên trái (nếu có tính năng cho phép song song) hoặc chiếm toàn bộ (nếu cấm trùng lặp).

---

### 4. Tái cấu trúc Menu "Tài nguyên"

Việc để "Tài nguyên" ngang hàng với các chức năng hằng ngày (Đặt phòng, Đặt xe) có thể gây nhầm lẫn.

#### [MODIFY] `frontend/src/layouts/DashboardLayout.jsx`
Tôi đề xuất chia Menu của Sidebar thành 2 nhóm (Group):
1. **NHÓM 1: CHỨC NĂNG CHÍNH (Dành cho mọi người)**
   - Trang chủ
   - Lịch phòng họp
   - Lịch xe công tác
2. **NHÓM 2: QUẢN TRỊ VIÊN (Chỉ hiện cho Admin)**
   - Duyệt yêu cầu (Có badge số lượng)
   - Quản trị Tài nguyên (Chứa Phòng, Xe, Mục đích,...)
   - Cài đặt hệ thống (Settings)

Như vậy, mục `{ name: 'Tài nguyên', path: '/admin/resources', icon: Settings, show: isAdmin }` sẽ được đẩy xuống nhóm Quản trị ở nửa dưới của Sidebar, tạo cảm giác chuyên nghiệp như Base hoặc các SaaS chuẩn.

## Verification Plan

### Manual Verification
1. Đăng nhập bằng tài khoản Admin -> Verify thấy Admin Dashboard & Nhóm menu Quản trị.
2. Đăng nhập bằng tài khoản Client -> Verify thấy Client Dashboard & Menu gọn gàng.
3. Tạo một booking dài 10 tiếng trên giao diện Calendar -> Scroll dọc xuống các khung giờ giữa -> Verify Avatar & Tên vẫn "dính" (sticky) và hiển thị rõ ràng trên mặt event.
4. Gửi một yêu cầu đặt mới -> Verify màn hình Notifications hiển thị đầy đủ Avatar, thời gian, mô tả chi tiết của người gửi. Mở tab incognito đóng vai người duyệt -> Verify click vào thông báo tự động chuyển sang form duyệt.
