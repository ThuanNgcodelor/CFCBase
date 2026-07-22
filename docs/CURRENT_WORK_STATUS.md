# Trạng Thái Công Việc Hiện Tại

Cập nhật lần cuối: 2026-07-22

## Trạng Thái Production

- Production hiện đang **tắt theo xác nhận của người dùng ngày 2026-07-22**; Phase 1 không bật lại backend, tunnel, MySQL hoặc Redis production.
- Khi chạy, production dùng Spring Boot JAR tại port `8080` trên Fedora.
- Frontend `dist` được đóng gói và serve trực tiếp từ Spring Boot JAR.
- Cloudflare Tunnel `bookingbase` (`745ab8be-c55c-4e72-b985-d918206ca82f`) phục vụ:
  - `https://cfcbooking.io.vn`
  - `https://www.cfcbooking.io.vn`
  - `https://api.cfcbooking.io.vn`
- Backend và tunnel chạy dưới transient user systemd units:
  - `bookingbase-backend.service`
  - `bookingbase-tunnel.service`
- Khi chạy, MySQL và Redis dùng Docker named volumes để giữ dữ liệu.
- Lần verify gần nhất trước khi người dùng tắt production: local HTTP `200`, public HTTP `200`, backend/tunnel đều `active`.

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

## Phân Hệ HR — Phase 0.1 Baseline

- Kiến trúc đã chốt: `Employee` độc lập hoàn toàn với `User`; danh mục HR dùng bảng riêng; chỉ role `MANAGER` truy cập module.
- File gốc bất biến `docs/Danh sách nhân sự 2026.xlsx`: SHA-256 `3e88290c865b73870c6557ff06b8273fcff012f22225c094526d020c39359a60`.
- Archive byte-identical của bản người dùng format: SHA-256 `8c4d54aa757fc75a16a5ab15b031c1245668a0dfdc4a99afb42f6ea143fef195`.
- Baseline cuối `docs/hr-template/baseline-values-2026.xlsx`: SHA-256 `d8f4ff9e292b68d1ec50b623159ef34095f7441d3487fa1e422140f0fdeaadbe`, 118.239 byte, quyền `600`.
- Final chỉ có `GIAM`, `TĂNG`, `T6-26`: ba sheet visible, 0 hidden, 0 formula, 17 OOXML parts.
- `T6-26` đúng vùng `A1:AH333`; 329 nhân sự/329 mã duy nhất; `AH` là cột `NGÀY NGHỈ PHÉP` và 329 giá trị đang trống.
- Đối chiếu file gốc: `T6-26` 10.857/10.857 ô, `GIAM` 130 ô, `TĂNG` 119 ô; tất cả 0 mismatch. 18/18 comment T6 khớp mapping.
- Đã xóa 25 sheet ẩn, 667 hàng style rỗng, vùng helper ngoài `AH`, shared strings/drawing/relationship mồ côi. Giữ nguyên `styles.xml` và snapshot value/type/style của vùng được giữ.
- Giữ 29 literal `#N/A` cần xác minh nhưng đã bỏ pseudo-formula; Phase 2 không được insert chúng như giá trị nghiệp vụ.
- Deterministic builder/verifier, manifest, ZIP integrity và LibreOffice headless open/PDF smoke đều `PASS`.
- Workbook chứa PII bị ignore khỏi Git; manifest chỉ chứa checksum/số đếm.
- Kế hoạch: `docs/HR_MANAGEMENT_IMPLEMENTATION_PLAN.md`; báo cáo: `docs/hr-template/PHASE_0_1_BASELINE_REPORT.md`.
- Phase 0.1 hoàn thành ngày `2026-07-22`; không thay đổi runtime production.

## Phân Hệ HR — Phase 1 Schema

