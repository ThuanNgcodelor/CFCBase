# BookingBase UI Redesign — Phase 0 Baseline

> **LƯU TRỮ:** Booking đã dừng phát triển ngày `2026-07-27`. File này chỉ giữ lịch sử Phase 0; không có Booking Phase 6–10.

Cập nhật: 2026-07-27

Trạng thái: **Hoàn thành khảo sát source, chưa thay đổi giao diện runtime**

Phạm vi: phần Booking, Admin, tài khoản và app shell dùng chung. Phân hệ HR chỉ được dùng làm visual reference; không thay đổi nghiệp vụ HR trong phase này.

## 1. Mục tiêu Phase 0

- Khóa route, quyền và luồng nghiệp vụ trước khi redesign.
- Xác định component có blast radius lớn.
- Lập danh sách màn hình và trạng thái cần giữ khi triển khai.
- Ngăn việc đổi giao diện làm hỏng deep link, PWA, calendar hoặc phân quyền.

Code/config hiện tại là `Source of Truth`. Concept chỉ thay đổi cách trình bày.

## 2. Route và quyền phải giữ nguyên

| Route | Màn hình | Quyền hiện tại | Yêu cầu khi redesign |
|---|---|---|---|
| `/` | Trang tổng quan | User đã đăng nhập; `MANAGER` chuyển về HR | Giữ redirect theo role |
| `/rooms` | Lịch phòng họp | User đã đăng nhập | Giữ calendar và range-based fetch |
| `/rooms/create` | Tạo lịch phòng họp | User đã đăng nhập | Giữ dữ liệu slot được truyền từ calendar |
| `/cars` | Lịch xe | User đã đăng nhập | Giữ calendar và range-based fetch |
| `/cars/create` | Tạo lịch xe | User đã đăng nhập | Giữ dữ liệu slot được truyền từ calendar |
| `/notifications` | Thông báo | User đã đăng nhập | Giữ deep link theo type/source |
| `/profile` | Hồ sơ cá nhân | User đã đăng nhập | Không đổi login/profile flow |
| `/admin/approvals` | Duyệt đặt chỗ | `ADMIN` hoặc `MANAGER` theo guard hiện tại | Không nới quyền từ chối/hủy |
| `/admin/approvals/:id` | Chi tiết booking | User đã đăng nhập theo route hiện tại | Giữ deep link từ calendar/email/push |
| `/admin/profile-approvals` | Duyệt hồ sơ | `ADMIN` | Giữ guard `AdminRoute` |
| `/admin/profile-approvals/:id` | Chi tiết duyệt hồ sơ | `ADMIN` | Giữ deep link |
| `/admin/users` | Quản lý tài khoản | `ADMIN` | Giữ tab chờ duyệt và badge |
| `/manager/hr/**` | Quản lý nhân sự | `MANAGER` active | Ngoài phạm vi nghiệp vụ Booking |

Các route public `/login`, `/register`, `/forgot-password` chỉ được restyle sau; Phase 0–1 không đổi OTP, token, session hoặc redirect.

## 3. Navigation theo role

### EMPLOYEE

- Trang chủ
- Lịch phòng họp
- Lịch xe
- Thông báo
- Hồ sơ cá nhân và đăng xuất

### ADMIN

- Toàn bộ menu của Employee
- Duyệt đặt chỗ
- Duyệt hồ sơ
- Tài khoản, kèm badge số tài khoản chờ duyệt

### MANAGER

- Thông báo
- Quản lý nhân sự
- Không hiển thị Trang chủ, Lịch phòng họp, Lịch xe và nhóm Admin trong app shell hiện tại

Redesign không được suy luận quyền từ nhãn giao diện. Quyền tiếp tục do route guard và backend quyết định.

## 4. Invariant của lịch phòng và lịch xe

- Fetch booking theo khoảng hiển thị của `month`, `week`, `day`.
- Giữ `AbortController` khi request cũ không còn cần thiết.
- Giữ request sequence guard để response cũ không ghi đè response mới.
- Giữ filter resource và status ở API.
- Giữ mapping/filter event bằng `useMemo`.
- Không hiển thị `REJECTED` và `CANCELLED` trong lịch đang hoạt động.
- Không cho chọn slot quá khứ.
- Chọn slot hợp lệ chuyển sang form create và mang theo `start/end`.
- Chọn event mở `/admin/approvals/:id`.
- Giữ view `month`, `week`, `day`, bước 30 phút và popup khi có nhiều event.
- Không runtime-cache API booking trong Service Worker.

