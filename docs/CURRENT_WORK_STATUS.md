# Trạng Thái Công Việc Hiện Tại

Cập nhật lần cuối: 2026-07-27

## Phạm Vi Sản Phẩm Hiện Tại

- Chỉ phân hệ **Quản lý nhân sự** còn tiếp tục phát triển.
- Booking phòng họp, xe và approval Booking đã ngừng hoạt động về mặt roadmap.
- Booking Phase 0–5 được giữ làm lịch sử; Booking Phase 6–10 chính thức hủy.
- Chưa xóa mã/tables Booking vì chúng là legacy và có thể còn chia sẻ Auth, Notification, PWA, deploy hoặc dữ liệu lịch sử.
- Không nhận thêm task Booking trừ khi người dùng chủ động mở lại phạm vi.

Trạng thái roadmap HR:

```text
Hoàn thành source/UI: Phase 0 -> Phase 9; Phase 10 có reconciliation read-only
Hiện tại: Phase 10 — UAT, đối soát dữ liệu thật và rollout theo quyền vận hành
Tiếp theo: Browser UAT và reconciliation read-only với số liệu TCHC
Cuối cùng: Chỉ deploy/restart khi người dùng cho phép
```

## Trạng Thái Production

- Lần xác nhận trước đó: production đã được người dùng tắt ngày `2026-07-22` trong lúc xây Phase 1/2.
- Ngày `2026-07-23`, người dùng xác nhận số liệu lịch sử đúng của tháng 6 là `339`, không phải `329`. Dữ liệu 329 cũ đã được xóa và người dùng sau đó báo import artifact chuẩn 339 thành công.
- Ảnh người dùng ngày `2026-07-27` cho thấy UI HR đang xuất hiện trên domain runtime; agent chưa thực hiện reconciliation độc lập database để khóa số lượng hiện tại sau các biến động.
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

## Booking, Approval Và Lịch Sử — Legacy Đã Dừng Phát Triển

Nội dung phần này chỉ mô tả mã/dữ liệu cũ. Không còn nằm trong kế hoạch phát triển tiếp theo.

- Booking phòng/xe lấy requester từ authenticated principal.
- Giữ validation `startTime < endTime`, resource locking và overlap check chuẩn.
- Blocking statuses vẫn là `PENDING` và `APPROVED`.
- Reject booking không bắt buộc lý do và chỉ Admin được reject theo flow hiện tại.
- Admin có trang lịch sử xử lý với filter/sort/pagination.
- Admin có thể hủy booking đã được duyệt tại trang chi tiết.
- Hủy booking đã duyệt chỉ cần hộp xác nhận, không yêu cầu nhập lý do.
- Canceller lấy từ authenticated principal, không tin ID từ request body.

### Booking UI Redesign — Phase 0–5

- Đã hoàn thành ở source Phase 0–5 theo hướng `CFC Operations Desk` trước khi roadmap Booking bị đóng.
- Đây là lịch sử triển khai, không có Booking Phase 6–10 và không tiếp tục deploy/redesign Booking.
- Phase 2–3 đã chuẩn hóa design token, primitive và app shell desktop/mobile theo role.
- Phase 4 đã redesign Dashboard Admin/Employee và calendar phòng/xe; giữ range fetch, stale guard, memoization và mobile day-first.
- Phase 5 đã redesign form phòng/xe, booking dossier/timeline, approval ledger/history và preview drawer/full-screen mobile sheet.
- Payload tạo booking không gửi `requesterId`; dashboard client lấy principal từ backend; dashboard Admin chỉ cho `ADMIN`.
- Frontend lint/build/PWA pass; 6 test security/controller mới của dashboard pass.
- Browser QA local đã kiểm tra 1440×900 và 390×844 bằng API mock, không gọi production.
- Báo cáo: `docs/BOOKING_UI_PHASE_4_5_IMPLEMENTATION.md`.

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

