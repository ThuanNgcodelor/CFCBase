## 1. Tổng quan kiến trúc hiện tại

### Backend

Dự án backend nằm trong `backend/`, package chính:

```text
com.booking.system
```

Các nhóm chính đã xác định:

| Nhóm | File/folder liên quan | Vai trò |
|---|---|---|
| Application entry | `backend/src/main/java/com/booking/system/BookingSystemApplication.java` | Khởi động Spring Boot, có bật async/scheduling nếu đã cấu hình trong file này. |
| Config | `config/SecurityConfig.java`, `WebConfig.java`, `WebPushConfig.java`, `WebSocketConfig.java`, `DataSeeder.java` | Security/JWT, CORS, Web Push VAPID client, WebSocket/STOMP, seed dữ liệu. |
| Controller | `controller/AuthController.java`, `BookingRoomController.java`, `BookingCarController.java`, `ApprovalController.java`, `NotificationController.java`, `PushSubscriptionController.java`, `ResourceController.java`, `DashboardController.java`, `UserController.java`, `DepartmentController.java`, `ProfileUpdateRequestController.java` | API REST cho auth, booking, approval, notification, push subscription, resource, dashboard, user/profile. |
| Service | `BookingRoomService.java`, `BookingCarService.java`, `ApprovalService.java`, `NotificationService.java`, `EmailService.java`, `PushService.java`, `PushSubscriptionService.java`, `AuthService.java`, `DashboardService.java` | Xử lý nghiệp vụ chính. |
| Entity | `BookingRoom.java`, `BookingCar.java`, `ApprovalStep.java`, `Notification.java`, `PushSubscription.java`, `User.java`, `Room.java`, `Vehicle.java`, `VehicleType.java`, `Department.java`, `ProfileUpdateRequest.java` | Mapping database. |
| Repository | `BookingRoomRepository.java`, `BookingCarRepository.java`, `NotificationRepository.java`, `PushSubscriptionRepository.java`, `RoomRepository.java`, `VehicleRepository.java`, `UserRepository.java`, ... | Truy vấn JPA. |
| Security/JWT | `security/JwtAuthFilter.java`, `security/JwtUtils.java`, `config/SecurityConfig.java` | Xác thực request bằng JWT. |
| Event notification | `event/NotificationEvent.java`, `event/NotificationEventListener.java` | Tách notification/mail/push khỏi transaction booking bằng event sau commit. |

### Frontend

Dự án frontend nằm trong `frontend/`, React + Vite.

| Nhóm | File/folder liên quan | Vai trò |
|---|---|---|
| Entry | `frontend/src/main.jsx`, `frontend/src/App.jsx` | Khởi tạo React app, router/provider chính. |
| API client | `frontend/src/api/baseApi.js` | Axios base client, interceptor JWT/error. |
| API module | `bookingApi.js`, `approvalApi.js`, `notificationApi.js`, `pushApi.js`, `authApi.js`, `resourceApi.js`, `dashboardApi.js`, `userApi.js`, `profileRequestApi.js` | Gọi backend REST. |
| Layout | `frontend/src/layouts/DashboardLayout.jsx` | Shell/layout chính. |
| Pages booking/calendar | `RoomBooking.jsx`, `CarBooking.jsx`, `CreateRoomBooking.jsx`, `CreateCarBooking.jsx`, `BookingDetail.jsx` | UI lịch phòng/xe, tạo booking, xem chi tiết. |
| Approval | `AdminApprovals.jsx`, `AdminProfileApprovals.jsx`, `AdminProfileApprovalDetail.jsx` | UI duyệt booking/profile. |
| Notification | `Notifications.jsx`, `contexts/NotificationContext.jsx`, `components/PushNotificationSettings.jsx` | Notification list, WebSocket realtime, push setting. |
| Calendar component | `components/calendar/CustomToolbar.jsx`, `CustomEvent.jsx`, `CustomMonthEvent.jsx`, `CustomDateHeader.jsx`, `bookingCalendar.css` | Tùy biến `react-big-calendar`. |
| PWA/SW | `frontend/src/sw.js`, `frontend/vite.config.js`, manifest cấu hình qua Vite PWA nếu có | Service Worker, precache, push notification click/deep link. |
| Utils | `utils/dateTime.js`, `utils/notification.js`, `utils/appBadge.js` | Chuẩn hóa datetime, notification, app badge. |

---

## 2. Flow booking/mail/push/calendar hiện tại

### 2.1 Booking room flow

```text
User tạo booking phòng
→ frontend/src/pages/CreateRoomBooking.jsx
→ bookingApi.createRoomBooking()
→ POST /api/v1/bookings/rooms
→ BookingRoomController.createBooking()
→ BookingRoomService.createBooking()
→ BookingRoomRepository.save(BookingRoom)
→ publish NotificationEvent cho requester và admin
→ AFTER_COMMIT NotificationEventListener
→ NotificationService.createNotification()
→ NotificationService.pushRealtime()
→ EmailService nếu event có EmailInstruction
→ PushService nếu user có PushSubscription active
→ frontend quay lại /rooms
→ RoomBooking.jsx load lại danh sách khi mount
```

File cụ thể:

| Bước | Vị trí |
|---|---|
| Frontend submit | `frontend/src/pages/CreateRoomBooking.jsx` |
| API function | `frontend/src/api/bookingApi.js` - `createRoomBooking()` gọi `POST /bookings/rooms` |
| Controller | `backend/src/main/java/com/booking/system/controller/BookingRoomController.java` |
| Service | `backend/src/main/java/com/booking/system/service/BookingRoomService.java` |
| Entity ghi DB | `backend/src/main/java/com/booking/system/entity/BookingRoom.java` |
| Repository | `BookingRoomRepository.save()` |
| Check trùng lịch | `BookingRoomRepository.countOverlappingBookings()` |
| Notification event | `BookingRoomService.createBooking()` publish `NotificationEvent` |
| Persist notification | `NotificationEventListener.handle()` → `NotificationService.createNotification()` |
| Realtime | `NotificationService.pushRealtime()` qua `SimpMessagingTemplate` |
| Mail admin | `NotificationEventListener.sendEmailIfConfigured()` → `EmailService.sendBookingCreatedEmailToAdmin()` |
| Push | `NotificationEventListener.sendPushIfSubscribed()` → `PushService.sendPush()` |

Điểm tốt:
- `BookingRoomService.createBooking()` có kiểm tra `startTime < endTime`.
- Có dùng lock resource qua `roomRepository.findByIdWithLock(request.getRoomId())`.
- Có kiểm tra overlap với status `PENDING`, `APPROVED`.
- Notification/mail/push chạy sau commit qua `@TransactionalEventListener(phase = AFTER_COMMIT)` trong `NotificationEventListener`.