## 5. Invariant của tạo booking

### Phòng họp

- Tiêu đề
- Phòng họp
- Bắt đầu, kết thúc
- Số người tham gia
- Yêu cầu chuẩn bị/ghi chú

### Xe công tác

- Tiêu đề/mục đích
- Xe đề xuất
- Điểm đón, điểm đến
- Thời gian xuất phát, dự kiến kết thúc
- Mô tả chi tiết

Quy tắc chung:

- `startTime < endTime`.
- Giữ giá trị preselect từ calendar.
- Backend vẫn lấy requester từ authenticated principal; UI không được tạo cảm giác người dùng có thể chọn requester.
- Thành công quay lại lịch tương ứng.
- Error/loading phải có trạng thái rõ ràng.

## 6. Invariant của duyệt và chi tiết booking

- Hiển thị đúng loại phòng/xe, resource, requester, thời gian và ghi chú.
- Hiển thị lịch sử xử lý và người duyệt thật.
- Approve: `ADMIN` hoặc `MANAGER` theo flow hiện tại.
- Reject: chỉ `ADMIN`, lý do không bắt buộc.
- Cancel booking đã duyệt: chỉ `ADMIN`, xác nhận có/không, không yêu cầu lý do.
- Canceller/approver lấy từ authenticated principal.
- Mail/push/notification vẫn xử lý sau commit; redesign không đưa side effect vào transaction.
- Deep link từ notification/email/PWA phải mở đúng booking.

## 7. Blast radius frontend

| Khu vực | Vấn đề hiện tại | Cách cô lập khi triển khai |
|---|---|---|
| `DashboardLayout.jsx` | App shell, role nav, user, notification, footer và mobile drawer nằm cùng file | Tách shell theo component nhưng giữ nguyên props/state/guards |
| `RoomBooking.jsx` và `CarBooking.jsx` | Hai page song song, cùng calendar anatomy | Dùng shared calendar shell, giữ fetch và mapping riêng |
| `CustomToolbar.jsx` | Dùng chung cho cả hai calendar | Thiết kế variant `room/car`, không copy toolbar |
| Calendar event components/CSS | Ảnh hưởng month/week/day và responsive | Đổi từng lớp, kiểm tra đủ ba view |
| Create room/car | Form gần giống nhưng field nghiệp vụ khác | Dùng shared form section, không hợp nhất payload |
| `BookingDetail.jsx` | Detail, approval, reject, cancel và history cùng màn | Chỉ tách presentation; không đổi handlers/quyền |
| `DashboardLayout` notification menu | Liên quan database notification và deep link | Giữ resolver hiện tại |

## 8. Trạng thái UI bắt buộc phải thiết kế

- Loading.
- Empty.
- Error.
- Default/idle.
- Filter đang áp dụng.
- Booking `PENDING`.
- Booking `APPROVED`.
- Booking `REJECTED`.
- Booking `CANCELLED`.
- Calendar event quá khứ.
- Form đang gửi.
- Hộp xác nhận hủy.
- Drawer/modal mở.
- Mobile keyboard mở và sticky action.
- PWA safe area iOS/Android.

## 9. Viewport nghiệm thu

Desktop:

- 1366×768
- 1440×900
- 1920×1080

Mobile/PWA:

- Android 360×800
- Android 412×915
- iPhone 375×812
- iPhone 390×844
- iPhone 430×932

## 10. Gate trước khi triển khai code

- Concept không đổi route hoặc quyền.
- Calendar vẫn là calendar, không chuyển thành dashboard card.
- Mobile không ép month grid quá nhỏ; ưu tiên agenda/day khi cần.
- Control chạm tối thiểu khoảng 44px.
- Không horizontal overflow ngoài khu vực calendar có chủ đích.
- Text, form, table, calendar và action phải được dựng bằng React; không dùng ảnh concept làm UI.
- Chỉ bắt đầu refactor sau khi người dùng duyệt Phase 1.
