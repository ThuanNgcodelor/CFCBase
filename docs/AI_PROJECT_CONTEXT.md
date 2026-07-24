# Ngữ Cảnh AI Cho BookingBase

Cập nhật: 2026-07-24

File này là context tiếng Việt cho AI agent. Code và config hiện tại luôn là `Source of Truth`. Giữ nguyên thuật ngữ kỹ thuật như `Frontend`, `Backend`, `JWT`, `DTO`, `PWA`, `Service Worker`, `WebSocket`, `STOMP`, `runtime cache`.

## Source Of Truth

1. Code và config hiện tại trong repository.
2. Schema/migration hiện tại nếu có.
3. `docs/CURRENT_WORK_STATUS.md`.
4. `docs/PROJECT_FLOW.md`.
5. `docs/PERFORMANCE_AUDIT.md`.
6. `docs/OPTIMIZATION_EXECUTION_PLAN.md`.

Docs chỉ là tham khảo. Nếu docs khác code, ưu tiên code.

## Mục Tiêu Hệ Thống

BookingBase là hệ thống booking nội bộ cho phòng họp và xe công ty. Repo hiện triển khai:

- Authentication chính bằng email/password, OTP register/forgot password và Admin approval cho tài khoản mới.
- Booking phòng họp và xe.
- Approval workflow.
- Dashboard.
- Notification database.
- WebSocket realtime.
- Email.
- Web Push/PWA.
- Profile update approval.
- Resource management cơ bản.
- Phân hệ HR độc lập cho `MANAGER`: baseline lịch sử đúng `T6-26 = 339`, hồ sơ/danh mục, Tăng/Giảm, snapshot tháng và plan/template cho ứng viên thử việc.

## Tech Stack Hiện Tại

Frontend:
- React 19 + Vite 8.
- React Router 7.
- Axios.
- `react-big-calendar`.
- `date-fns`.
- STOMP over SockJS.
- `vite-plugin-pwa` với custom Service Worker tại `frontend/src/sw.js`.

Backend:
- Spring Boot 4.0.0, Java 21 theo `pom.xml`.
- Spring Security + JWT.
- Spring Data JPA.
- MySQL.
- Redis cho refresh token và OTP.
- Java Mail.
- WebSocket/STOMP.
- Web Push/VAPID.
- Async notification/email/push event handling.

Infra/config:
- `docker-compose.yml`: MySQL + Redis; Adminer không thuộc production startup path.
- Production direction: frontend `dist` được embed vào Spring Boot jar.
- Cloudflare Tunnel trỏ web/API về backend port `8080`.
- Fedora/Linux là production chính với scripts trong `deployserver/linux/`; Windows scripts vẫn được giữ để tương thích.
- Systemd user timer `bookingbase-backup.timer` dump toàn bộ MySQL mỗi giờ, giữ 24 bản trong `backups/database/`.

## Sơ Đồ Thư Mục

Backend:
- `controller`: REST controllers và SPA fallback controller.
- `service`: business services.
- `repository`: JPA repositories.
- `entity`: JPA entities.
- `dto`: request/response DTOs.
- `event`: notification event và listener.
- `config`: Security, CORS, WebSocket, Web Push, async executor, seed data.
- `src/main/resources/application.yml`: config mặc định.
- `src/main/resources/application-prod.yml`: config profile `prod`.
- `src/test/java`: unit/service tests.

Frontend:
- `App.jsx`: routes và route guards.
- `main.jsx`: app entry và PWA registration.
- `api`: Axios clients.
- `pages`: screens.
- `layouts/DashboardLayout.jsx`: app shell, notification UI, PWA gate.
- `contexts/NotificationContext.jsx`: notification state và STOMP client.
- `hooks/usePushNotifications.js`: Web Push subscribe/unsubscribe.
- `sw.js`: custom Service Worker cho push, notification click, offline fallback.
- `vite.config.js`: Vite và PWA manifest/config.

## Roles Và Permission Model

Role hiện tại:
- `ADMIN`
- `MANAGER`
- `EMPLOYEE`