Rủi ro:
- `BookingRoomService.getAllBookings()` trả `bookingRoomRepository.findAll()` không phân trang/range.
- Calendar frontend hiện gọi `bookingApi.getRoomBookings()` không truyền range ngày.
- Nếu dữ liệu booking lớn, calendar sẽ load toàn bộ booking.

### 2.2 Booking car flow

```text
User tạo booking xe
→ frontend/src/pages/CreateCarBooking.jsx
→ bookingApi.createCarBooking()
→ POST /api/v1/bookings/cars
→ BookingCarController.createBooking()
→ BookingCarService.createBooking()
→ BookingCarRepository.save(BookingCar)
→ publish NotificationEvent cho requester và admin
→ AFTER_COMMIT NotificationEventListener
→ DB notification + WebSocket + email + web push
→ frontend navigate('/cars')
→ CarBooking.jsx load lại dữ liệu khi mount
```

File cụ thể:

| Bước | Vị trí |
|---|---|
| Frontend submit | `frontend/src/pages/CreateCarBooking.jsx` |
| API function | `frontend/src/api/bookingApi.js` - `createCarBooking()` gọi `POST /bookings/cars` |
| Controller | `backend/src/main/java/com/booking/system/controller/BookingCarController.java` |
| Service | `backend/src/main/java/com/booking/system/service/BookingCarService.java` |
| Entity ghi DB | `BookingCar.java` |
| Repository | `BookingCarRepository.save()` |
| Check trùng lịch | `BookingCarRepository.countOverlappingBookings()` |
| Notification | `NotificationEventListener` + `NotificationService` |
| Mail | `EmailService.sendBookingCreatedEmailToAdmin()` |
| Push | `PushService.sendPush()` |

Rủi ro cụ thể:
- Trong `BookingCarService.createBooking()`, booking xe set `departure`, `destination`, `startTime`, `endTime`, `note`, `status`, nhưng từ output đã đọc chưa thấy set `title`. Trong `CarBooking.jsx`, calendar map `title: b.title`, nên event xe có thể thiếu title nếu entity/service không tự suy ra title. Cần kiểm tra đầy đủ `BookingCar.java` hoặc phần cuối service nếu chưa hiện hết vì output bị truncate.

### 2.3 Approval flow

```text
Admin/Manager thao tác duyệt/từ chối
→ frontend AdminApprovals.jsx / BookingDetail.jsx
→ approvalApi
→ POST /api/v1/approvals/rooms/{id}/approve hoặc reject
→ POST /api/v1/approvals/cars/{id}/approve hoặc reject
→ ApprovalController
→ ApprovalService
→ update BookingRoom/BookingCar status
→ tạo ApprovalStep nếu có
→ publish NotificationEvent
→ NotificationEventListener AFTER_COMMIT
→ notification DB + realtime + email + push
```

File liên quan:
- Frontend: `frontend/src/pages/AdminApprovals.jsx`, `frontend/src/pages/BookingDetail.jsx`, `frontend/src/api/approvalApi.js`.
- Backend: `ApprovalController.java`, `ApprovalService.java`, `ApprovalStep.java`, `ApprovalStepRepository.java`.
- Notification: `NotificationEventListener.java`, `NotificationService.java`, `EmailService.java`, `PushService.java`.

### 2.4 Mail flow

```text
Business service publish NotificationEvent có EmailInstruction
→ Transaction booking/approval commit thành công
→ NotificationEventListener.handle()
→ sendEmailIfConfigured()
→ EmailService method tương ứng
→ @Async send mail qua JavaMailSender
```

File cụ thể:
- `BookingRoomService.java`, `BookingCarService.java`, `ApprovalService.java`: tạo `NotificationEvent.EmailInstruction`.
- `NotificationEventListener.java`: dispatch loại email.
- `EmailService.java`: các method `@Async`:
  - `sendBookingCreatedEmailToAdmin`
  - `sendBookingApprovedEmail`
  - `sendBookingRejectedEmail`
  - `sendProfileUpdateRequestedEmailToAdmin`
  - `sendProfileUpdateApprovedEmail`
  - `sendProfileUpdateRejectedEmail`

Đánh giá:
- Mail đang async bằng `@Async`.
- Mail không làm rollback booking vì chạy sau commit.
- Nếu mail lỗi, `EmailService.sendEmail()` chỉ log lỗi, không throw tiếp.
- Không thấy retry/backoff/queue.
- Template mail đang hard-code HTML string trong `EmailService.java`.
- URL email đang hard-code domain `https://cfcbooking.io.vn/...`, chưa thấy lấy từ env/config.

### 2.5 In-app notification/WebSocket flow

```text
NotificationEvent
→ NotificationEventListener.handle()
→ NotificationService.createNotification()
→ save Notification entity
→ NotificationService.pushRealtime()
→ SimpMessagingTemplate.convertAndSendToUser(recipientId, "/queue/notifications", payload)
→ Frontend NotificationContext tạo STOMP client
→ subscribe /user/queue/notifications
→ upsertRealtimeNotification()
→ toast + unreadCount + app badge
```

File cụ thể:
- Backend:
  - `NotificationEventListener.java`
  - `NotificationService.java`
  - `NotificationRepository.java`
  - `WebSocketConfig.java`
- Frontend:
  - `frontend/src/contexts/NotificationContext.jsx`
  - `frontend/src/api/notificationApi.js`
  - `frontend/src/utils/appBadge.js`
  - `frontend/src/utils/notification.js`

Đánh giá:
- Notification list API có phân trang: `GET /api/v1/notifications?page&size&unreadOnly`.
- Backend giới hạn size max 50 trong `NotificationController`.
- `NotificationContext.loadNotifications()` gọi `getNotifications()` rồi gọi thêm `getUnreadCount()` → 2 API cho một lần load.
- `NotificationProvider` giữ state notification/unread ở context toàn app; mỗi update có thể re-render mọi consumer.

### 2.6 Push notification/PWA flow

```text
User bật notification
→ PushNotificationSettings.jsx
→ usePushNotifications.enableNotifications()
→ Notification.requestPermission()
→ navigator.serviceWorker.ready
→ pushManager.getSubscription()
→ nếu key mismatch thì unsubscribe
→ pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
→ pushApi.subscribe()
→ POST /api/v1/push/subscriptions
→ PushSubscriptionController.subscribe()
→ PushSubscriptionService.subscribe()
→ save/update PushSubscription by endpoint
→ Khi có NotificationEvent
→ NotificationEventListener.sendPushIfSubscribed()
→ PushSubscriptionService.findActiveByUser()
→ PushService.sendPush()
→ browser service worker nhận push
→ frontend/src/sw.js showNotification()
→ notificationclick focus/open route
```

File cụ thể:
- Frontend:
  - `frontend/src/hooks/usePushNotifications.js`
  - `frontend/src/components/PushNotificationSettings.jsx`
  - `frontend/src/api/pushApi.js`
  - `frontend/src/sw.js`