- Phase 1 hoàn thành ở source/test cô lập ngày `2026-07-22`.
- Người dùng xác nhận migration HR đã được chạy ngày `2026-07-23`; agent chưa query Flyway history/schema/runtime để xác minh độc lập.
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

## Phân Hệ HR — Phase 2 Import Baseline

- Phase 2 importer 329 là bước lịch sử; bộ 329 đã bị xóa.
- Flow one-time hiệu chỉnh đã khóa `workforce-baseline-339-2026.xlsx`; người dùng báo import 339 thành công, agent chưa reconciliation độc lập database.
- Parser OOXML khóa đúng SHA-256, ba sheet và `T6-26!A4:AH333`; giới hạn ZIP/XML an toàn, cấm formula/macro/external relationship.
- Flow lõi: upload -> staging -> preview phân trang -> validate -> confirm có warning acknowledgement; upload và confirm đều idempotent.
- Với artifact active 339, upload chỉ preview; confirm mới tạo nguyên tử 339 Employee độc lập, hồ sơ con, 339 movement `INITIAL_LOAD` và snapshot đóng T6-26.
- `#N/A`/optional value lỗi thành `null + warning`; không tự bịa dữ liệu. Tuổi, tổng thu nhập, thâm niên chỉ đối chiếu; không lưu trùng.
- `NGÀY LÀM` không bị suy diễn thành `leaveAccrualStartDate`; ngày phép chỉ lấy từ cột `AH` của snapshot.
- Rollback tự động có guard downstream; giữ batch, issue, checksum và audit.
- Flyway V2 bổ sung retention staging PII. Raw/normalized payload tự purge theo deadline mặc định 30 ngày; batch preview/validation bị bỏ quên cũng chuyển `FAILED` rồi purge.
- Snapshot tháng không sao chép CCCD/CMND, BHXH/BHYT, địa chỉ, điện thoại hoặc lương/phụ cấp.
- Baseline thật parse đủ 329 mã duy nhất, 0 lỗi chặn; 29 `#N/A` cột Z được cảnh báo và tổng 111 `birthPlaceCurrent` để null/cần review.
- MySQL 8.0.46 container tạm đã confirm/rollback cả baseline thật 329 dòng và pass V1/V2, JSON contract, conflict atomicity, retention cùng read-only verifier; container không dùng volume và đã tự xóa.
- Tài liệu: `docs/HR_PHASE_2_BASELINE_IMPORT.md`; script test: `scripts/hr-schema/verify-phase2-mysql.sh`.

## Phân Hệ HR — Phase 3 Security, API Và UI Manager

- Phase 3 hoàn thành ở source/test cô lập ngày `2026-07-22`; agent không tạo account Manager.
- Trạng thái artifact/service đang phục vụ lần import ngày `2026-07-23` chưa được agent kiểm tra độc lập.
- `/api/v1/hr/**` chỉ cho đúng role `MANAGER`: thiếu token trả `401`; `ADMIN`/`EMPLOYEE` trả `403`; `MANAGER` trả `200`.
- Actor ghi audit/import lấy từ authenticated `User` đang active; request không nhận `actorId`/`managerId` từ client.
- API có overview; nhân sự phân trang/filter/sort; detail DTO trả đầy đủ dữ liệu cho `MANAGER`; tạo/sửa hồ sơ `DRAFT`; danh mục HR; import; movement/roster/audit read-only.
- Edit dùng `rowVersion`, chặn hồ sơ ngoài `DRAFT`; field lương/CCCD/BHXH/BHYT/liên hệ để trống vẫn giữ nguyên dữ liệu cũ.
- Mapping chi tiết HR cascade remove đúng vòng đời nên rollback baseline Phase 2 vẫn xóa sạch dữ liệu import có guard.
- `MANAGER` login, silent refresh hoặc mở PWA tại `/` đều chuyển tới `/manager/hr`; deep link `/manager/**` được SPA forward.
- Giao diện responsive dùng chung DashboardLayout/notification/push: overview, list/detail/form, danh mục, import; movement/roster/audit ở chế độ read-only.
- Route HR được lazy-load. Action Tăng/Giảm, mở/chốt tháng và export Excel đúng template chưa được giả lập; vẫn thuộc Phase 5–6.