Quy tắc bảo mật cần giữ:
- Booking requester lấy từ `@AuthenticationPrincipal`.
- Approval approver lấy từ `@AuthenticationPrincipal`.
- Cancel canceller phải lấy từ `@AuthenticationPrincipal` khi chạm luồng cancel.
- Không tin `requesterId`, `approverId`, `cancellerId` từ request body.
- Approve cho `ADMIN` hoặc `MANAGER`; reject và cancel approved booking theo flow hiện tại chỉ `ADMIN`.
- Protected API phải trả 401 nếu không có token.
- Admin API phải trả 403 nếu user không đủ quyền.
- `/api/v1/hr/**` chỉ cho đúng `MANAGER` đang `ACTIVE`; `ADMIN` không tự động có quyền HR.
- Employee HR độc lập với User đăng nhập; chỉ actor audit được snapshot từ authenticated principal và không có foreign key sang `users`.

## Entities Chính

- `User`: email, fullName, password, avatarUrl, jobPosition, role, department, status và audit xét duyệt đăng ký.
- `Room`: name, location, capacity, equipment, imageUrl, status.
- `Vehicle`: licensePlate, vehicleType, seatCount, status.
- `BookingRoom`: room, requester, title, startTime, endTime, attendeeCount, note, status, cancel info.
- `BookingCar`: vehicle, requester, departure, destination, startTime, endTime, note, status, cancel info.
- `ApprovalStep`: approval action cho room hoặc car booking.
- `Notification`: recipient, sender, type, title, message/description, targetUrl, sourceType, sourceId, priority, read state.
- `PushSubscription`: user, endpoint, p256dh/auth keys, device info, active state.
- `ProfileUpdateRequest`: workflow duyệt thay đổi profile.
- `HrEmployee` cùng hồ sơ công việc/định danh/bảo hiểm/liên hệ: miền HR độc lập.
- `HrEmployeeMovement`: lịch sử baseline/Tăng/Giảm và trạng thái xử lý.
- `HrMonthlyRoster`/`HrMonthlyRosterItem`: snapshot nhân sự theo tháng không chứa PII/lương.
- `HrExcelImportBatch`/row/template và `HrAuditEvent`: staging, version template và audit HR.
- `HrProbationCandidate`/`HrProbationJobTemplate`/`HrProbationContract`: ứng viên thử việc, mẫu công việc và hợp đồng Word đã sinh; miền này đứng trước `HrEmployee DRAFT`.

## Sơ Đồ API Chính

Auth:
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/google`
- `POST /api/v1/auth/register/request-otp`
- `POST /api/v1/auth/register/verify`
- `POST /api/v1/auth/forgot-password/request-otp`
- `POST /api/v1/auth/forgot-password/reset`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

Booking:
- `POST /api/v1/bookings/rooms`
- `GET /api/v1/bookings/rooms`
- `POST /api/v1/bookings/rooms/{id}/cancel`
- `POST /api/v1/bookings/cars`
- `GET /api/v1/bookings/cars`
- `POST /api/v1/bookings/cars/{id}/cancel`

Approval:
- `POST /api/v1/approvals/rooms/{id}/approve`
- `POST /api/v1/approvals/rooms/{id}/reject`
- `POST /api/v1/approvals/cars/{id}/approve`
- `POST /api/v1/approvals/cars/{id}/reject`
- `GET /api/v1/approvals/rooms/{id}/steps`
- `GET /api/v1/approvals/cars/{id}/steps`

Notification/Push:
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/{id}/read`
- `POST /api/v1/notifications/read-all`
- `GET /api/v1/push/vapid-public-key`
- `POST /api/v1/push/subscriptions`
- `DELETE /api/v1/push/subscriptions`

Resource/User/Profile:
- `GET /api/v1/resources/rooms`
- `GET /api/v1/resources/cars`
- `GET /api/v1/users/me`
- `GET /api/v1/users/approvers`
- `GET /api/v1/users/registration-approvals`
- `GET /api/v1/users/registration-approvals/count`
- `PATCH /api/v1/users/{id}/approve-registration`
- `PATCH /api/v1/users/{id}/reject-registration`
- `GET /api/v1/profile-requests/...`

HR Manager:
- `GET/POST/PATCH/DELETE /api/v1/hr/employees...`
- `GET/POST/PATCH /api/v1/hr/departments|positions|working-conditions...`
- `POST /api/v1/hr/imports/baseline` và validate/confirm/rollback có guard.
- `POST /api/v1/hr/imports/workforce-snapshot/preview|confirm` cho artifact one-time 339.
- `GET/POST /api/v1/hr/movements...` và confirm/cancel/delete draft.
- `GET/POST /api/v1/hr/rosters...` và open/close/reopen/delete draft.
- `GET /api/v1/hr/audit`