- Backend:
  - `PushSubscriptionController.java`
  - `PushSubscriptionService.java`
  - `PushService.java`
  - `PushSubscriptionRepository.java`
  - `PushSubscription.java`
  - `WebPushConfig.java`

Đánh giá:
- Có xử lý nhiều thiết bị/user bằng bảng `PushSubscription` và `findByUserIdAndIsActiveTrue`.
- Có cleanup subscription lỗi khi Web Push trả `404`, `410`, `403`: `PushService.sendPush()` gọi `pushSubscriptionService.deactivate()`.
- Click notification có deep link:
  - `sw.js` dùng `event.notification.data.url`.
  - Nếu client đang mở, `postMessage({ type: 'NAVIGATE', url })`.
  - Nếu chưa mở, `clients.openWindow(targetUrl)`.
- iOS có kiểm tra:
  - `isIOS()`
  - `isStandalone()`
  - Nếu iOS chưa mở từ Home Screen thì `needsHomeScreenInstall`.

Rủi ro:
- `PushService.sendPush()` gửi tuần tự từng subscription trong vòng for của `NotificationEventListener`.
- Không có retry/backoff.
- Không có timeout rõ ràng ở tầng code đã đọc.
- Nếu user có nhiều thiết bị/subscription, push event có thể chậm trên executor async.
- Không thấy fallback email riêng khi push fail; email là kênh độc lập nếu event có EmailInstruction.

### 2.7 Calendar flow

Room/car calendar dùng `react-big-calendar`.

Car đã đọc cụ thể tại `frontend/src/pages/CarBooking.jsx`:

```text
mount CarBooking
→ Promise.all([resourceApi.getCars(), bookingApi.getCarBookings()])
→ GET /api/v1/resources/cars
→ GET /api/v1/bookings/cars
→ map toàn bộ bookings thành events
→ filter theo selectedCar/status ở render
→ Calendar react-big-calendar render month/week/day
→ navigate date/view chỉ setState cục bộ
→ không gọi API lại khi chuyển ngày/tuần/tháng
```

File cụ thể:
- `frontend/src/pages/CarBooking.jsx`
- `frontend/src/pages/RoomBooking.jsx` tương đương cần đối chiếu.
- `frontend/src/components/calendar/CustomToolbar.jsx`
- `frontend/src/components/calendar/CustomEvent.jsx`
- `frontend/src/components/calendar/CustomMonthEvent.jsx`
- `frontend/src/components/calendar/CustomDateHeader.jsx`
- `frontend/src/components/calendar/bookingCalendar.css`
- `frontend/src/utils/dateTime.js`
- `frontend/src/api/bookingApi.js`

Đánh giá:
- View mặc định mobile trong `CarBooking.jsx`: `window.innerWidth < 768 ? 'day' : 'week'`.
- Không có listener resize để đổi view khi xoay màn hình/resize.
- `filteredEvents = events.filter(...)` chạy mỗi render, chưa memo hóa.
- Data load toàn bộ qua `bookingApi.getCarBookings()`, backend `BookingCarService.getAllBookings()` gọi `findAll()`.
- Khi chuyển tháng/tuần/ngày chỉ `setDate`; không gọi API theo range.
- Không thấy debounce/throttle vì không có search/filter text.
- Có nguy cơ timezone/format vì dùng `LocalDateTime` backend và frontend parse qua `parseApiDateTime()`; cần xác minh `utils/dateTime.js`.

---

## 3. Nhận xét FrontEnd

### 3.1 Bundle/build

File liên quan:
- `frontend/package.json`
- `frontend/vite.config.js`
- `frontend/src/App.jsx`
- `frontend/src/pages/*.jsx`
- `frontend/src/sw.js`

Nhận xét:
- Có thư viện nặng/đáng chú ý:
  - `react-big-calendar`
  - `date-fns`
  - `@stomp/stompjs`
  - `sockjs-client`
  - `lucide-react`
  - `workbox-precaching`
- Calendar pages import trực tiếp `react-big-calendar/lib/css/react-big-calendar.css`.
- Cần kiểm tra `App.jsx` đầy đủ để xác nhận route lazy loading. Output bị truncate nên chưa thể kết luận chắc chắn.
- Nếu `App.jsx` import trực tiếp toàn bộ pages, bundle initial sẽ lớn vì kéo theo calendar/admin/notification/PWA code.
- `sw.js` dùng Workbox precache, chưa thấy runtime caching API trong file đã đọc.

### 3.2 Render performance

Vị trí cụ thể:
- `frontend/src/pages/CarBooking.jsx`
  - `filteredEvents` tính lại mỗi render.
  - `events.map()` sau API load toàn bộ booking.
  - `Calendar` nhận `events={filteredEvents}` có thể render nhiều event nếu DB lớn.
  - `useState(window.innerWidth < 768 ? 'day' : 'week')` chỉ tính lúc mount, không phản ứng resize.
- `frontend/src/contexts/NotificationContext.jsx`
  - Context chứa `notifications`, `unreadCount`, `loading`, `error`, functions.
  - Mỗi notification realtime cập nhật context, có thể làm re-render các consumer.
  - `loadNotifications()` set loading, set notifications, gọi thêm unread count.
- `frontend/src/hooks/usePushNotifications.js`
  - Logic khá đầy đủ, có cleanup khi disable.
  - Không thấy memory leak rõ.
- `frontend/src/sw.js`
  - Có tránh duplicate OS notification khi client đang focused.

### 3.3 API performance

File:
- `frontend/src/api/baseApi.js`
- `frontend/src/api/bookingApi.js`
- `frontend/src/api/notificationApi.js`
- `frontend/src/api/pushApi.js`
- `frontend/src/pages/CarBooking.jsx`

Nhận xét:
- `bookingApi.getRoomBookings()` và `getCarBookings()` không nhận params range/page.
- `CarBooking.jsx` load cars + bookings song song là tốt.
- Không thấy cache query/client cache như React Query/SWR.
- Không thấy cancel request khi unmount.
- Notification load dùng pagination nhưng context mặc định chỉ load page 0 size 10.
- Calendar không prefetch theo range vì hiện load toàn bộ.

### 3.4 Mobile/PWA performance

File:
- `frontend/src/pages/CarBooking.jsx`
- `frontend/src/components/calendar/bookingCalendar.css`
- `frontend/src/hooks/usePushNotifications.js`
- `frontend/src/components/PushNotificationSettings.jsx`
- `frontend/src/sw.js`
- `frontend/vite.config.js`

Nhận xét:
- Car calendar có mobile default view `day`.
- Cần kiểm tra CSS `bookingCalendar.css` để xác nhận touch target/safe area.
- iOS push UX có xử lý bắt buộc standalone.
- `sw.js` không cache API động, nên ít rủi ro stale booking từ SW; tuy nhiên cũng chưa có offline fallback rõ trong file đã đọc.
- Icon PWA có nhiều size trong `frontend/public/icons/`, gồm maskable `icon-maskable-192x192.png`, `icon-maskable-512x512.png`.

