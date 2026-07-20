# Kế Hoạch Thực Thi Tối Ưu BookingBase

Cập nhật: 2026-07-20

File này là kế hoạch tối ưu bằng tiếng Việt. Giữ nguyên thuật ngữ kỹ thuật: `JWT`, `DTO`, `PWA`, `WebSocket`, `Service Worker`, `runtime cache`, `React Profiler`, `EXPLAIN`, `rollback`.

## Giai Đoạn 0 - Baseline Và Context

Mục tiêu:
- Luôn đọc `CURRENT_WORK_STATUS.md` trước.
- Code/config là `Source of Truth`.
- Không làm theo docs cũ nếu khác code.
- Ghi lại test/build đã chạy.

Checklist:
- `npm.cmd run lint`
- `npm.cmd run build`
- `./mvnw test` với ByteBuddy agent nếu JDK không cho Mockito self-attach.
- `git diff --check`

## Giai Đoạn 1 - Production Blockers Và Security

### Tác Vụ 1.1 - Requester Từ JWT

Mục tiêu:
- Booking requester lấy từ authenticated principal.
- Backend ignore `requesterId` trong request body.
- Giữ field cũ tạm thời để backward compatibility.

File liên quan:
- `BookingRoomController.java`
- `BookingCarController.java`
- `BookingRoomService.java`
- `BookingCarService.java`
- booking request DTOs
- service tests

Đã xong:
- Đã triển khai cho booking create.
- Đã có test chống giả mạo requester.

### Tác Vụ 1.2 - Approver/Canceller Từ JWT

Mục tiêu:
- Approval approver lấy từ authenticated principal.
- Reject reason dùng `reason`, legacy `note` vẫn là alias.
- Approve cho `ADMIN` hoặc `MANAGER`; reject/cancel approved booking chỉ cho `ADMIN` theo flow hiện tại.
- Cancel flow nếu chạm vào phải lấy canceller từ principal.

Đã xong:
- Approval/reject đã lấy approver từ principal.
- `reason/note` đã chuẩn hóa.
- Đã thêm approval steps response với approver thật.

Chưa chốt:
- Admin cancel approved booking đã dùng authenticated principal và xác nhận không cần lý do; tiếp tục giữ test bảo mật khi sửa flow.

### Tác Vụ 1.3 - Dashboard/Admin API Lockdown

Mục tiêu:
- Admin API trả 403 nếu user không đủ quyền.
- Dashboard user data không tin `userId` từ route nếu không admin-authorized.

Trạng thái:
- Chưa phải task đã hoàn tất trong phase gần đây.
- Cần làm nếu tiếp tục hardening security.

### Tác Vụ 1.4 - Secrets Và Env Contract

Mục tiêu:
- JWT/mail/VAPID/DB secrets lấy từ environment variables.
- Không commit real secrets.
- Có `.env.example` nếu cần.

Trạng thái:
- Vẫn là risk cần xử lý trước production thật.

### Tác Vụ 1.5 - Timezone Baseline

Mục tiêu:
- Đồng nhất timezone frontend/backend/DB.
- Không convert historical data nếu chưa có migration plan.

Trạng thái:
- Chưa làm sâu.

## Giai Đoạn 2 - Calendar Và Frontend Performance

### Tác Vụ 2.1 - Route Code Splitting

Mục tiêu:
- Giảm main chunk.
- Lazy load các route lớn.

Trạng thái:
- Chưa làm.
- Frontend vẫn warning main chunk khoảng 773 KB.

### Tác Vụ 2.2 - Calendar Stale Request Guard

Đã xong:
- `AbortController`.
- Request sequence guard.
- Range-based fetch theo month/week/day.

File:
- `RoomBooking.jsx`
- `CarBooking.jsx`

### Tác Vụ 2.3 - Memoize Calendar Event Filtering Và API Resource Filter

Đã xong:
- `useMemo` cho mapping/filter.
- Gửi `roomId` hoặc `vehicleId` khi chọn resource.
- Responsive hook cho resize/orientation.
- Past events có visual riêng.

### Tác Vụ 2.4 - Replace All-Bookings Admin/Detail Flows

Mục tiêu:
- Tránh load toàn bộ booking nếu data lớn.
- Dùng detail endpoint hoặc range/pagination.

Trạng thái:
- Admin approval history đã có pagination/filter/sort.
- Tiếp tục tránh all-bookings load ở các màn hình khác nếu data tăng.

## Giai Đoạn 3 - Backend Và Database

### Tác Vụ 3.1 - Migration Framework

Mục tiêu:
- Dùng migration framework thay vì chỉ `ddl-auto`.

Trạng thái:
- Chưa có framework.
- Đã áp dụng thủ công và bảo toàn dữ liệu cho `users.status VARCHAR(32)`, `notifications.type VARCHAR(64)` và `notifications.source_type VARCHAR(64)`.
- Migration tiếp theo phải được version hóa thay vì tiếp tục phụ thuộc `ddl-auto`.