## Trạng Thái Authentication

- Frontend dùng `authStorage.js` để đồng bộ token và user session.
- Access token mặc định 8 giờ; refresh token 90 ngày.
- Refresh token tách theo thiết bị/session: `refreshToken:{email}:{sessionId}`; key legacy vẫn được migrate.
- OTP register/forgot password dùng Redis TTL 5 phút.
- Register tạo user `PENDING_APPROVAL`; chỉ user `ACTIVE` được login hoặc refresh.
- Google Login đang ẩn; tài khoản Google mới không được tự tạo bỏ qua OTP/Admin approval.
- Login flow/profile flow không nên thay đổi nếu task không yêu cầu.

## Tóm Tắt Luồng Booking

Tạo booking:
1. User chọn resource, thời gian và nhập thông tin.
2. Frontend gọi room/car booking API.
3. Backend lấy requester từ authenticated principal.
4. Backend validate `startTime < endTime`.
5. Backend lock room/vehicle trước khi overlap check.
6. Overlap logic: existing start < new end và existing end > new start.
7. Blocking statuses: `PENDING`, `APPROVED`.
8. Booking tạo trạng thái `PENDING`.
9. Sau commit, notification/email/push được dispatch async.

Approval:
1. Approver mở approval/detail.
2. Approver approve hoặc reject.
3. Backend lấy approver từ authenticated principal.
4. Backend enforce role `ADMIN` hoặc `MANAGER`.
5. Lưu `ApprovalStep` với `reason`.
6. Cập nhật booking status.
7. Dispatch notification/email/push sau commit.

## Tóm Tắt Luồng Calendar

- Calendar dùng range-based fetch theo month/week/day.
- Có `AbortController` và request sequence guard để tránh stale response.
- Mapping/filter event dùng `useMemo`.
- Khi chọn room/car, API nhận `roomId` hoặc `vehicleId`.
- Past events vẫn hiển thị như lịch sử và có màu riêng.
- Calendar không nên phụ thuộc notification list để tránh re-render không liên quan.

## Tóm Tắt Luồng Notification

- Database notification là `Source of Truth`.
- WebSocket chỉ dùng realtime delivery.
- Email là kênh độc lập/fallback.
- Web Push gửi cho active subscriptions.
- Push failure không được rollback booking.
- Permanent push failures 403/404/410 không retry và deactivate subscription.
- Notification context đã tách unread count khỏi notification list.
- Notification click dựa trên `type/sourceType/sourceId` và deep-link đúng booking/profile/account approval.
- Account registration notification được lưu cho Admin và push tới active Admin subscriptions.
- Người chưa từng login chưa có Push Subscription; trạng thái đăng ký của họ dùng UI/email.

## Tóm Tắt Email

- Mọi email dùng chung responsive `EmailTemplateService`.
- Link CTA lấy từ `app.frontend-url` / `${FRONTEND_URL}`.
- Email booking có resource, địa điểm/hành trình, ngày, giờ bắt đầu-kết thúc và trạng thái.
- OTP register/forgot cùng format; UI nhắc kiểm tra Spam/Thư rác.

## Tóm Tắt Phân Hệ HR