## Phân Hệ HR — Phase 4 Giao Diện Manager

- Phase 4 hoàn thành ở source; giao diện HR hiện đã xuất hiện trên runtime theo ảnh người dùng. Formal UAT checklist vẫn chưa đóng.
- Phạm vi hiện tại là giao diện cho API Phase 3: overview, nhân sự, hồ sơ `DRAFT`, danh mục, import baseline và các trang movement/roster/audit read-only.
- Sidebar `MANAGER` chỉ hiển thị `Thông báo` và nhóm `Quản lý nhân sự`; login/silent refresh/PWA root đi tới `/manager/hr`.
- Catalog filter/form tải đủ mọi trang; deep link roster tự lấy metadata; pagination có số trang; nội dung dùng ngôn ngữ nghiệp vụ thay cho nhãn Phase kỹ thuật.
- Batch `CONFIRMED` hiển thị kết quả/CTA rõ ràng; rollback được chuyển vào khu vực khôi phục nâng cao và bắt nhập đúng mã batch cùng tổng số dòng.
- Audit hiển thị trường thay đổi đã lọc; tài khoản không còn `ACTIVE` bị chặn ngay cả khi access token cũ còn hạn.
- Edit trực tiếp hồ sơ `ACTIVE`, Tăng/Giảm, mở/chốt tháng, export và ngày phép không thuộc Phase 4.
- Acceptance/UAT chi tiết: [HR Phase 4 — Giao diện Manager](HR_PHASE_4_MANAGER_UI.md).

## Verification Phase 4

- Frontend `npm run lint`: pass, còn 1 warning cũ ở `CustomDateHeader.jsx`.
- Frontend `npm run build`: pass; PWA/service worker build pass, main chunk hiện khoảng 780,55 KB.
- Backend target Phase 4: 8 test pass cho roster detail, audit DTO và security 401/403/manager-inactive.
- Backend regression: 75 test được chạy, 0 failure/error và 1 test biến thể môi trường được skip. Trên JDK 25 phải chạy với ByteBuddy Java agent như baseline dự án.
- MySQL 8 integration: 5 test methods pass, gồm Flyway V1/V2, constraints/ORM, upload/preview/validate/confirm baseline thật, conflict atomicity, rollback, retention, JSON type và production-style schema verifier.
- Production JAR chứa frontend Phase 4 mới: build pass.
- Executable JAR Web Push smoke test: pass.
- `git diff --check`: pass.

## Phân Hệ HR — Phase 5 Tăng/Giảm Và Danh Sách Tháng