- Phase 1 hoàn thành ở source code ngày `2026-07-22`; chỉ build artifact để kiểm tra, chưa chạy migration/restart/deploy production và chưa thay đổi database production.
- Đã thêm Flyway với cấu hình an toàn trong `backend/src/main/resources/application.properties`.
- `baseline-on-migrate` mặc định `false`; database legacy chỉ baseline version `0` khi deploy operator chủ động bật biến môi trường sau backup.
- Migration V1 chỉ tạo 15 bảng `hr_*`; không alter/drop/delete/truncate bảng BookingBase cũ.
- `HrEmployee` tách hoàn toàn khỏi `User`: không `user_id`, không FK sang `users`, không dùng danh mục Department cũ.
- Domain có hồ sơ chính, công việc, định danh, bảo hiểm, liên hệ, danh mục HR, biến động, snapshot tháng, import staging/template và audit.
- Tuổi, thâm niên và tổng thu nhập là derived fields; không lưu trùng. Có `leave_accrual_start_date` và monthly `leave_days` cho phase phép sau này.
- Baseline có BHXH/CMND trùng nên các số giấy tờ chỉ được index, chưa ép unique; raw/normalized staging bảo toàn dữ liệu trước validate.
- Status dùng `VARCHAR + CHECK`, không dùng MySQL ENUM.
- Hibernate schema filter chặn `ddl-auto` create/update/drop/truncate mọi bảng `hr_*`; Flyway là owner duy nhất của schema HR.
- Repository lịch sử không expose generic delete; roster/import evidence dùng FK `RESTRICT`.
- Import cùng file/sheet có `attempt_number` để retry; confirm vẫn idempotent bằng confirmation key.
- Audit callback HR dùng UTC; status lifecycle quan trọng được khóa bằng CHECK.
- Có script chụp row-count legacy, verifier read-only và quy trình first-deploy tự final-backup sau khi production dừng, chỉ mở tunnel khi verify pass.
- First deploy dùng cờ one-time `--initialize-hr-schema`; run bình thường sẽ báo lỗi ngắn, rõ ràng nếu database legacy chưa có Flyway history thay vì để backend in stack trace dài.
- Flyway V1 + second no-op + MySQL constraints + Hibernate update filter/ORM validate đã pass trên MySQL `8.0.46` cô lập; container tự xóa, không dùng production volume.
- Tài liệu kỹ thuật/vận hành: `docs/HR_PHASE_1_SCHEMA.md`.

## Verification Gần Nhất

- Frontend `npm run lint`: pass, còn 1 warning cũ ở `CustomDateHeader.jsx`.
- Frontend `npm run build`: pass; còn warning main chunk khoảng 773 KB.
- Backend: 54 tests pass với ByteBuddy Java agent trên JDK hiện tại; 9 test Phase 1 mặc định kiểm tra migration, no-op, bảo toàn schema cũ, isolation, ownership và delete surface.
- MySQL 8 integration: 1 test pass riêng, gồm Flyway/constraints/FK retry+RESTRICT/Hibernate update filter/ORM validate và production-style schema verifier.
- Production JAR build: pass.
- Executable JAR Web Push smoke test: pass.
- `git diff --check`: pass.

## Rủi Ro / Việc Còn Lại

- Flyway đã có cho HR nhưng production đang tắt và chưa thực hiện one-time baseline/V1; `ddl-auto: update` chỉ còn quyền trên schema legacy qua filter, chờ phase capture schema cũ.
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

1. Áp dụng Flyway baseline `0` + V1 trong cửa sổ deploy riêng, có backup, đối chiếu và chạy verifier; không bật chỉ để test production.
2. Triển khai Phase 2 import baseline theo flow upload -> preview -> validate -> confirm, chưa seed dữ liệu trong schema migration.
3. Thêm integration test cho register -> Admin notification -> approve -> login.
4. Test Web Push registration thật trên iOS/Android với Admin subscription active.
5. Đưa toàn bộ secrets production sang `.env`/secret store và rotate credential đã từng dùng làm default.
6. Tách route frontend để giảm main bundle.