### Tác Vụ 3.2 - Booking Overlap Indexes

Mục tiêu:
- Add indexes cho resource/status/time.
- Verify bằng `EXPLAIN`.

Trạng thái:
- Chưa làm vì cần data/DB thực.

### Tác Vụ 3.3 - DTO/Projection Và Pagination

Mục tiêu:
- Không serialize entity trực tiếp cho API lớn.
- Pagination cho list lớn.

Trạng thái:
- Một số DTO đã có.
- Cần tiếp tục nếu API/list phình to.

## Giai Đoạn 4 - Notification, Email, Push

### Tác Vụ 4.1 - Configurable Email Frontend URL

Mục tiêu:
- Email link không hard-code domain.
- Dùng config/env như `app.frontend-url`.

Trạng thái:
- Đã xong: `app.frontend-url` lấy từ `${FRONTEND_URL}`.
- Tất cả mail dùng shared responsive template; booking mail có ngày giờ.

### Tác Vụ 4.2 - Bounded Async Executor

Đã xong:
- Thêm `AsyncConfig`.
- `taskExecutor` bounded.
- Có queue capacity và `CallerRunsPolicy`.

### Tác Vụ 4.3 - Push Retry/Backoff

Đã xong:
- Retry giới hạn cho network/408/429/5xx.
- 403/404/410 deactivate subscription và không retry.
- Có test `PushServiceTest`.

### Tác Vụ 4.4 - Notification Idempotency

Mục tiêu:
- Không duplicate notification theo sourceType/sourceId/type.

Trạng thái:
- Một phần đã có trong `NotificationService`.
- Cần đo/test thêm nếu thấy duplicate.

### Tác Vụ 4.5 - Registration Notification Và Deep Link

Đã xong:
- Account registration events được lưu cho Admin và push tới active Admin subscriptions.
- Notification click dùng `type/sourceType/sourceId` cho booking/profile/account routes.
- `notifications.type` không còn bị MySQL ENUM cũ chặn.

Cần test thêm:
- End-to-end trên iOS/Android thật với Admin PWA đã subscribe.
- Applicant chưa từng login chỉ nhận UI/email vì chưa có Push Subscription.

## Giai Đoạn 5 - PWA Android/iOS

### Tác Vụ 5.1 - Global Service Worker Navigate Listener

Đã xong:
- Thêm `ServiceWorkerNavigateListener`.
- Gắn global trong `App`.
- Không để listener chỉ nằm trong protected layout.

### Tác Vụ 5.2 - Offline Fallback Without Dynamic Booking Cache

Đã xong:
- Thêm `offline.html`.
- Service Worker chỉ fallback cho navigation.
- Không runtime-cache booking/API responses.

### Tác Vụ 5.3 - Android/iOS Checklist

Mục tiêu:
- Test install PWA.
- Test push khi app mở/đóng.
- Test notification click.
- Test required notification gate.
- Test safe-area/mobile layout.

Trạng thái:
- Chưa test thiết bị thật.
- Chưa có Playwright mobile screenshots.

## Giai Đoạn 6 - Docker/Deploy Hardening

### Tác Vụ 6.1 - Production Runtime Scripts

Đã xong:
- `deployserver/linux/build-prod.sh` có staging, previous JAR và Web Push smoke test.
- `deployserver/linux/run.sh` có backend health-check trước khi start tunnel.
- `deployserver/linux/stop-prod.sh`.
- Windows scripts vẫn được giữ để tương thích.
- Java có RAM limit.
- Docker chỉ start `db` + `redis`.

### Tác Vụ 6.2 - SPA Fallback Và Cloudflare

Đã xong:
- Spring Boot package frontend `dist` vào jar.
- `SpaForwardController` forward deep links về `index.html`.
- `cloudflared-config.yml` trỏ web/API về backend `8080`.
- `application-prod.yml` có compression và limits nhẹ hơn.

## Giai Đoạn 7 - Tests, Monitoring, Logging

Mục tiêu:
- Duy trì backend tests với JDK/Mockito agent tương thích.
- Add smoke tests cho production URL.
- Add Playwright mobile screenshots.
- Add logging/metrics nếu cần.

Trạng thái hiện tại:
- Frontend lint/build pass.
- Backend 45 tests pass với ByteBuddy Java agent.
- Production JAR Web Push smoke test và local/public HTTP health check pass.

## Ưu Tiên Tiếp Theo

1. Thêm Flyway/Liquibase và đưa migration `users.status`, `notifications.type/source_type` vào version control.
2. Thêm integration test register -> Admin notification/push -> approve -> login.
3. Test PWA notification click trên thiết bị iOS/Android thật.
4. Tách route frontend để giảm bundle.
5. Đưa secrets production hoàn toàn ra environment và rotate.
