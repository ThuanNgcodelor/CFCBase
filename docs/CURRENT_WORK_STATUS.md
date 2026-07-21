# Trạng Thái Công Việc Hiện Tại

Cập nhật lần cuối: 2026-07-21

## Trạng Thái Production

- Production đang chạy trên Fedora bằng Spring Boot JAR tại port `8080`.
- Frontend `dist` được đóng gói và serve trực tiếp từ Spring Boot JAR.
- Cloudflare Tunnel `bookingbase` (`745ab8be-c55c-4e72-b985-d918206ca82f`) phục vụ:
  - `https://cfcbooking.io.vn`
  - `https://www.cfcbooking.io.vn`
  - `https://api.cfcbooking.io.vn`
- Backend và tunnel chạy dưới transient user systemd units:
  - `bookingbase-backend.service`
  - `bookingbase-tunnel.service`
- MySQL và Redis chạy bằng Docker, dữ liệu dùng named volumes.
- Lần verify gần nhất: local HTTP `200`, public HTTP `200`, backend/tunnel đều `active`.

## Script Deploy

Linux, nguồn triển khai hiện tại:

- `deployserver/linux/build-prod.sh`: build frontend, package JAR vào staging, smoke-test Web Push, backup JAR cũ và kích hoạt JAR mới.
- `deployserver/linux/build-prod.sh --build-only`: chỉ build/kích hoạt artifact, không restart runtime.
- `deployserver/linux/run.sh`: start DB/Redis, restart backend, health-check port `8080`, sau đó start Cloudflare Tunnel.
- `deployserver/linux/stop-prod.sh`: stop backend/tunnel và Docker DB/Redis.
- Các file `.desktop` chỉ là launcher cho desktop Linux; không chạy bằng shell như script `.sh`.

Các script Windows vẫn được giữ để tương thích nhưng Fedora/Linux hiện là môi trường production chính.

## Authentication Và Tài Khoản

- Login chính thức dùng email/password; Google Login đang ẩn khỏi giao diện.
- Tài khoản Google mới không được tự động tạo; người dùng phải đăng ký email và xác minh OTP.
- Access token mặc định 8 giờ.
- Refresh token có thời hạn 90 ngày và tách theo thiết bị/session trong Redis:
  - `refreshToken:{email}:{sessionId}`
- Frontend tự silent-refresh và đồng bộ auth storage, phục vụ phiên PWA iOS dài hạn.
- Có backward compatibility để migrate refresh token Redis dạng legacy.
- User status hiện có: `PENDING_APPROVAL`, `ACTIVE`, `INACTIVE`, `REJECTED`.

### Register Mới

1. Người dùng nhập email và nhận OTP có TTL 5 phút.
2. Người dùng nhập OTP, họ tên và mật khẩu.
3. Tài khoản được tạo ở trạng thái `PENDING_APPROVAL`.
4. Tài khoản chờ duyệt hoặc bị từ chối không thể login/refresh token.
5. Admin nhận database notification, realtime/Web Push nếu thiết bị có active subscription, và badge tài khoản chờ duyệt.
6. Admin duyệt hoặc từ chối tại `/admin/users?tab=pending`.
7. Người đăng ký nhận email kết quả; chỉ tài khoản `ACTIVE` mới login được.

Giới hạn đúng của Web Push: người vừa đăng ký nhưng chưa từng login chưa có Push Subscription gắn với user, vì vậy họ nhận trạng thái qua UI/email. Push đăng ký mới hướng tới thiết bị Admin đã đăng nhập và cấp quyền.

### Forgot Password

- OTP đặt lại mật khẩu có TTL 5 phút.
- Màn hình Register và Forgot Password đều nhắc người dùng kiểm tra Spam/Thư rác nếu chưa thấy email.
- Profile có chức năng đổi mật khẩu cho tài khoản email/password.
- Avatar được cập nhật trực tiếp, không cần tạo profile approval request.

## Quản Trị Tài Khoản Và Navbar