---

## 4. Nhận xét Backend

### 4.1 API/backend flow

File:
- `BookingRoomController.java`
- `BookingCarController.java`
- `BookingRoomService.java`
- `BookingCarService.java`
- `ApprovalService.java`
- `NotificationController.java`

Nhận xét:
- Controller booking có try/catch trả `ApiResponse`, service xử lý nghiệp vụ chính.
- Booking service có transaction và lock resource.
- Logic notification được tách bằng event sau commit: tốt cho tính nhất quán dữ liệu booking.
- API list booking hiện trả toàn bộ:
  - `BookingRoomService.getAllBookings()` → `findAll()`
  - `BookingCarService.getAllBookings()` → `findAll()`
- Calendar repository có method range:
  - `findByStatusAndStartTimeBetweenOrderByStartTimeAsc(...)`
  - Nhưng chưa thấy controller/API dùng cho calendar.
- Notification API có pagination và giới hạn size max 50: tốt.
- Một số API trả thẳng entity booking thay vì DTO, dễ kéo quan hệ JPA và lộ field không cần thiết.

### 4.2 Database

Entity đã thấy:
- `BookingRoom`
- `BookingCar`
- `Notification`
- `PushSubscription`
- `ApprovalStep`
- `User`
- `Room`
- `Vehicle`
- `Department`
- `ProfileUpdateRequest`

Repository đã thấy:
- `BookingRoomRepository.countOverlappingBookings()`
- `BookingCarRepository.countOverlappingBookings()`
- `NotificationRepository` query theo recipient/read/createdAt.
- `PushSubscriptionRepository` query theo user/active/endpoint.

Rủi ro DB:
- Cần index cho overlap:
  - `booking_room(room_id, status, start_time, end_time)`
  - `booking_car(vehicle_id, status, start_time, end_time)`
- Cần index notification:
  - `notification(recipient_id, is_read, created_at)`
  - unique chống duplicate nếu logic `existsByRecipientIdAndTypeAndSourceTypeAndSourceId`.
- Cần unique/index push subscription:
  - `push_subscription(endpoint)`
  - `push_subscription(user_id, is_active)`
- Nếu chỉ check duplicate notification bằng `exists...` ở app-level mà không có unique constraint DB, vẫn có race condition khi nhiều event song song.

### 4.3 JWT/Security

File:
- `SecurityConfig.java`
- `JwtAuthFilter.java`
- `JwtUtils.java`
- `NotificationController.java`
- `PushSubscriptionController.java`
- `NotificationContext.jsx`
- `baseApi.js`

Đã xác định:
- Push API yêu cầu `@AuthenticationPrincipal User user`, có `requireUser`.
- Notification API chỉ cho user đọc notification của mình:
  - `GET /notifications`
  - compat endpoint `/notifications/users/{userId}` có check `currentUser.getId().equals(userId)`.
- WebSocket frontend gửi header:
  - `Authorization: Bearer ${token}` trong `NotificationContext.jsx`.

Cần xác minh thêm:
- `WebSocketConfig.java` có validate JWT cho STOMP CONNECT hay chỉ dựa vào HTTP handshake.
- `SecurityConfig.java` public/private endpoint cụ thể.
- Token frontend lưu bằng cookie `Cookies.get('accessToken')`; cần xem `authApi.js/baseApi.js` đầy đủ để đánh giá `HttpOnly/SameSite/Secure`.

### 4.4 Mail/Push/Scheduler

- Mail:
  - Async.
  - Sau commit.
  - Không rollback booking khi mail lỗi.
  - Không retry/queue.
  - Template hard-code.
- Push:
  - Sau commit.
  - Gửi qua Web Push lib.
  - Deactivate subscription khi status `404/410/403`.
  - Không retry/backoff.
  - Gửi tuần tự cho từng subscription.
- Scheduler:
  - Chưa thấy scheduler nghiệp vụ booking/mail/push trong các file đã đọc.
  - Nếu có `@Scheduled`, cần search thêm; từ cấu trúc file ban đầu chưa thấy service scheduler riêng.

---

## 5. Nhận xét Docker/Deploy

Các file liên quan theo cấu trúc:
- `docker-compose.yml`
- `backend/pom.xml`
- `frontend/vite.config.js`
- `cloudflared-config.yml`
- docs deploy trong `docs/Cloudflare-Tunnel-Deployment.md`
- Chưa thấy root `Dockerfile`, `nginx.conf` trong danh sách file ban đầu.
- Chưa thấy `frontend/Dockerfile`, `backend/Dockerfile` trong danh sách file ban đầu.

Nhận xét chính:
- Có `docker-compose.yml` ở root.
- Có `cloudflared-config.yml`, cho thấy deploy có thể đi qua Cloudflare Tunnel.
- Frontend PWA/push bắt buộc HTTPS ở production; nếu dùng Cloudflare Tunnel/domain HTTPS là hướng phù hợp.
- Cần xác minh trong `docker-compose.yml`:
  - biến môi trường DB/JWT/mail/VAPID.
  - restart policy.
  - healthcheck.
  - volume DB.
  - timezone.
  - JVM options.
  - resource limit.
- Nếu thiếu Dockerfile/nginx config thật, production frontend/backend build có thể đang phụ thuộc compose image build từ context khác hoặc chưa hoàn chỉnh.

Rủi ro production cần chú ý:
- PWA push không hoạt động nếu không HTTPS/domain hợp lệ.
- CORS phải khớp domain production.
- VAPID private key không được commit vào repo.
- Mail config cần env production, không hard-code.
- Timezone container/backend/DB cần thống nhất vì booking dùng `LocalDateTime`.

---

## 6. Nhận xét PWA Android

File:
- `frontend/src/sw.js`
- `frontend/src/hooks/usePushNotifications.js`
- `frontend/src/components/PushNotificationSettings.jsx`
- `frontend/public/icons/*`
- `frontend/vite.config.js`

Đánh giá Android:
- Có Service Worker nhận `push` và gọi `showNotification()`.
- Có `notificationclick` mở đúng route/focus client.
- Có maskable icons trong `frontend/public/icons/`.
- Android Chrome hỗ trợ Web Push khi PWA hoặc tab có service worker/subscription.
- `usePushNotifications.js` dùng `PushManager.subscribe()` đúng flow.
- `sw.js` tránh hiển thị notification duplicate khi client đang focused.
- Cache:
  - `sw.js` chỉ thấy precache assets qua `precacheAndRoute(self.__WB_MANIFEST || [])`.
  - Không thấy runtime cache API booking, nên ít nguy cơ cache nhầm API động/stale booking từ service worker.
- Cần kiểm tra manifest trong `vite.config.js` để xác nhận:
  - `display: standalone`
  - `start_url`
  - `scope`
  - `theme_color`
  - `background_color`
  - maskable icons khai báo đúng.

---

## 7. Nhận xét PWA iOS

