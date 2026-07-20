# Audit Performance, Security Và Production Cho BookingBase

Cập nhật: 2026-07-20

File này là audit tiếng Việt, dùng để định hướng tối ưu. Giữ nguyên thuật ngữ: `P0`, `P1`, `JWT`, `DTO`, `WebSocket`, `PWA`, `Service Worker`, `runtime cache`, `EXPLAIN`, `React Profiler`.

## 1. Tóm Tắt Điều Hành

BookingBase đã có đủ các module chính: auth, booking, approval, calendar, notification, WebSocket, email, Web Push/PWA và production scripts. Các rủi ro lớn nhất hiện tại:

- Chưa có migration framework; các ENUM MySQL cũ từng chặn UserStatus/NotificationType mới.
- Production secrets vẫn cần đưa ra environment variables.
- Frontend bundle còn warning chunk lớn.
- PWA push cần test trên thiết bị thật.
- Chưa có Playwright mobile screenshots.

## 2. Baseline Hiện Tại

Frontend:
- `npm.cmd run build`: pass.
- `npm.cmd run lint`: pass, còn warning cũ ở `CustomDateHeader.jsx`.
- Main chunk khoảng 773 KB minified.
- `inlineDynamicImports` warning đã được xử lý bằng `rolldownOptions.output.codeSplitting = false` cho Service Worker build.

Backend:
- 45 tests pass với ByteBuddy Java agent trên JDK hiện tại.
- Production executable JAR Web Push smoke test pass.

Runtime:
- Fedora/Linux là production chính với scripts trong `deployserver/linux/`.
- Backend và tunnel chạy bằng transient user systemd units.
- Spring Boot serve frontend static assets từ JAR.
- Local/public health check đều HTTP 200 sau deploy 2026-07-20.

## 3. Trạng Thái Code So Với Mục Tiêu

Đã làm:
- Không tin `requesterId/approverId` từ body cho booking/approval.
- Enforce approver role; reject/cancel approved booking chỉ cho Admin theo flow hiện tại.
- Chuẩn hóa `reason/note`.
- Calendar có stale request guard và memoization.
- WebSocket provider value memoized.
- Unread count tách khỏi notification list.
- Web Push retry bounded.
- Bounded async executor.
- Global Service Worker `NAVIGATE` listener.
- Offline fallback không runtime-cache booking API.
- Production script nhẹ RAM hơn.
- Register OTP -> `PENDING_APPROVAL` -> Admin approval đã triển khai.
- Refresh token 90 ngày tách theo device/session.
- Notification deep link dựa trên type/source thay vì title.
- Email dùng shared responsive template; booking mail có ngày giờ.
- Admin booking history có pagination/filter/sort và cancel approved booking.

Chưa đủ hoặc cần verify:
- Dashboard client/admin scope cần tiếp tục hardening nếu task liên quan.
- DB migration framework chưa có; hiện dùng SQL deploy thủ công cho enum/index quan trọng.

## 4. Điểm Đang Làm Tốt

- Notification được tách khỏi transaction bằng event async.
- WebSocket chỉ dùng realtime delivery, DB notification là `Source of Truth`.
- Calendar không load all-bookings khi đã có range fetch.
- PWA không runtime-cache dynamic booking/API responses.
- Production không còn cần Node/Vite preview.
- Có rollback JAR `.previous`, staging build và Linux stop/run scripts.
- Email URL configurable bằng `${FRONTEND_URL}`.
- Migration notification đã verify row count và checksum không đổi.

## 5. Backlog P0/P1

P0:
- Đưa secrets production ra environment variables.
- Thêm Flyway/Liquibase trước thay đổi schema tiếp theo.

P1:
- Tiếp tục audit dashboard identity/API authorization.
- Test WebSocket/STOMP CONNECT JWT.
- Test PWA push trên Android/iOS.
- Thêm integration test register -> Admin notification/push -> approve -> login.
- Add Playwright mobile screenshots cho Calendar/PWA gate.

## 6. Findings P2/P3

P2:
- Frontend chunk lớn, cân nhắc lazy route/code splitting.
- DB indexes cần đo bằng `EXPLAIN` với data thực.

P3:
- Có thể thêm smoke scripts cho production URLs.
- Có thể thêm structured logging cho notification/mail/push.
- Có thể thêm metrics qua Actuator.

## 7. Lộ Trình

### Giai Đoạn 0 - Baseline

- Giữ `CURRENT_WORK_STATUS.md` cập nhật.
- Ghi lại lệnh test/build đã chạy.
- Không dựa vào docs cũ nếu khác code.

### Giai Đoạn 1 - Security

- Identity từ `@AuthenticationPrincipal`.
- Role enforcement cho admin/approver.
- 401/403 đúng cho protected/admin APIs.
- Không log secrets.

### Giai Đoạn 2 - Calendar / Frontend Performance