- Trang Admin Users có hai tab: `Chờ phê duyệt` và `Tạo tài khoản`.
- Danh sách chờ duyệt có pagination, approve/reject và số lượng pending.
- Navbar Admin hiển thị badge pending account.
- Các nhãn đã rõ nghiệp vụ hơn: `Lịch phòng họp`, `Lịch xe`, `Duyệt đặt chỗ`, `Duyệt hồ sơ`, `Tài khoản`.
- Mục `Tài nguyên` chưa có chức năng đã được loại khỏi navbar.
- Dashboard header ưu tiên hiển thị tên thật lấy từ `/users/me`, không phụ thuộc full name trong JWT.

## Booking, Approval Và Lịch Sử

- Booking phòng/xe lấy requester từ authenticated principal.
- Giữ validation `startTime < endTime`, resource locking và overlap check chuẩn.
- Blocking statuses vẫn là `PENDING` và `APPROVED`.
- Reject booking không bắt buộc lý do và chỉ Admin được reject theo flow hiện tại.
- Admin có trang lịch sử xử lý với filter/sort/pagination.
- Admin có thể hủy booking đã được duyệt tại trang chi tiết.
- Hủy booking đã duyệt chỉ cần hộp xác nhận, không yêu cầu nhập lý do.
- Canceller lấy từ authenticated principal, không tin ID từ request body.

## Notification, PWA Và Deep Link

- Database notification là Source of Truth; WebSocket chỉ realtime delivery.
- Notification click được resolve theo `type/sourceType/sourceId`, không đoán theo title.
- Mapping chính:
  - Booking pending -> `/admin/approvals/{id}`
  - Profile approval -> `/admin/profile-approvals/{id}`
  - Account registration -> `/admin/users?tab=pending`
  - Profile result -> `/profile`
- Cùng resolver được dùng cho notification page, navbar dropdown và Service Worker.
- Web Push chỉ gửi cho active subscription.
- Lỗi 403/404/410 deactivate subscription; network/408/429/5xx retry có giới hạn.
- PWA không runtime-cache booking API động.

## Email

- Tất cả email dùng chung responsive HTML template `EmailTemplateService`.
- Template có CFC Base branding, tone theo trạng thái, detail card, CTA và footer.
- Nội dung do người dùng nhập được HTML-escape.
- Link lấy từ `${FRONTEND_URL}` qua `app.frontend-url`, mặc định `https://cfcbooking.io.vn`.
- OTP register/forgot, account pending/approved/rejected, booking và profile mail đều dùng cùng format.
- Email booking phòng/xe chứa người yêu cầu, resource, địa điểm/hành trình, ngày, giờ bắt đầu-kết thúc, trạng thái và lý do nếu có.
- Mail/push chạy độc lập sau commit; lỗi side effect không rollback booking.

## Profile, Avatar Và SEO

- Profile hỗ trợ đổi mật khẩu email/password.
- Update avatar trực tiếp, không cần Admin duyệt.
- Admin profile approval hiển thị avatar hiện tại thay vì dữ liệu Google cũ.
- Favicon/title dùng asset web hiện tại.
- Open Graph dùng `og-image.png`/asset versioned tương ứng; cache social preview bên ngoài có thể cần cache-busting hoặc purge phía nền tảng.

## Database Migration Đã Áp Dụng

Do MySQL ENUM cũ không tự nhận enum Java mới:

- `users.status` đã chuyển từ `enum('ACTIVE','INACTIVE')` sang `VARCHAR(32)`.
- `notifications.type` đã chuyển sang `VARCHAR(64)`.
- `notifications.source_type` giới hạn `VARCHAR(64)` để unique index nằm trong giới hạn MySQL.
- Migration notification đã được kiểm tra bảo toàn dữ liệu:
  - Trước: 40 dòng.
  - Sau: 40 dòng.
  - Checksum trước/sau: `91856053349`.
- Backup trước migration: `/tmp/booking_notifications_before_type_migration_20260720.sql` trên máy deploy tại thời điểm thực hiện.
- SQL áp dụng lại được lưu ở `deployserver/fix-user-status.sql` (file deploy local có thể bị Git ignore).

## Backup Database Tự Động