File:
- `frontend/src/hooks/usePushNotifications.js`
- `frontend/src/components/PushNotificationSettings.jsx`
- `frontend/src/sw.js`
- `frontend/vite.config.js`
- `frontend/index.html`
- `frontend/public/icons/*`

Đánh giá iOS:
- `usePushNotifications.js` có logic:
  - phát hiện iOS.
  - phát hiện standalone bằng `display-mode: standalone` hoặc `navigator.standalone`.
  - nếu iOS chưa Add to Home Screen thì báo: cần thêm PWA vào màn hình chính.
- Đây là đúng điều kiện quan trọng của iOS Web Push.
- `sw.js` có push/click handler, phù hợp PWA installed.
- Cần kiểm tra `index.html` để xác nhận:
  - `apple-touch-icon`
  - viewport phù hợp.
  - safe-area nếu layout có notch.
- Chưa thấy CSS safe area trong file đã đọc; cần kiểm tra `index.css/App.css/bookingCalendar.css`.
- Khi user chưa cài PWA vào Home Screen, hook hiện chặn enable push: đúng với iOS.
- Click notification sẽ mở route từ `targetUrl`; nếu app cần auth và token hết hạn, route có thể về login tùy `App.jsx/Auth` guard.

---

## 8. Bảng vấn đề FrontEnd

| Vị trí | Vấn đề | Mức độ ảnh hưởng | Lý do | Gợi ý tối ưu |
|---|---|---:|---|---|
| `frontend/src/api/bookingApi.js` | `getRoomBookings()`/`getCarBookings()` không nhận range/page | High | Calendar phải tải toàn bộ booking | Thêm API params `start/end/resourceId/status`, chỉ load range đang xem. |
| `frontend/src/pages/CarBooking.jsx` | `Promise.all([getCars, getCarBookings])` load toàn bộ booking xe khi mount | High | DB lớn sẽ chậm load, JSON lớn, render calendar nặng | Load booking theo range ngày/tuần/tháng và selected vehicle. |
| `frontend/src/pages/CarBooking.jsx` | Chuyển view/date chỉ `setDate`, không refetch theo range | High | Nếu chuyển nhiều tháng vẫn dùng dataset ban đầu toàn bộ | Gắn `onRangeChange` hoặc tính visible range để fetch. |
| `frontend/src/pages/CarBooking.jsx` | `filteredEvents` filter mỗi render, chưa `useMemo` | Medium | Calendar render lại nhiều khi đổi state không liên quan | Memo hóa theo `[events, selectedCar]`. |
| `frontend/src/pages/CarBooking.jsx` | `view` mobile chỉ lấy `window.innerWidth` lúc mount | Medium | Resize/xoay màn hình không đổi layout | Dùng responsive hook/listener cleanup hoặc CSS/view riêng. |
| `frontend/src/pages/CarBooking.jsx` | `onSelectEvent` luôn navigate `/admin/approvals/${event.id}` | Medium | User thường có thể click booking của mình nhưng bị đưa vào admin route | Điều hướng theo role/status/source hoặc detail route phù hợp. |
| `frontend/src/contexts/NotificationContext.jsx` | Context update notification/unread có thể re-render rộng | Medium | Provider bọc app, mỗi realtime notification đổi value object | Tách unread context/list context hoặc memo hóa value. |
| `frontend/src/contexts/NotificationContext.jsx` | `loadNotifications()` gọi thêm `getUnreadCount()` | Low/Medium | 2 API cho một lần load notification | Backend có thể trả unread count kèm page hoặc frontend chỉ gọi khi cần. |
| `frontend/src/contexts/NotificationContext.jsx` | WebSocket token lấy một lần khi mount | Medium | Nếu access token refresh sau đó, client cũ vẫn dùng token cũ | Reconnect khi token thay đổi hoặc central auth event. |
| `frontend/src/hooks/usePushNotifications.js` | Push subscribe không có retry | Low/Medium | Mạng yếu có thể fail UX | Retry nhẹ hoặc thông báo retry thủ công. |
| `frontend/src/sw.js` | Chỉ precache, chưa thấy offline fallback | Medium | PWA cài được nhưng offline UX có thể trắng/không rõ | Thêm offline fallback cho navigation nếu cần. |
| `frontend/src/sw.js` | `client.postMessage({ type: 'NAVIGATE' })` cần app listener | Medium | Nếu app không listen message, click notification khi app mở chỉ focus, không navigate | Xác minh `main.jsx/App.jsx` có `navigator.serviceWorker.addEventListener('message')`. |
| `frontend/src/pages/CreateCarBooking.jsx` | Lấy `requesterId` từ `authApi.getUser()` trên client gửi lên | High/Security | Client có thể giả requesterId nếu backend không đối chiếu authenticated user | Backend nên lấy requester từ JWT thay vì tin payload. |
| `frontend/src/pages/CreateRoomBooking.jsx` | Khả năng tương tự gửi `requesterId` từ client | High/Security | Cùng rủi ro giả danh user | Backend derive requester từ `@AuthenticationPrincipal`. |
| `frontend/src/pages/CarBooking.jsx` | `b.title` cho car event có thể null | Low/Medium | `BookingCarService` output đọc được chưa thấy set title | Chuẩn hóa title từ departure/destination hoặc backend DTO. |

---

## 9. Bảng vấn đề Backend