- Phase 5 hoàn thành source/automated test; các màn nghiệp vụ đã xuất hiện trên runtime, nhưng formal UAT ghi dữ liệu chưa được ghi nhận là đã đóng.
- Chỉ `MANAGER` đang `ACTIVE` được tạo/xác nhận/hủy Tăng/Giảm; actor luôn lấy từ authenticated principal.
- `INCREASE` chỉ nhận Employee `DRAFT`; `DECREASE` chỉ nhận Employee `ACTIVE` và bắt buộc lý do.
- Movement có idempotency key, optimistic `rowVersion`, pessimistic lock và vòng đời `DRAFT -> CONFIRMED/CANCELLED`; confirmed history không sửa/xóa trực tiếp.
- Flow cũ tạo/mở/chốt roster vẫn còn ở backend để tương thích, nhưng UI Manager hiện dùng projection sống theo ngày hiệu lực.
- `T6-26` từ import là dữ liệu nền. Danh sách tháng hiển thị hiện tại được tính từ T6 và movement đã xác nhận, không cần chốt trên UI.
- Tháng hiện tại tự xuất hiện qua API dạng projection; không cần Manager bấm tạo tháng.
- Hard-delete chỉ cho Employee/movement/roster `DRAFT` tạo tay và chưa có reference.
- UI Manager đã có form Tăng/Giảm, tìm Employee theo trạng thái, confirm/cancel/delete nháp, xem danh sách tháng tự động và xóa hồ sơ nháp.
- Chi tiết hồ sơ HR hiển thị đầy đủ CCCD/CMND, BHXH/BHYT, liên hệ và lương/phụ cấp cho `MANAGER`; roster/audit vẫn không sao chép dữ liệu nhạy cảm.
- Integration test khóa baseline cũ vẫn giữ snapshot gốc; Phase 8 thêm test projection để giảm hiệu lực trong T6 làm T6 và T7 cùng cập nhật số hiển thị.
- Artifact one-time khóa đúng `workforce-baseline-339-2026.xlsx` SHA-256 `e35f22c83f5dacb542c7b3cff76238fcbaf8ac22f7e85b786d62d2c1de6cf6f7`.
- Artifact có ba sheet visible `TĂNG`, `GIẢM`, `T6-26`; T6 có 339 người. Không import trực tiếp `Baseline-value-339-2026.xlsx`.
- Nếu HR trống, một confirm nguyên tử tạo T6 `CLOSED` 339, 339 movement `INITIAL_LOAD`; không tự tạo Tăng/Giảm hoặc T7.
- Hậu điều kiện khóa: 339 Employee `ACTIVE`, 339 hồ sơ lịch sử và T6 339. G083 để trống CCCD để chờ xác minh thay vì sao chép số bị trùng từ nguồn.
- Đây là baseline riêng cho dữ liệu 2026, không phải generic bulk import/export của Phase 6.
- Tài liệu nghiệp vụ/API/UAT: [HR Phase 5 — Tăng/Giảm và danh sách tháng](HR_PHASE_5_WORKFORCE_MONTHLY.md).
- Tài liệu import một file: [HR — Import một lần danh sách 339](HR_WORKFORCE_IMPORT_339.md).

## Verification Phase 5

- Backend target Phase 5: service reconciliation/lifecycle, controller actor, roster contract và security đều pass.
- Frontend `npm run lint`: pass, còn một warning cũ ở `CustomDateHeader.jsx`.
- Frontend `npm run build`: pass; PWA/service worker build pass, main chunk khoảng 780,65 KB và còn chunk-size warning cũ.
- Backend full regression với ByteBuddy Java agent trên JDK 25: 80 test, 0 failure/error và 1 test biến thể môi trường được skip.
- Production JAR chứa frontend Phase 5 mới package thành công; chưa kích hoạt/restart artifact.
- `git diff --check`: pass tại thời điểm cập nhật.

### Verification runtime đang chờ

- Browser UAT desktop/mobile/deep-link: chưa hoàn tất.
- Read-only reconciliation runtime sau khi người dùng xóa bộ 329: agent chưa thực hiện. Chưa được giả định database trống cho tới khi preview baseline 339 trả `applicable=true` và `bootstrap=true`.

## Phân Hệ HR — Phase 6 Export Excel

- Phase 6 export Excel hoàn thành source/automated test; UI export đã có trên runtime, formal UAT đối chiếu workbook chưa đóng.
- UI export đặt tại `/manager/hr/rosters` đúng trang `Danh sách tháng`.
- Header có ô nhập năm và nút `Export năm`; mỗi card roster có nút `Export tháng`.
- Export năm gọi `GET /api/v1/hr/exports/year?year=2026` và tạo workbook 14 sheet: `Tăng`, `Giảm`, `T1 26` ... `T12 26`.
- Export tháng gọi `GET /api/v1/hr/exports/month?year=2026&month=6` và tạo workbook 3 sheet: `Tăng`, `Giảm`, `T6 26`.
- Sheet tháng chưa có roster vẫn được tạo với header để giữ đúng cấu trúc file.
- Sheet roster export theo template workbook chuẩn và join lại hồ sơ Employee để xuất đủ các cột BHXH/BHYT, CCCD/CMND, địa chỉ, điện thoại, lương/phụ cấp nếu dữ liệu hiện có.
- Tài liệu: [HR Phase 6 — Export Excel](HR_PHASE_6_EXCEL_EXPORT.md).