- `Employee` và danh mục HR tách hoàn toàn khỏi `User`, `Department` legacy và booking.
- Baseline chuẩn bắt đầu ở `T6-26`; số liệu lịch sử đúng là 339 Employee `ACTIVE`, 339 `INITIAL_LOAD` và roster T6 `CLOSED`.
- Artifact one-time `workforce-baseline-339-2026.xlsx` khóa SHA-256 `e35f22c83f5dacb542c7b3cff76238fcbaf8ac22f7e85b786d62d2c1de6cf6f7`: chỉ import khi HR trống và tạo một baseline T6 duy nhất.
- Flow không tự tạo Tăng/Giảm hoặc `T7-26`; hậu điều kiện là 339 active/339 lịch sử. Không upload trực tiếp `Baseline-value-339-2026.xlsx`.
- G083 để trống CCCD do số trong nguồn bị lặp; phải xác minh giấy tờ thật sau import.
- T6 từ import là bất biến. Tăng/Giảm xác nhận muộn không sửa T6 mà đi vào kỳ kế tiếp chưa chốt.
- Tăng: Employee `DRAFT -> ACTIVE`; Giảm: Employee `ACTIVE -> INACTIVE` và bắt buộc lý do.
- Movement dùng idempotency key, lock, `rowVersion`, actor từ principal; `CONFIRMED` không sửa/xóa.
- Roster tạo tuần tự `DRAFT -> OPEN -> CLOSED`; close dựng lại item và checksum. Reopen có lý do, không áp dụng cho baseline/kỳ exported/kỳ đã có downstream.
- Hard-delete chỉ cho dữ liệu `DRAFT` tạo tay chưa có reference.
- HR detail trả đầy đủ CCCD/CMND, BHXH/BHYT, liên hệ và lương/phụ cấp cho `MANAGER`; roster/audit metadata vẫn không sao chép các giá trị nhạy cảm này. Export Excel Phase 6 có thể join lại Employee để xuất đúng template đầy đủ cho `MANAGER`.
- Transition 339 là flow khóa cứng theo file/kỳ/chênh lệch, không phải generic bulk import/export của Phase 6. Phase 7 ngày phép tự động đã được gỡ/defer ngày 2026-07-24; Phase 8 đơn nghỉ vẫn chưa thuộc flow hiện tại.
- Phase 7 là ứng viên thử việc và hợp đồng Word: `Ứng viên thử việc -> hợp đồng thử việc -> đạt -> HrEmployee DRAFT -> Tăng nhân sự -> ACTIVE`. Source đã có Flyway V3, API `/api/v1/hr/probation/**`, UI `/manager/hr/probation` và template backend `backend/src/main/resources/hr/templates/probation-contract-template.docx`; chưa deploy/UAT runtime.

## Trạng Thái PWA Hiện Tại

- Custom Service Worker tại `frontend/src/sw.js`.
- Có push event handler và notification click handler.
- `NAVIGATE` listener nằm ở React global component.
- Có offline fallback cho navigation.
- Không runtime-cache dynamic booking/API responses.
- Android/iOS PWA có required notification gate sau login.
- Cần test thật trên Android/iOS installed PWA.

## Trạng Thái Runtime Production

- `deployserver/linux/build-prod.sh`: build frontend, package backend JAR và smoke-test Web Push.
- `deployserver/linux/run.sh`: start DB/Redis, backend systemd unit, health-check, rồi start tunnel unit.
- `deployserver/linux/stop-prod.sh`: stop production Linux.
- Spring Boot serve SPA static files từ jar.
- Cloudflare web/API domain đều trỏ backend `8080`.
- Java runtime Linux giới hạn RAM mặc định bằng `-Xms256m -Xmx768m`.
- Cloudflare Tunnel đang dùng named tunnel `bookingbase`.

## Trạng Thái Schema Quan Trọng

- `users.status` là `VARCHAR(32)`, không còn MySQL ENUM cũ.
- `notifications.type` là `VARCHAR(64)` và `notifications.source_type` là `VARCHAR(64)`.
- Flyway quản lý schema HR: V1 tạo 15 bảng `hr_*`, V2 retention payload import. Hibernate schema filter không được tự sửa bảng HR.
- Bảng legacy được Flyway baseline version `0` theo quy trình opt-in sau backup; migration HR không alter/drop dữ liệu booking hiện hữu.

## Trạng Thái Verification

Đã verify gần đây:
- `npm run build`: pass, gồm PWA service worker.
- `npm run lint`: pass, còn warning cũ ở `CustomDateHeader.jsx`.
- `git diff --check`: pass, chỉ có warning LF/CRLF Windows.

Backend test:
- Phase 1–5 có 80 test regression đạt, 0 failure/error và 1 skip theo môi trường; JDK 25 cần ByteBuddy Java agent cho Mockito.
- Case import khóa `T6-26 = 339`, 339 active/339 lịch sử và không có `T7-26` tự sinh.
- Runtime production và database người dùng chưa được agent UAT lại sau thay đổi Phase 5.

## Quy Tắc Bắt Buộc

- Code hiện tại là `Source of Truth`.
- Không refactor ngoài task.
- Không đổi login/profile flow nếu task không yêu cầu.
- Không log hoặc commit secrets.
- Không đưa mail/push vào booking transaction.
- Không runtime-cache booking API nếu chưa có invalidation design.
- Không tin identity từ request body.
- Luôn chạy `npm.cmd run build` và `npm.cmd run lint` khi đổi frontend/routing/PWA.
- Luôn cố chạy `.\mvnw.cmd test` khi đổi backend; nếu fail do môi trường, báo rõ.