| Vị trí | Vấn đề | Mức độ ảnh hưởng | Lý do | Gợi ý tối ưu |
|---|---|---:|---|---|
| `BookingRoomService.getAllBookings()` | Trả `findAll()` | High | Calendar/list lớn sẽ chậm, tốn RAM/network | Thêm API theo range/pagination. |
| `BookingCarService.getAllBookings()` | Trả `findAll()` | High | Tương tự booking phòng | Dùng `findByStatusAndStartTimeBetween...` hoặc query range. |
| `BookingRoomController.getAllBookings()` | API list không phân trang/range | High | Frontend calendar đang dùng endpoint này | Thêm query params `start,end,roomId,status`. |
| `BookingCarController.getAllBookings()` | API list không phân trang/range | High | Frontend `CarBooking.jsx` load toàn bộ | Thêm query params `start,end,vehicleId,status`. |
| `BookingRoomRepository.countOverlappingBookings()` | Cần index composite | Critical/High | Overlap query sẽ scan lớn nếu thiếu index | Index `(room_id,status,start_time,end_time)`. |
| `BookingCarRepository.countOverlappingBookings()` | Cần index composite | Critical/High | Tương tự xe | Index `(vehicle_id,status,start_time,end_time)`. |
| `BookingRoomService.createBooking()` | Tin `request.getRequesterId()` từ client | Critical/Security | User có thể gửi requesterId người khác nếu endpoint không kiểm tra | Lấy requester từ JWT trong controller/service. |
| `BookingCarService.createBooking()` | Tin `request.getRequesterId()` từ client | Critical/Security | Cùng rủi ro giả danh booking | Dùng `@AuthenticationPrincipal`. |
| `NotificationService.createNotification()` | Check duplicate bằng `exists...` app-level | Medium/High | Race condition có thể tạo duplicate | Thêm unique constraint DB hoặc idempotency key. |
| `NotificationRepository.findByRecipientIdOrderByCreatedAtDesc(String)` | Có method trả list toàn bộ | Medium | Nếu được dùng nơi khác sẽ nặng | Ưu tiên pageable, deprecated method list toàn bộ. |
| `NotificationEventListener.sendPushIfSubscribed()` | Gửi push tuần tự từng subscription | Medium | User nhiều thiết bị/admin nhiều event có thể chậm executor | Batch/async bounded executor/retry queue. |
| `PushService.sendPush()` | Không retry/backoff | Medium | Push fail tạm thời bị mất | Thêm retry nhẹ/queue nếu business cần. |
| `EmailService.java` | Template hard-code trong Java string | Medium | Khó maintain/i18n, hard-code domain | Dùng template engine hoặc ít nhất config `app.frontend-url`. |
| `EmailService.java` | URL domain hard-code `https://cfcbooking.io.vn` | High/Deploy | Sai domain staging/local/prod khác | Đưa vào env/config. |
| `PushSubscriptionService.subscribe()` | Upsert theo endpoint toàn cục | Medium | Endpoint đổi user sẽ chuyển ownership sang user mới | Có thể hợp lý khi login lại, nhưng cần audit security/session. |
| `PushSubscriptionRepository` | Cần unique `endpoint` | High | Upsert theo endpoint cần DB bảo đảm không duplicate | Thêm unique index. |
| `NotificationController.getUnreadSince()` | Parse `LocalDateTime.parse(since)` không catch lỗi | Low/Medium | Input sai gây 500/400 không chuẩn tùy exception handling | Validate/catch trả 400 rõ. |
| Entity booking/notification | Dùng `LocalDateTime` | Medium | Rủi ro timezone giữa browser/backend/container/DB | Chuẩn hóa timezone hoặc dùng `Instant/OffsetDateTime` cho event time. |
| `ApprovalService.java` | Cần kiểm tra transaction + notification sau approval | Medium | Output bị truncate nên chưa xác minh toàn bộ | Đảm bảo approval update + event sau commit. |

---

## 10. Bảng vấn đề Docker/Deploy

| Vị trí | Vấn đề | Mức độ | Tác động | Gợi ý |
|---|---|---:|---|---|
| `docker-compose.yml` | Cần xác minh healthcheck/restart/resource limit | High | Container fail không tự hồi phục hoặc khó monitor | Bổ sung `restart`, `healthcheck`, resource limit nếu thiếu. |
| `docker-compose.yml` | Cần timezone container | High | Booking `LocalDateTime` lệch giờ giữa app/DB | Set `TZ=Asia/Ho_Chi_Minh` cho backend/DB. |
| `docker-compose.yml` | Cần env JWT/mail/VAPID rõ | Critical | Production fail auth/mail/push nếu thiếu | Dùng `.env.example` đầy đủ, không commit secret. |
| `cloudflared-config.yml` | HTTPS/domain phụ thuộc tunnel | High/PWA | PWA push yêu cầu HTTPS | Đảm bảo domain production cố định, TLS hợp lệ. |
| `nginx.conf` | Chưa thấy trong danh sách root | Medium/High | SPA route refresh có thể 404 nếu không fallback | Nếu deploy Nginx, cần `try_files $uri /index.html`. |
| `Dockerfile` | Chưa thấy rõ root/frontend/backend Dockerfile trong list | High | Khó build production nhất quán | Cần xác minh file build image thực tế. |
| Backend JVM | Chưa thấy JVM options | Medium | Memory container không tối ưu | Cấu hình `JAVA_OPTS`, heap theo container. |
| Logs | Chưa thấy logging config production | Medium | Khó debug mail/push fail | Log stdout structured, không log secret. |
| CORS | `SecurityConfig.java`/`WebConfig.java` | Critical | Sai origin gây lỗi frontend hoặc mở quá rộng | Khóa origin production/staging cụ thể. |
| VAPID | `WebPushConfig.java`, env | Critical/PWA | Push không hoạt động nếu thiếu public/private key | Cấu hình env và verify public key frontend nhận được. |

---

## 11. Top 10 việc nên tối ưu trước

1. **[Critical] - `BookingRoomService.java`/`BookingCarService.java` - requesterId lấy từ request body - Rủi ro giả danh user - Lấy requester từ JWT `@AuthenticationPrincipal`.**
2. **[Critical] - DB booking room/car - overlap query thiếu index xác minh - Có thể scan lớn và cho đặt trùng khi tải cao - Thêm composite index phù hợp.**
3. **[Critical] - Docker/env/VAPID/CORS - Production PWA/push/auth có thể fail - Chuẩn hóa `.env.example`, domain, HTTPS, VAPID, CORS.**
4. **[High] - `BookingRoomService.getAllBookings()`/`BookingCarService.getAllBookings()` - `findAll()` - Calendar chậm khi dữ liệu lớn - API range theo ngày/tuần/tháng.**
5. **[High] - `frontend/src/pages/CarBooking.jsx`/`RoomBooking.jsx` - Calendar load toàn bộ booking - Bundle/render/API nặng - Fetch theo visible range/resource.**
6. **[High] - `EmailService.java` - hard-code domain production - Sai link ở staging/local - Đưa frontend base URL vào config.**
7. **[High] - `NotificationService.createNotification()` - chống duplicate bằng app-level exists - Có race duplicate - Unique constraint/idempotency key.**
8. **[High] - `frontend/src/pages/CreateRoomBooking.jsx`/`CreateCarBooking.jsx` - gửi requesterId từ client - Rủi ro security đồng bộ với backend - Không gửi requesterId hoặc backend bỏ qua.**
9. **[Medium] - `NotificationContext.jsx` - context notification làm re-render rộng - UX kém khi realtime nhiều - Tách context/memo hóa.**
10. **[Medium] - `PushService.java`/`NotificationEventListener.java` - push tuần tự không retry - Mất push khi lỗi tạm thời - Thêm retry/backoff hoặc queue nhẹ.**

---

## 12. Rủi ro production lớn nhất

1. **Rủi ro security giả danh requester**
   - File: `CreateCarBooking.jsx`, `CreateRoomBooking.jsx`, `BookingCarService.java`, `BookingRoomService.java`.
   - Lý do: frontend gửi `requesterId`, backend đang tìm user theo `request.getRequesterId()`.
   - Tác động: user có thể tạo booking dưới danh nghĩa người khác nếu biết ID.

2. **Calendar/API không scale**
   - File: `bookingApi.js`, `CarBooking.jsx`, `RoomBooking.jsx`, `BookingRoomService.java`, `BookingCarService.java`.
   - Lý do: list booking dùng `findAll()`, frontend load toàn bộ.
   - Tác động: chậm UI, tốn DB/network, calendar render nặng.