## Phân Hệ HR — Phase 7 Ngày Phép Đã Gỡ

- Phase 7 tính ngày phép tự động đã được gỡ khỏi source theo quyết định ngày `2026-07-24` vì công thức nghiệp vụ chưa chốt.
- Không còn `HrLeaveEntitlementService`, không còn API `currentLeaveDays`, và frontend không hiển thị ngày phép tự tính.
- Dữ liệu `leave_days` có sẵn từ import/snapshot vẫn không bị xóa khỏi schema/database; hệ thống chỉ không tự tính hoặc dùng nó trên UI hiện tại.
- Nếu cần triển khai lại, nên làm phase riêng sau khi có quy tắc nhân sự chính thức và case test từ phòng TCHC.

## Phân Hệ HR — Phase 7 Ứng Viên Thử Việc Và Hợp Đồng Word

- Phase 7 đã hoàn thành source và UI đã xuất hiện trên runtime theo ảnh người dùng; formal UAT toàn flow bằng ứng viên giả chưa đóng.
- Flow mới thêm `Ứng viên thử việc` trước `Hồ sơ chờ chính thức`/`Tăng nhân sự`.
- Flow mới không đưa ứng viên thử việc vào `HrEmployee ACTIVE` hoặc roster chính thức.
- Flow chuẩn: `Ứng viên thử việc -> tạo hợp đồng thử việc -> đạt thử việc -> chuyển thành HrEmployee DRAFT -> Tăng nhân sự -> chính thức vào danh sách tháng`.
- Đã phân tích file nguồn `docs/hrdocsthuviec/Mẫu Hợp đồng thử việc 2026.docx`: file có 10 hợp đồng đã điền dữ liệu thật, không có mail merge/content control, nên không dùng trực tiếp làm runtime template.
- Đã tạo template sạch cho backend: `backend/src/main/resources/hr/templates/probation-contract-template.docx`.
- Template backend còn một hợp đồng, có 22 placeholder `{{...}}`, không còn tên/CCCD mẫu đã kiểm tra; SHA-256 `34e2b4209ec0596a2003dadbe4ee98e33a9565a157383282cfe08ee84eb16f03`.
- Đã thêm Flyway V3 `V3__add_hr_probation_candidates.sql` với bảng ứng viên, mẫu công việc và hợp đồng thử việc.
- Đã thêm backend entity/repository/service/controller dưới `/api/v1/hr/probation/**`; file `.docx` generated lưu DB blob kèm checksum/snapshot placeholder.
- Đã thêm `HrProbationJobTemplateSeeder`: tự tạo 9 mẫu công việc thử việc mặc định từ phần nội dung an toàn của file Word gốc, không seed dữ liệu cá nhân; không ghi đè mẫu đã tồn tại.
- Đã thêm frontend API, route `/manager/hr/probation` và menu `Thử việc` cho `MANAGER`.
- UI có 2 tab: `Ứng viên` và `Mẫu công việc thử việc`; hỗ trợ thêm/sửa ứng viên, tạo/tải hợp đồng, bắt đầu thử việc, đánh dấu đạt/không đạt và chuyển thành `HrEmployee DRAFT`.
- Đã tạo/cập nhật plan triển khai: [HR Phase 7 — Ứng viên thử việc và hợp đồng Word](HR_PHASE_7_PROBATION_CONTRACTS.md).
- Giao diện HR đã được hardening responsive ngày `2026-07-27`: toolbar theo chiều rộng content sau sidebar; bảng Nhân sự/Thử việc/Tăng-Giảm/Danh mục/Danh sách tháng/Nhật ký tự chuyển sang card khi không đủ chỗ.
- Phase 7 đã hoàn thành source và gate ổn định UI ngày `2026-07-27`; formal runtime UAT dữ liệu thật được giữ ở gate vận hành.
- QA frontend Phase 7: lint pass, production/PWA build pass; đã kiểm tra list 1280px, table 1920px, drawer desktop, drawer PWA 390x844 và trang chỉnh mẫu mobile.