- `bookingbase-backup.timer` đang active và chạy mỗi giờ vào phút `05`.
- User linger đang bật để timer hoạt động sau logout/reboot mà không cần mở terminal.
- Backup toàn bộ schema/data MySQL bằng `mysqldump --single-transaction`, có triggers/routines/events.
- File `.sql.gz` nằm trong `backups/database/`, quyền `600`; thư mục quyền `700` và bị Git ignore.
- Ghi file theo kiểu temp -> validate -> atomic rename; không xóa bản tốt nếu dump mới thất bại.
- Giữ 24 bản gần nhất; bản thứ 25 trở đi mới bị xóa sau khi backup mới thành công.
- Restore có xác nhận `RESTORE`, tạo backup khẩn cấp trước rồi import toàn bộ database bằng root credential bên trong container.
- Hướng dẫn vận hành: `docs/DATABASE_BACKUP.md`.

## Phân Hệ HR — Phase 0 Template

- Đã chốt kiến trúc `Employee` độc lập hoàn toàn với `User`; không có `user_id` hoặc đồng bộ ngầm.
- Phòng ban, chức vụ và điều kiện lao động HR sẽ dùng bảng riêng; chỉ role `MANAGER` được truy cập module HR.
- `T6-26` trong `docs/Danh sách nhân sự 2026.xlsx` là canonical sheet.
- Đã khóa SHA-256 source: `3e88290c865b73870c6557ff06b8273fcff012f22225c094526d020c39359a60`.
- Đã tạo template v1 local-only, dùng cột trống `AM` cho `NGÀY NGHỈ PHÉP` và không insert/shift `AN:CQ`.
- Builder/verifier chỉ patch `sheet12.xml`; mọi OOXML part khác, formula fingerprint, comment, merge, cached errors, print settings và external link được giữ nguyên.
- Workbook có PII được ignore khỏi Git và đặt quyền `600`; không đóng gói vào backend JAR.
- Kế hoạch: `docs/HR_MANAGEMENT_IMPLEMENTATION_PLAN.md`.
- Báo cáo/command: `docs/hr-template/PHASE_0_TEMPLATE_REPORT.md`.
- Phase 0 không thay đổi backend, frontend, database hoặc runtime production.

## Verification Gần Nhất

- Frontend `npm run lint`: pass, còn 1 warning cũ ở `CustomDateHeader.jsx`.
- Frontend `npm run build`: pass; còn warning main chunk khoảng 773 KB.
- Backend: 45 tests pass với ByteBuddy Java agent trên JDK hiện tại.
- Production JAR build: pass.
- Executable JAR Web Push smoke test: pass.
- `git diff --check`: pass.

## Rủi Ro / Việc Còn Lại

- Chưa có migration framework chính thức; hiện vẫn dựa trên `ddl-auto: update` và SQL deploy thủ công cho thay đổi enum/index quan trọng.
- Production secrets/default secrets cần được đưa hoàn toàn ra environment variables và rotate.
- Frontend main chunk còn lớn; cần route-level code splitting khi tối ưu tiếp.
- Cần test end-to-end PWA push trên nhiều thiết bị iOS/Android thật, đặc biệt notification click khi app đóng.
- Cần test social preview cache trên các nền tảng gửi link khác nhau.
- Có orphan `booking_adminer` container được Docker Compose cảnh báo; chưa xóa vì không liên quan runtime chính và tránh thao tác phá hủy ngoài yêu cầu.

## File Quan Trọng Hiện Tại

- `backend/src/main/java/com/booking/system/service/AuthService.java`
- `backend/src/main/java/com/booking/system/service/AccountRegistrationService.java`
- `backend/src/main/java/com/booking/system/service/EmailTemplateService.java`
- `backend/src/main/java/com/booking/system/event/NotificationEventListener.java`
- `frontend/src/api/authStorage.js`
- `frontend/src/utils/notificationNavigation.js`
- `frontend/src/components/admin/AdminPendingRegistrations.jsx`
- `frontend/src/layouts/DashboardLayout.jsx`
- `frontend/src/sw.js`
- `deployserver/linux/build-prod.sh`
- `deployserver/linux/run.sh`
- `deployserver/linux/backup-database.sh`
- `deployserver/linux/restore-database.sh`

## Bước Tiếp Theo Gợi Ý

1. Thêm migration framework (Flyway/Liquibase) trước các thay đổi schema tiếp theo.
2. Thêm integration test cho register -> Admin notification -> approve -> login.
3. Test Web Push registration thật trên iOS/Android với Admin subscription active.
4. Đưa toàn bộ secrets production sang `.env`/secret store và rotate credential đã từng dùng làm default.
5. Tách route frontend để giảm main bundle.