3. **Timezone sai dữ liệu booking**
   - File: booking entities/services dùng `LocalDateTime`, frontend `dateTime.js`, Docker timezone.
   - Tác động: booking lệch giờ trên desktop/mobile/container/DB.

4. **PWA push production fail do env/domain**
   - File: `WebPushConfig.java`, `PushService.java`, `usePushNotifications.js`, `sw.js`, `docker-compose.yml`.
   - Lý do: Web Push cần HTTPS + VAPID đúng + service worker scope đúng.
   - Tác động: Android/iOS không nhận notification.

5. **Thiếu index/constraint DB**
   - File: repositories/entity schema.
   - Tác động: overlap check chậm, duplicate notification/subscription.

---

## 13. Roadmap tối ưu theo phase

### Phase 1: Fix rủi ro production/blocker

Mục tiêu:
- Chặn lỗi security/data correctness trước production.

File/layer:
- `BookingRoomController.java`
- `BookingCarController.java`
- `BookingRoomService.java`
- `BookingCarService.java`
- `SecurityConfig.java`
- `JwtAuthFilter.java`
- `docker-compose.yml`
- env production

Việc cần làm:
- Backend lấy requester từ authenticated user, không tin `requesterId` client.
- Review CORS/public endpoint.
- Xác minh VAPID/JWT/mail env.
- Thống nhất timezone backend/DB/container.
- Xác minh HTTPS/domain cho PWA.

Rủi ro:
- Thay đổi contract API booking có thể ảnh hưởng frontend create pages.

Test cần chạy:
- Login user A, thử gửi requesterId user B.
- Tạo booking room/car hợp lệ.
- Tạo booking trùng giờ.
- Check CORS production origin.
- Check push public key endpoint sau deploy.

Kết quả mong muốn:
- Không giả danh user.
- Booking không lệch giờ.
- Production env đủ để auth/mail/push chạy.

### Phase 2: Tối ưu frontend performance

Mục tiêu:
- Giảm tải bundle/render/API cho calendar và notification.

File/layer:
- `frontend/src/pages/RoomBooking.jsx`
- `frontend/src/pages/CarBooking.jsx`
- `frontend/src/api/bookingApi.js`
- `frontend/src/contexts/NotificationContext.jsx`
- `frontend/src/App.jsx`

Việc cần làm:
- Calendar fetch theo visible range.
- Memo hóa filtered events.
- Kiểm tra lazy route/code splitting.
- Tách/memo notification context nếu cần.
- Xử lý responsive calendar resize.

Rủi ro:
- Cache/range sai có thể thiếu event.

Test cần chạy:
- Month/week/day switch.
- Filter room/car.
- Mobile portrait/landscape.
- Notification realtime khi đang ở calendar.

Kết quả mong muốn:
- Calendar nhanh với dữ liệu lớn.
- Initial bundle nhỏ hơn.
- Ít re-render toàn app.

### Phase 3: Tối ưu backend/database

Mục tiêu:
- API calendar/list scale tốt, query có index.

File/layer:
- `BookingRoomRepository.java`
- `BookingCarRepository.java`
- `NotificationRepository.java`
- `PushSubscriptionRepository.java`
- Booking/notification/push entities/schema.

Việc cần làm:
- API booking range + pagination.
- Index overlap booking.
- Index notification recipient/read/createdAt.
- Unique/index push endpoint.
- Unique/idempotency notification source.

Rủi ro:
- Migration/index cần chạy cẩn thận trên DB production.

Test cần chạy:
- Explain query overlap.
- Load test calendar range.
- Tạo notification duplicate event song song.
- Push subscribe nhiều thiết bị.

Kết quả mong muốn:
- Query ổn định khi dữ liệu tăng.
- Không duplicate notification/subscription.

### Phase 4: Tối ưu PWA Android/iOS

Mục tiêu:
- PWA cài được, push/click/deep link ổn trên Android/iOS.

File/layer:
- `frontend/vite.config.js`
- `frontend/src/sw.js`
- `frontend/src/hooks/usePushNotifications.js`
- `frontend/index.html`
- `frontend/public/icons/*`
- CSS global/layout.

Việc cần làm:
- Verify manifest fields/icons/maskable.
- Verify service worker scope.
- Add/verify app message listener for `NAVIGATE`.
- iOS apple touch icon/viewport/safe-area.
- Android install prompt UX nếu cần.
- Offline fallback nếu cần.

Rủi ro:
- Service worker cache sai có thể làm app dùng asset cũ.

Test cần chạy:
- Lighthouse PWA.
- Android install + push when closed.
- iOS Add to Home Screen + permission + push.
- Click notification mở đúng route.

Kết quả mong muốn:
- Android/iOS PWA UX ổn, push đáng tin cậy.

### Phase 5: Tối ưu mail/push/scheduler

Mục tiêu:
- Mail/push bền hơn, không mất notification khi lỗi tạm thời.

File/layer:
- `NotificationEventListener.java`
- `EmailService.java`
- `PushService.java`
- `PushSubscriptionService.java`

Việc cần làm:
- Config frontend URL cho email.
- Retry/backoff cho mail/push nếu cần.
- Bounded executor/queue.
- Log context notification/source/user.
- Cleanup subscription lỗi đã có, cần monitor thêm.

Rủi ro:
- Retry không kiểm soát có thể spam email/push.

Test cần chạy:
- SMTP fail.
- Web Push 410/403.
- User nhiều thiết bị.
- Admin nhiều notification.

Kết quả mong muốn:
- Booking không bị chậm.
- Fail mail/push có log và retry hợp lý.

### Phase 6: Monitoring/logging/test

Mục tiêu:
- Quan sát được lỗi production và có regression test.

File/layer:
- Backend test folder
- Spring logging config
- Frontend test nếu có
- Docker logs/healthcheck

Việc cần làm:
- Test service booking overlap.
- Test security requester.
- Test notification permission/push mock.
- Healthcheck backend/db.
- Log mail/push fail có sourceId/type.

Rủi ro:
- Thiếu test integration DB có thể bỏ sót race condition.

Test cần chạy:
- Maven test.
- Frontend build/lint.
- Manual PWA checklist.
- API smoke test production.

Kết quả mong muốn:
- Có baseline trước khi tối ưu sâu.

---

## 14. Checklist test thủ công

### Auth/JWT
- [ ] Login thành công.
- [ ] Refresh page vẫn giữ session đúng.
- [ ] Gọi API protected không token bị 401.
- [ ] User thường không gọi được API admin.
- [ ] Không log JWT token ở console/server.

### Booking room/car
- [ ] Tạo booking phòng hợp lệ.
- [ ] Tạo booking xe hợp lệ.
- [ ] Tạo booking start >= end bị từ chối.
- [ ] Tạo booking trùng phòng cùng thời gian bị từ chối.
- [ ] Tạo booking trùng xe cùng thời gian bị từ chối.
- [ ] User không thể giả requesterId của user khác.
- [ ] Cancel booking cập nhật status đúng.