## Roadmap HR Còn Lại

### Phase 8 — Projection sống cho danh sách tháng

- Business rule đã đổi: bỏ chế độ chốt/mở tháng trên UI.
- Danh sách tháng là quân số cuối tháng, tính từ baseline T6 và movement đã xác nhận theo `effective_date`.
- Backend thêm projection service; list/detail/items roster và export Excel dùng cùng số liệu sống.
- UI `/manager/hr/rosters` bỏ nút tạo/chốt/mở lại; tháng hiện tại tự xuất hiện.
- Source/automated verification đã hoàn thành; chưa deploy/restart production, chưa sửa dữ liệu runtime, chưa browser UAT.

### Phase 9 — UX điều chỉnh biến động đã xác nhận

- Source hoàn thành: preview quân số trước/sau trước confirm, điều chỉnh/đảo confirmed movement bằng row mới liên kết row gốc, audit và guard downstream history.
- Migration V4 chỉ thêm cột liên kết/index; không rewrite dữ liệu HR cũ.
- Có thể thêm ngày đơn vị báo cáo/lý do báo trễ nếu TCHC cần.

### Phase 10 — Đối soát, UAT và rollout

- Source reconciliation baseline/movement/projection đã có API/UI chỉ đọc, hiển thị quân số hiện tại và số movement/điều chỉnh đã tính.
- UAT case tăng/giảm cùng tháng, báo trễ, quyền, backward compatibility và Excel còn chờ runtime.
- Hardening hiệu năng, EXPLAIN data thật, backup/restore và rollout theo gate còn chờ quyền vận hành.

Plan chi tiết: [HR Phase 8–10 — Refactor danh sách nhân sự tháng](HR_PHASE_8_10_MONTHLY_ROSTER_REFACTOR.md).

Kho giấy tờ nhân sự, báo cáo tổng hợp nâng cao, cảnh báo hồ sơ và ngày phép được chuyển về backlog sau Phase 10.

## Verification Phase 7

- Backend `./mvnw -q -DskipTests compile`: pass.
- Frontend `npm run build`: pass; PWA/service worker build pass; main chunk khoảng 780,70 KB và còn chunk-size warning cũ.
- Frontend `npm run lint`: pass, còn warning cũ/nhẹ ở `DashboardLayout.jsx` do icon import/commented nav và `CustomDateHeader.jsx`.
- Backend target migration tests `HrPhase1MigrationTest,HrPhase2RetentionMigrationTest`: pass với Flyway V1/V2/V3.
- Backend full `mvn test`: hiện fail do Mockito inline/ByteBuddy không self-attach được trên Java 25 Fedora; nhóm failure đếm migration đã được cập nhật và không còn xuất hiện.

## Dọn Dẹp Repo Ngày 2026-07-24

- Đã dọn đúng các file tạm an toàn:
  - `docs/.~lock.Danh sách nhân sự 2026.xlsx#`
  - `docs/hr-template/archive/.~lock.baseline-values-2026-user-formatted-source.xlsx#`
  - `scripts/hr-template/__pycache__/build-workforce-update-339-2026.cpython-314.pyc`
  - `scripts/hr-template/__pycache__/hr_baseline_values_contract.cpython-314.pyc`
- Không xóa workbook gốc, archive, baseline, artifact 339, template backend, script builder/verifier hoặc tài liệu phase.
- Không thay đổi database/runtime production trong bước dọn dẹp này.