- Range-based fetch.
- Abort/stale request guard.
- `useMemo` cho mapping/filter.
- Responsive/mobile validation.
- Không để notification update kéo Calendar render.

### Giai Đoạn 3 - Backend / DB

- DTO/projection cho API lớn.
- Pagination/range filter.
- Index overlap/status/time nếu đo thấy cần.
- Migration framework nếu bắt đầu quản lý schema nghiêm túc.

### Giai Đoạn 4 - Notification / Email / Push

- Bounded executor.
- Push retry/backoff bounded.
- Notification idempotency.
- Email URL từ config.

### Giai Đoạn 5 - PWA

- Global `NAVIGATE`.
- Offline fallback.
- Không runtime-cache booking API.
- Test Android/iOS installed PWA.

### Giai Đoạn 6 - Deploy

- Production jar serve SPA.
- Docker RAM constraints.
- Cloudflare tunnel trỏ đúng backend.
- Scripts rõ: build/start/stop.

### Giai Đoạn 7 - Tests / Monitoring

- Duy trì ByteBuddy agent hoặc JDK tương thích cho Mockito tests.
- Add smoke tests.
- Add Playwright mobile screenshots.
- Add logging/metrics khi cần.

## 8. File Theo Giai Đoạn

Security:
- `ApprovalController.java`
- `BookingRoomController.java`
- `BookingCarController.java`
- `ApprovalService.java`
- booking services
- relevant tests

Calendar:
- `RoomBooking.jsx`
- `CarBooking.jsx`
- calendar components/hooks
- booking/resource APIs

Notification/PWA:
- `NotificationContext.jsx`
- `NotificationContextCore.js`
- `useNotificationCenter.js`
- `DashboardLayout.jsx`
- `usePushNotifications.js`
- `sw.js`
- `PushService.java`
- `AsyncConfig.java`

Production:
- `deployserver/linux/run.sh`
- `deployserver/linux/build-prod.sh`
- `deployserver/linux/stop-prod.sh`
- `docker-compose.yml`
- `cloudflared-config.yml`
- `backend/pom.xml`
- `application-prod.yml`
- `SpaForwardController.java`
- `SecurityConfig.java`

## 9. Ma Trận Test

Frontend:
- `npm.cmd run lint`
- `npm.cmd run build`
- Manual: login, rooms calendar, cars calendar, notifications, PWA gate.

Backend:
- `./mvnw test` với ByteBuddy Java agent khi JDK không cho Mockito self-attach.

Production:
- `deployserver/linux/build-prod.sh --build-only`
- `deployserver/linux/run.sh`
- Verify:
  - `http://localhost:8080`
  - `https://cfcbooking.io.vn`
  - `https://api.cfcbooking.io.vn/api/v1/...`

Mobile/PWA:
- Android install + push.
- iOS Add to Home Screen + push nếu OS hỗ trợ.
- Notification click open/closed app.
- Offline navigation fallback.

## 10. Baseline Và Target Metrics

Frontend:
- Build pass.
- Lint pass.
- Main chunk cần giảm nếu bắt đầu thấy load chậm.
- Calendar không re-render vì notification list không liên quan.

Backend:
- Booking create p95 mục tiêu < 500 ms, không tính async notification.
- Overlap query p95 mục tiêu < 50 ms với data đủ lớn.
- Backend startup local mục tiêu < 30 s.

Docker/RAM:
- Java production Linux: `-Xms256m -Xmx768m`.
- Docker chỉ start `db` + `redis` trong production.
- Adminer không start mặc định.

## 11. Rủi Ro Và Rollback

- Security principal changes: giữ DTO field cũ nhưng backend ignore để backward compatibility.
- Production jar serve SPA: rollback bằng cách quay lại chạy frontend preview riêng nếu cần.
- Docker RAM constraints: rollback command MySQL/Redis nếu DB workload thật cần RAM hơn.
- Push retry: disable hoặc hạ retry count bằng config nếu gây spam.
- PWA gate: nếu user bị block do thiết bị không hỗ trợ, cần policy rõ cho bypass/admin.

## 12. Lệnh / Ghi Chú

Lệnh đã biết:
- `npm run build`
- `npm run lint`
- `./mvnw test`
- `deployserver/linux/build-prod.sh --build-only`
- `deployserver/linux/run.sh`
- `deployserver/linux/stop-prod.sh`

Ghi chú:
- `hs_err_pid*.log` và `replay_pid*.log` là JVM crash/debug logs, không commit.
- `.gitignore` đã ignore `*.log`.

## 13. Tác Vụ Triển Khai Đầu Tiên Tiếp Theo

Ưu tiên tiếp theo là quản lý schema và kiểm thử tích hợp:

1. Thêm Flyway/Liquibase, đưa các ALTER thủ công thành versioned migration.
2. Thêm integration test register -> Admin notification/push -> approve -> login.
3. Test PWA push thật trên iOS/Android khi app mở và đóng.
4. Route-level code splitting để giảm bundle frontend.