### Approval
- [ ] Admin duyệt booking phòng.
- [ ] Admin từ chối booking phòng có reason.
- [ ] Admin duyệt booking xe.
- [ ] Admin từ chối booking xe có reason.
- [ ] User nhận notification/email sau approve/reject.

### Calendar
- [ ] Room calendar hiển thị month/week/day đúng.
- [ ] Car calendar hiển thị month/week/day đúng.
- [ ] Chuyển tháng/tuần/ngày không mất event.
- [ ] Mobile mặc định view phù hợp.
- [ ] Click slot quá khứ bị chặn.
- [ ] Click event mở đúng detail/approval theo role.
- [ ] Kiểm tra booking sát nửa đêm/timezone.

### In-app notification/WebSocket
- [ ] Login xong nhận notification list.
- [ ] Unread count đúng.
- [ ] Realtime toast xuất hiện khi có event.
- [ ] Mark as read giảm unread count.
- [ ] Mark all as read set count = 0.
- [ ] Disconnect/reconnect WebSocket không duplicate notification.

### Mail
- [ ] Tạo booking gửi mail admin.
- [ ] Approve gửi mail user.
- [ ] Reject gửi mail user kèm reason.
- [ ] SMTP fail không rollback booking.
- [ ] Link email mở đúng domain/route.

### Push/PWA
- [ ] Android bật notification thành công.
- [ ] Android app đóng vẫn nhận push.
- [ ] Click push mở đúng route.
- [ ] iOS Safari chưa Add to Home Screen hiển thị hướng dẫn.
- [ ] iOS PWA installed bật notification thành công.
- [ ] Subscription cũ bị deactivate khi push trả 410.
- [ ] User nhiều thiết bị đều nhận push.

### Docker/Deploy
- [ ] `docker compose up` backend/frontend/db chạy.
- [ ] Backend healthcheck OK nếu có.
- [ ] Frontend route refresh không 404.
- [ ] CORS production OK.
- [ ] HTTPS domain OK.
- [ ] VAPID public key endpoint trả key.
- [ ] Timezone container đúng Asia/Ho_Chi_Minh.

---

## 15. Danh sách file còn thiếu hoặc cần đọc thêm nếu muốn tạo context docs chính xác hơn

Các file cần đọc thêm để hoàn thiện tài liệu context 100%:

| File | Vì sao cần |
|---|---|
| `frontend/src/pages/RoomBooking.jsx` | Đối chiếu flow calendar phòng với `CarBooking.jsx`. |
| `frontend/src/pages/AdminApprovals.jsx` | Xác minh UI approval gọi endpoint nào, refresh list thế nào. |
| `frontend/src/pages/BookingDetail.jsx` | Xác minh detail route cho booking/approval. |
| `frontend/src/api/approvalApi.js` | Chốt endpoint approval frontend. |
| `frontend/src/api/baseApi.js` | Đánh giá interceptor JWT, retry, error handling, token storage. |
| `frontend/src/api/authApi.js` | Xác minh login/refresh/logout, cookie/localStorage. |
| `frontend/src/main.jsx` | Xác minh service worker register và listener `NAVIGATE` từ `sw.js`. |
| `frontend/src/App.jsx` đầy đủ | Xác minh router, auth guard, lazy loading/code splitting. |
| `frontend/src/utils/dateTime.js` | Đánh giá timezone/format date chính xác. |
| `frontend/vite.config.js` đầy đủ | Xác minh PWA manifest, source map, build config, Workbox. |
| `frontend/index.html` | Xác minh viewport, apple touch icon, SEO/PWA meta. |
| `frontend/src/index.css`, `App.css`, `bookingCalendar.css` | Đánh giá responsive, safe area, touch target. |
| `backend/src/main/java/com/booking/system/config/SecurityConfig.java` đầy đủ | Chốt public/private endpoint, CORS, CSRF/session. |
| `backend/src/main/java/com/booking/system/config/WebSocketConfig.java` | Xác minh auth WebSocket/STOMP. |
| `backend/src/main/java/com/booking/system/security/JwtAuthFilter.java` | Xác minh JWT principal, error handling. |
| `backend/src/main/java/com/booking/system/security/JwtUtils.java` | Xác minh expiry/secret/claims. |
| `backend/src/main/java/com/booking/system/service/ApprovalService.java` đầy đủ | Chốt approval event/mail/push/status. |
| `backend/src/main/java/com/booking/system/entity/BookingCar.java` | Xác minh field `title` và mapping JSON. |
| `backend/src/main/resources/application.yml` hoặc `application.properties` | Chốt DB/mail/JWT/VAPID/CORS/timezone. |
| `docker-compose.yml` đầy đủ | Chốt deploy, env, healthcheck, volume, timezone. |
| `Dockerfile`, `nginx.conf` nếu có tên/path khác | Chốt production build/frontend SPA routing. |
| `.env.example` nếu có | Xác minh env bắt buộc cho AI context/deploy. |

---

## 16. File context sẽ tạo nếu được phép

Hiện tại tôi **chỉ đọc và phân tích**, chưa tạo file.

Nếu bạn cho phép tạo tài liệu context, bộ file nên tạo là:

```text
docs/AI_PROJECT_CONTEXT.md
docs/PROJECT_FLOW.md
docs/PERFORMANCE_AUDIT.md
AGENTS.md
```

Nội dung chính:

| File | Nội dung |
|---|---|
| `docs/AI_PROJECT_CONTEXT.md` | Tổng quan project, tech stack, folder structure, backend/frontend architecture, JWT, booking, approval, email, in-app notification, push/PWA, calendar, database, Docker, Android/iOS, performance/security notes, important files map. |
| `docs/PROJECT_FLOW.md` | Flow booking, approval, notification, calendar, PWA push theo đúng file/class/component hiện tại. |
| `docs/PERFORMANCE_AUDIT.md` | Bảng audit frontend/backend/database/PWA/Docker và top priority fixes. |
| `AGENTS.md` | Quy tắc cho AI agent sau này: đọc context trước khi code, không refactor lớn, chú ý JWT/security/PWA/mobile/Docker/timezone. |

---

## 17. Kết luận trạng thái hiện tại

- Đã đọc/phân tích các phần chính của backend service/event/repository/controller, frontend calendar/push/notification/API, và cấu trúc Docker/PWA theo phạm vi hiện có.
- Chưa sửa file.
- Chưa tạo file.
- Chưa refactor.
- Chưa tạo migration.
- Phân tích trên bám theo file/class/component/config cụ thể đã đọc.
- Nếu cần bước tiếp theo là tạo bộ tài liệu context, hãy chuyển sang yêu cầu “phân tích và tạo context” rồi toggle to Act mode để tôi tạo các file markdown theo đúng nội dung đã thống nhất.