## Rủi Ro / Việc Còn Lại

- Tài liệu và source cũ vẫn còn nhiều tên `BookingBase`; đây là legacy kỹ thuật, không đồng nghĩa Booking còn trong roadmap.
- Flyway V1/V2 đã được người dùng báo áp dụng; bộ 329 từng import rồi đã xóa, nhưng chưa có query độc lập xác nhận HR hiện trống sạch. Không chạy initialization chỉ để thử.
- Production secrets/default secrets cần được đưa hoàn toàn ra environment variables và rotate.
- Frontend main chunk còn lớn; cần route-level code splitting khi tối ưu tiếp.
- Phase 5 và Phase 6 đã có source/UI runtime nhưng formal UAT chưa đóng; import sheet Tăng/Giảm hàng loạt từ workbook bất kỳ vẫn chưa triển khai.
- Phase 7 ngày phép tự động hiện không còn trong source active; chỉ làm lại khi có công thức nghiệp vụ chính thức.
- Phase 7 ứng viên thử việc đã có source schema/API/UI và UI runtime; còn thiếu UAT end-to-end bằng ứng viên giả.
- Cần test end-to-end HR/PWA trên nhiều thiết bị iOS/Android thật.
- Có orphan `booking_adminer` container được Docker Compose cảnh báo; chưa xóa vì không liên quan runtime chính và tránh thao tác phá hủy ngoài yêu cầu.

## File Quan Trọng Hiện Tại

- `backend/src/main/java/com/booking/system/service/AuthService.java`
- `backend/src/main/java/com/booking/system/service/AccountRegistrationService.java`
- `backend/src/main/java/com/booking/system/service/EmailTemplateService.java`
- `backend/src/main/java/com/booking/system/hr/importer/HrBaselineImportService.java`
- `backend/src/main/java/com/booking/system/hr/importer/HrBaselineWorkbookParser.java`
- `backend/src/main/java/com/booking/system/hr/api/HrManagementController.java`
- `backend/src/main/java/com/booking/system/hr/api/HrImportController.java`
- `backend/src/main/java/com/booking/system/hr/service/HrManagementService.java`
- `backend/src/main/java/com/booking/system/hr/service/HrWorkforceService.java`
- `backend/src/main/java/com/booking/system/hr/service/HrExcelExportService.java`
- `backend/src/main/java/com/booking/system/hr/service/HrProbationService.java`
- `backend/src/main/java/com/booking/system/hr/api/HrWorkforceController.java`
- `backend/src/main/java/com/booking/system/hr/api/HrProbationController.java`
- `backend/src/main/resources/db/migration/V2__add_hr_import_payload_retention.sql`
- `backend/src/main/resources/db/migration/V3__add_hr_probation_candidates.sql`
- `docs/HR_PHASE_4_MANAGER_UI.md`
- `docs/HR_PHASE_5_WORKFORCE_MONTHLY.md`
- `docs/HR_PHASE_6_EXCEL_EXPORT.md`
- `docs/HR_PHASE_7_PROBATION_CONTRACTS.md`
- `docs/HR_WORKFORCE_IMPORT_339.md`
- `backend/src/main/resources/hr/templates/probation-contract-template.docx`
- `frontend/src/api/hrProbationApi.js`
- `frontend/src/pages/hr/HrProbationCandidates.jsx`
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

1. Browser UAT: preview, điều chỉnh T6 sang T7 và export tháng/năm trên hồ sơ test.
2. Chạy reconciliation read-only dữ liệu thật nếu được phép; đối chiếu với TCHC, không tự sửa số liệu.
3. Phase 10: security/performance -> backup/restore -> rollout có kiểm soát.
4. Không triển khai kho giấy tờ, báo cáo nâng cao hoặc ngày phép trước khi Phase 8–10 ổn định.
6. Không tiếp tục bất kỳ Booking Phase 6–10 nào.
