# Roadmap Chỉnh Sửa & Tối Ưu Dự Án BookingBase

> Tài liệu này được tổng hợp từ `docs/rules.md` và phân tích kiến trúc hiện tại của dự án BookingBase.  
> Mục tiêu: xác định rõ **thứ nên chỉnh sửa**, **thứ tự ưu tiên**, **file/layer liên quan**, **rủi ro**, và **test cần chạy**.  
> Tài liệu này **không phải code implementation** và không thay đổi logic hệ thống.

---

## 1. Mục tiêu tối ưu

BookingBase hiện là hệ thống booking nội bộ gồm:

- Frontend: React + Vite + PWA.
- Backend: Spring Boot + JWT.
- Database: MySQL/JPA.
- Notification:
  - In-app notification qua database.
  - Realtime qua WebSocket/STOMP.
  - Email notification.
  - PWA/Web Push notification.
- Calendar:
  - Hiển thị booking phòng/xe theo ngày/tuần/tháng.
  - Dùng `react-big-calendar`.
- Deploy:
  - Có Docker Compose.
  - Có Cloudflare Tunnel/domain HTTPS.

Các hướng chỉnh sửa nên tập trung:

1. Bảo mật booking/JWT.
2. Khả năng scale của calendar/API.
3. Tối ưu query database.
4. Ổn định notification/email/push.
5. Tối ưu PWA Android/iOS.
6. Chuẩn hóa Docker/deploy production.
7. Bổ sung monitoring/logging/test.

---

## 2. Nguyên tắc khi chỉnh sửa

- Không refactor lớn nếu chưa cần.
- Không thay toàn bộ kiến trúc.
- Ưu tiên tối ưu trên nền hiện tại.
- Backend phải giữ database là source of truth.
- Notification database là nguồn dữ liệu chính.
- WebSocket chỉ là kênh realtime.
- Email là kênh fallback quan trọng.
- PWA Push chỉ dành cho thiết bị đã subscribe.
- Không log JWT token, VAPID private key, password hoặc secret.
- Khi sửa booking phải kiểm tra:
  - JWT user.
  - Overlap booking.
  - Notification sau commit.
  - Calendar refresh.
- Khi sửa PWA/service worker phải kiểm tra Android và iOS.
- Khi sửa Docker/deploy phải kiểm tra HTTPS, CORS, env và timezone.

---

## 3. Tổng quan thứ tự ưu tiên

| Nhóm | Mức độ | Lý do |
|---|---:|---|
| Bảo mật requesterId/JWT | Critical | Có nguy cơ user giả danh người khác khi tạo booking |
| Calendar API load toàn bộ | High | Không scale khi booking tăng |
| DB index overlap booking | High/Critical | Query kiểm tra trùng lịch có thể chậm |
| Docker/env/CORS/VAPID/timezone | Critical | Có thể làm production fail |
| Email hard-code domain | High | Sai link giữa local/staging/prod |
| Notification duplicate | Medium/High | Có thể tạo notification trùng khi event chạy song song |
| Push gửi tuần tự không retry | Medium | Có thể mất push khi lỗi tạm thời |
| Frontend context re-render rộng | Medium | Ảnh hưởng UX khi notification nhiều |
| PWA offline/iOS safe-area | Medium | Ảnh hưởng trải nghiệm mobile |
| Logging/test/monitoring | Medium | Khó vận hành production |

---

# Phase 1: Fix rủi ro production/blocker

## 1.1 Mục tiêu

Chặn các lỗi có thể gây:

- Sai dữ liệu.
- Lộ bảo mật.
- User tạo booking thay người khác.
- Production fail do env/CORS/VAPID/timezone.
- PWA push không hoạt động ngoài production.

---

## 1.2 Việc cần chỉnh sửa

### 1.2.1 Không tin `requesterId` từ frontend khi tạo booking

#### File liên quan

Frontend:

- `frontend/src/pages/CreateRoomBooking.jsx`
- `frontend/src/pages/CreateCarBooking.jsx`

Backend:

- `backend/src/main/java/com/booking/system/controller/BookingRoomController.java`
- `backend/src/main/java/com/booking/system/controller/BookingCarController.java`
- `backend/src/main/java/com/booking/system/service/BookingRoomService.java`
- `backend/src/main/java/com/booking/system/service/BookingCarService.java`
- `backend/src/main/java/com/booking/system/dto/BookingRoomRequest.java`
- `backend/src/main/java/com/booking/system/dto/BookingCarRequest.java`

#### Vấn đề hiện tại

Frontend đang gửi `requesterId` trong payload booking. Backend service dùng:

```text
request.getRequesterId()
```

để tìm user đặt lịch.

#### Rủi ro

User có thể giả mạo `requesterId` của người khác nếu biết ID.

#### Hướng chỉnh sửa

- Controller lấy user từ `@AuthenticationPrincipal User user`.
- Service nhận requester từ authenticated user hoặc requesterId đã được controller kiểm soát.
- Frontend không cần gửi `requesterId`, hoặc backend bỏ qua trường này.
- Giữ backward compatibility nếu cần, nhưng không dùng giá trị client gửi làm source of truth.

#### Test cần chạy

- Login user A.
- Dùng devtools/Postman gửi booking với `requesterId` của user B.
- Kỳ vọng booking vẫn thuộc user A hoặc request bị reject.
- Tạo booking phòng/xe hợp lệ.
- Tạo booking trùng giờ vẫn bị reject.

---

### 1.2.2 Review Security/JWT/CORS

#### File liên quan

- `backend/src/main/java/com/booking/system/config/SecurityConfig.java`
- `backend/src/main/java/com/booking/system/config/WebConfig.java`
- `backend/src/main/java/com/booking/system/security/JwtAuthFilter.java`
- `backend/src/main/java/com/booking/system/security/JwtUtils.java`
- `frontend/src/api/baseApi.js`
- `frontend/src/api/authApi.js`

#### Vấn đề cần kiểm tra

- Public endpoint có bị mở quá rộng không.
- CORS có đang allow toàn bộ origin không.
- JWT expiry/secret có lấy từ env không.
- Frontend token đang lưu cookie/localStorage như thế nào.
- Có log token ở frontend/backend không.

#### Hướng chỉnh sửa

- Chỉ public các endpoint cần thiết:
  - login.
  - refresh token nếu có.
  - static/public health nếu có.
- Khóa CORS theo domain:
  - local dev.
  - staging.
  - production.
- JWT secret/expiry lấy từ env.
- Không log Authorization header.

#### Test cần chạy

- API protected không token trả 401.
- User thường gọi API admin bị 403.
- Frontend production domain gọi API thành công.
- Domain lạ bị chặn CORS.

---

### 1.2.3 Chuẩn hóa env production cho JWT/Mail/VAPID

#### File liên quan

- `docker-compose.yml`
- `.env.example` nếu có
- `backend/src/main/resources/application.yml`
- `backend/src/main/resources/application.properties`
- `backend/src/main/java/com/booking/system/config/WebPushConfig.java`
- `backend/src/main/java/com/booking/system/service/PushService.java`
- `backend/src/main/java/com/booking/system/service/EmailService.java`
- `frontend/vite.config.js`
- `frontend/src/hooks/usePushNotifications.js`

#### Vấn đề hiện tại

Các cấu hình quan trọng cần được đảm bảo tồn tại ở production:

- JWT secret.
- JWT expiration.
- Database URL/user/password.
- Mail SMTP.
- VAPID public/private key.
- Frontend base URL.
- CORS allowed origins.
- Timezone.

#### Hướng chỉnh sửa

- Tạo/chuẩn hóa `.env.example`.
- Không commit secret thật.
- Backend fail fast hoặc log cảnh báo rõ khi thiếu VAPID/mail config.
- Frontend dùng đúng `VITE_API_URL` production.
- Email link không hard-code domain.

#### Test cần chạy

- `GET /api/v1/push/vapid-public-key` trả public key.
- Gửi email booking thành công.
- Login/JWT hoạt động sau restart container.
- Frontend production gọi đúng API URL.

---

### 1.2.4 Thống nhất timezone

#### File liên quan

- `docker-compose.yml`
- `backend/src/main/resources/application.yml`
- `backend/src/main/resources/application.properties`
- `frontend/src/utils/dateTime.js`
- Entity booking:
  - `BookingRoom.java`
  - `BookingCar.java`

#### Vấn đề hiện tại

Booking dùng `LocalDateTime`. Nếu timezone giữa browser/backend/container/DB lệch, lịch có thể sai giờ.

#### Hướng chỉnh sửa

- Set `TZ=Asia/Ho_Chi_Minh` cho backend và DB container.
- Kiểm tra JDBC timezone.
- Chuẩn hóa parse/format ở `frontend/src/utils/dateTime.js`.
- Với dài hạn, cân nhắc `Instant` hoặc `OffsetDateTime` cho dữ liệu thời gian quan trọng.

#### Test cần chạy

- Tạo booking lúc 08:00 trên desktop.
- Xem lại trên mobile.
- Xem DB raw value.
- Restart container và kiểm tra lại giờ.
- Test booking sát nửa đêm.

---

## 1.3 Kết quả mong muốn Phase 1

- User không thể giả danh requester.
- JWT/CORS rõ ràng.
- Production env đủ để chạy auth/mail/push.
- Timezone nhất quán.
- PWA push có điều kiện chạy được trên domain HTTPS.

---

# Phase 2: Tối ưu Calendar/API performance

## 2.1 Mục tiêu

Giảm tải khi calendar có nhiều booking.

Hiện tại flow calendar xe:

```text
CarBooking.jsx
→ bookingApi.getCarBookings()
→ GET /api/v1/bookings/cars
→ BookingCarService.getAllBookings()
→ bookingCarRepository.findAll()
→ frontend filter/render toàn bộ
```

Rủi ro tương tự với room calendar.

---

## 2.2 Việc cần chỉnh sửa

### 2.2.1 Thêm API load booking theo range ngày

#### File liên quan

Frontend:

- `frontend/src/api/bookingApi.js`
- `frontend/src/pages/RoomBooking.jsx`
- `frontend/src/pages/CarBooking.jsx`

Backend:

- `backend/src/main/java/com/booking/system/controller/BookingRoomController.java`
- `backend/src/main/java/com/booking/system/controller/BookingCarController.java`
- `backend/src/main/java/com/booking/system/service/BookingRoomService.java`
- `backend/src/main/java/com/booking/system/service/BookingCarService.java`
- `backend/src/main/java/com/booking/system/repository/BookingRoomRepository.java`
- `backend/src/main/java/com/booking/system/repository/BookingCarRepository.java`

#### Vấn đề hiện tại

- API list booking trả toàn bộ.
- Calendar không truyền `start/end`.
- Chuyển tháng/tuần/ngày không gọi API lại theo range.

#### Hướng chỉnh sửa

Backend nên hỗ trợ query params:

```text
GET /api/v1/bookings/rooms?start=...&end=...&roomId=...&status=...
GET /api/v1/bookings/cars?start=...&end=...&vehicleId=...&status=...
```

Frontend:

- Tính visible range theo calendar view.
- Khi đổi tháng/tuần/ngày, gọi lại API theo range.
- Chỉ giữ event của range hiện tại hoặc cache range gần nhất nếu cần.

#### Test cần chạy

- Mở calendar tháng hiện tại.
- Chuyển tháng sau.
- Chuyển tuần/ngày.
- Filter theo phòng/xe.
- Đảm bảo không mất event ở đầu/cuối range.

---

### 2.2.2 Memo hóa event filter/map ở calendar

#### File liên quan

- `frontend/src/pages/CarBooking.jsx`
- `frontend/src/pages/RoomBooking.jsx`

#### Vấn đề hiện tại

Trong `CarBooking.jsx`:

```text
filteredEvents = events.filter(...)
```

được tính lại mỗi render.

#### Hướng chỉnh sửa

- Dùng `useMemo` cho mapped events và filtered events.
- Tránh tạo object/function không cần thiết truyền vào `Calendar`.
- Với dữ liệu lớn, chỉ render event trong range hiện tại.

#### Test cần chạy

- Dùng React DevTools Profiler.
- Đổi selected car/room.
- Đổi view.
- Kiểm tra số lần render calendar/event component.

---

### 2.2.3 Responsive calendar view tốt hơn

#### File liên quan

- `frontend/src/pages/CarBooking.jsx`
- `frontend/src/pages/RoomBooking.jsx`
- `frontend/src/components/calendar/bookingCalendar.css`
- `frontend/src/index.css`
- `frontend/src/App.css`

#### Vấn đề hiện tại

`CarBooking.jsx` chọn view ban đầu bằng:

```text
window.innerWidth < 768 ? 'day' : 'week'
```

Nhưng không đổi khi resize/xoay màn hình.

#### Hướng chỉnh sửa

- Tạo responsive hook có cleanup listener.
- Mobile ưu tiên `day` hoặc agenda/list view.
- Kiểm tra touch target trong toolbar/calendar.
- Tránh layout ngang quá rộng trên iOS/Android.

#### Test cần chạy

- Android portrait/landscape.
- iPhone Safari/PWA.
- Tablet.
- Resize desktop browser.

---

## 2.3 Kết quả mong muốn Phase 2

- Calendar không còn load toàn bộ booking.
- Chuyển tháng/tuần/ngày nhanh hơn.
- Mobile calendar dễ dùng hơn.
- Frontend giảm render thừa.

---

# Phase 3: Tối ưu Backend/Database

## 3.1 Mục tiêu

Đảm bảo query booking/notification/push scale tốt khi dữ liệu tăng.

---

## 3.2 Việc cần chỉnh sửa

### 3.2.1 Thêm index cho overlap booking

#### File liên quan

- `backend/src/main/java/com/booking/system/repository/BookingRoomRepository.java`
- `backend/src/main/java/com/booking/system/repository/BookingCarRepository.java`
- Entity/table:
  - `booking_room`
  - `booking_car`

#### Query hiện tại

Room:

```text
room.id = :roomId
AND status IN ('PENDING', 'APPROVED')
AND startTime < :endTime
AND endTime > :startTime
```

Car:

```text
vehicle.id = :vehicleId
AND status IN ('PENDING', 'APPROVED')
AND startTime < :endTime
AND endTime > :startTime
```

#### Hướng chỉnh sửa

Cần index tương ứng:

```text
booking_room(room_id, status, start_time, end_time)
booking_car(vehicle_id, status, start_time, end_time)
```

Nếu dùng JPA auto schema chỉ cho dev, production nên dùng migration riêng.

#### Test cần chạy

- Explain query overlap.
- Tạo nhiều booking test.
- Đo thời gian tạo booking trùng/không trùng.
- Kiểm tra lock resource vẫn hoạt động.

---

### 3.2.2 Index notification

#### File liên quan

- `backend/src/main/java/com/booking/system/entity/Notification.java`
- `backend/src/main/java/com/booking/system/repository/NotificationRepository.java`

#### Query hiện tại

- `findByRecipientIdOrderByCreatedAtDesc`
- `findByRecipientIdAndIsReadFalseOrderByCreatedAtDesc`
- `countByRecipientIdAndIsReadFalse`
- `findUnreadSince`
- `existsByRecipientIdAndTypeAndSourceTypeAndSourceId`

#### Hướng chỉnh sửa

Index đề xuất:

```text
notification(recipient_id, created_at)
notification(recipient_id, is_read, created_at)
notification(recipient_id, type, source_type, source_id)
```

Nếu chống duplicate notification ở DB:

```text
unique(recipient_id, type, source_type, source_id)
```

Cần cân nhắc `source_type/source_id` null.

#### Test cần chạy

- Load notification page.
- Mark all as read.
- Count unread.
- Tạo nhiều notification song song cùng source.

---

### 3.2.3 Index/unique push subscription

#### File liên quan

- `backend/src/main/java/com/booking/system/entity/PushSubscription.java`
- `backend/src/main/java/com/booking/system/repository/PushSubscriptionRepository.java`
- `backend/src/main/java/com/booking/system/service/PushSubscriptionService.java`

#### Query hiện tại

- `findByEndpoint`
- `findByEndpointAndUserId`
- `findByUserIdAndIsActiveTrue`
- `findByUserIdOrderByLastSeenAtDescCreatedAtDesc`

#### Hướng chỉnh sửa

Index đề xuất:

```text
unique(push_subscription.endpoint)
push_subscription(user_id, is_active)
push_subscription(user_id, last_seen_at, created_at)
```

#### Test cần chạy

- Subscribe cùng thiết bị nhiều lần.
- Login user khác trên cùng browser.
- Disable notification.
- Push lỗi 410 deactivate subscription.

---

### 3.2.4 Trả DTO thay vì entity cho API booking

#### File liên quan

- `BookingRoomController.java`
- `BookingCarController.java`
- `BookingRoomService.java`
- `BookingCarService.java`
- Entity:
  - `BookingRoom.java`
  - `BookingCar.java`
  - `User.java`
  - `Room.java`
  - `Vehicle.java`

#### Vấn đề hiện tại

Một số API trả thẳng entity booking.

#### Rủi ro

- Dễ lộ field không cần thiết.
- Dễ kéo quan hệ JPA ngoài ý muốn.
- JSON lớn.
- Có nguy cơ vòng lặp serialize nếu mapping entity phức tạp.

#### Hướng chỉnh sửa

- Tạo DTO booking response riêng.
- Calendar API trả DTO nhẹ:
  - id.
  - title.
  - startTime.
  - endTime.
  - status.
  - resource id/name.
  - requester id/fullName/avatarUrl.
- Detail API mới trả dữ liệu đầy đủ hơn.

#### Test cần chạy

- Calendar vẫn render đủ thông tin.
- Booking detail vẫn hiển thị đủ.
- Admin approval vẫn hoạt động.

---

## 3.3 Kết quả mong muốn Phase 3

- Query booking/notification nhanh hơn.
- Ít rủi ro duplicate.
- JSON API gọn hơn.
- Backend dễ scale hơn.

---

# Phase 4: Tối ưu Notification, Mail, Push

## 4.1 Mục tiêu

Đảm bảo notification không làm chậm booking/approval và có khả năng vận hành ổn định.

---

## 4.2 Việc cần chỉnh sửa

### 4.2.1 Giữ event notification sau commit

#### File liên quan

- `backend/src/main/java/com/booking/system/event/NotificationEvent.java`
- `backend/src/main/java/com/booking/system/event/NotificationEventListener.java`
- `backend/src/main/java/com/booking/system/service/NotificationService.java`

#### Trạng thái hiện tại

Đang tốt:

```text
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
@Async
```

#### Hướng giữ nguyên

- Không đưa gửi mail/push trực tiếp vào transaction booking.
- Không rollback booking nếu mail/push fail.
- Log đủ context khi notification fail.

---

### 4.2.2 Tối ưu duplicate notification

#### File liên quan

- `NotificationService.java`
- `NotificationRepository.java`
- `Notification.java`

#### Vấn đề hiện tại

Service check duplicate bằng:

```text
existsByRecipientIdAndTypeAndSourceTypeAndSourceId(...)
```

#### Rủi ro

Nếu nhiều event song song, check app-level có thể không đủ.

#### Hướng chỉnh sửa

- Thêm unique constraint hoặc idempotency key ở DB.
- Nếu insert bị duplicate thì trả notification hiện có hoặc bỏ qua an toàn.
- Log ở mức debug/info, không log error nếu duplicate là hành vi mong muốn.

#### Test cần chạy

- Publish cùng event 2 lần.
- Concurrent approval/request.
- Đảm bảo chỉ có 1 notification cùng source.

---

### 4.2.3 Config frontend URL cho email

#### File liên quan

- `backend/src/main/java/com/booking/system/service/EmailService.java`
- `backend/src/main/resources/application.yml`
- `backend/src/main/resources/application.properties`
- `docker-compose.yml`
- `.env.example`

#### Vấn đề hiện tại

Email hard-code link:

```text
https://cfcbooking.io.vn/...
```

#### Rủi ro

- Local/staging/prod khác domain sẽ sai link.
- Deploy domain mới phải sửa code.

#### Hướng chỉnh sửa

- Thêm config:

```text
app.frontend-url=https://cfcbooking.io.vn
```

- Email build link từ config.
- `.env.example` ghi rõ biến tương ứng.

#### Test cần chạy

- Local email link trỏ local/staging đúng.
- Production email link trỏ domain production.
- Approve/reject/profile email đều đúng link.

---

### 4.2.4 Push retry/backoff nhẹ

#### File liên quan

- `PushService.java`
- `PushSubscriptionService.java`
- `NotificationEventListener.java`

#### Vấn đề hiện tại

- Push gửi tuần tự từng subscription.
- Không retry cho lỗi tạm thời.
- Có deactivate cho 404/410/403 là tốt.

#### Hướng chỉnh sửa

- Giữ cleanup subscription lỗi vĩnh viễn.
- Thêm retry giới hạn cho lỗi 5xx/network.
- Không retry 404/410/403.
- Có timeout rõ ràng nếu thư viện hỗ trợ.
- Nếu user có nhiều thiết bị, cân nhắc bounded executor hoặc queue.

#### Test cần chạy

- Mock push 201/410/500.
- 410 deactivate subscription.
- 500 retry giới hạn.
- User có nhiều thiết bị vẫn không block lâu.

---

### 4.2.5 Tối ưu frontend NotificationContext

#### File liên quan

- `frontend/src/contexts/NotificationContext.jsx`
- `frontend/src/contexts/NotificationContextCore.js`
- `frontend/src/contexts/useNotificationCenter.js`
- `frontend/src/pages/Notifications.jsx`
- `frontend/src/layouts/DashboardLayout.jsx`

#### Vấn đề hiện tại

Notification context chứa nhiều state và update realtime có thể gây re-render rộng.

#### Hướng chỉnh sửa

- Memo hóa value của provider.
- Tách context unread count và notification list nếu cần.
- Giữ list ngắn ở layout, load page đầy đủ ở page notification.
- Tránh gọi `getUnreadCount()` lặp nếu page response đã đủ dữ liệu hoặc backend có thể trả kèm.

#### Test cần chạy

- Realtime notification khi đang ở dashboard.
- Notification list page.
- Mark read/mark all.
- React Profiler kiểm tra re-render.

---

## 4.3 Kết quả mong muốn Phase 4

- Notification bền hơn.
- Email đúng domain.
- Push ít mất hơn khi lỗi tạm thời.
- Frontend ít re-render khi realtime notification.

---

# Phase 5: Tối ưu PWA Android/iOS

## 5.1 Mục tiêu

PWA cài được và push hoạt động ổn trên Android/iOS.

---

## 5.2 Việc cần chỉnh sửa

### 5.2.1 Verify manifest/PWA config

#### File liên quan

- `frontend/vite.config.js`
- `frontend/index.html`
- `frontend/public/icons/*`
- `frontend/src/sw.js`

#### Cần kiểm tra/chỉnh

- `name`
- `short_name`
- `start_url`
- `scope`
- `display: standalone`
- `theme_color`
- `background_color`
- icons đủ size.
- maskable icons được khai báo đúng.
- service worker scope đúng.

#### Test cần chạy

- Lighthouse PWA.
- Chrome DevTools Application tab.
- Install trên Android.
- Add to Home Screen trên iOS.

---

### 5.2.2 Đảm bảo click notification navigate đúng route

#### File liên quan

- `frontend/src/sw.js`
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

#### Trạng thái hiện tại

`sw.js` gửi:

```text
client.postMessage({ type: 'NAVIGATE', url: targetUrl })
```

#### Vấn đề cần xác minh

App phải có listener nhận message và navigate route.

#### Hướng chỉnh sửa

- Nếu chưa có listener, thêm listener ở app entry/router layer.
- Nếu route cần auth, đảm bảo hết token thì redirect login hợp lý.
- Deep link approval/profile/booking phải đúng role.

#### Test cần chạy

- App đang mở, nhận push, click notification.
- App đang đóng, click notification.
- Token hết hạn, click notification.
- User thường click link admin.

---

### 5.2.3 iOS safe area và Add to Home Screen UX

#### File liên quan

- `frontend/src/hooks/usePushNotifications.js`
- `frontend/src/components/PushNotificationSettings.jsx`
- `frontend/index.html`
- `frontend/src/index.css`
- `frontend/src/App.css`
- `frontend/src/layouts/DashboardLayout.jsx`

#### Trạng thái hiện tại

`usePushNotifications.js` đã có logic:

- detect iOS.
- detect standalone.
- iOS chưa installed thì yêu cầu Add to Home Screen.

#### Hướng chỉnh sửa

- Kiểm tra `apple-touch-icon`.
- Kiểm tra viewport.
- Bổ sung safe-area CSS nếu layout bị che bởi notch/home indicator.
- UX hướng dẫn Add to Home Screen rõ hơn nếu cần.

#### Test cần chạy

- iPhone Safari chưa install.
- iPhone PWA đã install.
- iPhone có notch.
- Xoay màn hình.

---

### 5.2.4 Offline fallback

#### File liên quan

- `frontend/src/sw.js`
- `frontend/vite.config.js`

#### Vấn đề hiện tại

Service worker có precache nhưng chưa thấy offline fallback rõ.

#### Hướng chỉnh sửa

- Không cache API booking động nếu chưa có chiến lược invalidation.
- Có offline fallback cho navigation.
- Nếu offline, hiển thị thông báo dữ liệu có thể không mới.
- Tránh làm calendar dùng dữ liệu booking cũ mà user tưởng là mới.

#### Test cần chạy

- Tắt mạng rồi mở PWA.
- Reload route con.
- Tạo booking khi offline phải bị chặn hoặc có UX rõ.
- Bật mạng lại reload data.

---

## 5.3 Kết quả mong muốn Phase 5

- Android PWA install/push/click ổn.
- iOS PWA có hướng dẫn đúng.
- Không cache nhầm API booking động.
- Route notification hoạt động đúng.

---

# Phase 6: Docker/Deploy/Production hardening

## 6.1 Mục tiêu

Deploy ổn định và dễ vận hành.

---

## 6.2 Việc cần chỉnh sửa

### 6.2.1 Chuẩn hóa Docker Compose

#### File liên quan

- `docker-compose.yml`
- `cloudflared-config.yml`
- `.env.example`

#### Cần kiểm tra/chỉnh

- `restart` policy.
- `healthcheck` backend/db.
- volume DB.
- env JWT/mail/VAPID/CORS.
- timezone.
- network.
- logging.
- resource limit nếu chạy VPS nhỏ.
- không commit secret.

#### Test cần chạy

- `docker compose up -d`.
- Restart container.
- DB data còn sau restart.
- Backend health OK.
- Frontend gọi backend OK.

---

### 6.2.2 Frontend production routing

#### File liên quan

- `frontend/vite.config.js`
- `Dockerfile` nếu có
- `nginx.conf` nếu có
- deploy config hiện tại

#### Vấn đề cần kiểm tra

Nếu dùng SPA React, refresh route như `/admin/approvals/123` không được 404.

#### Hướng chỉnh sửa

Nếu dùng Nginx:

```text
try_files $uri $uri/ /index.html;
```

Nếu dùng static hosting khác, cần rewrite tương đương.

#### Test cần chạy

- Refresh `/rooms`.
- Refresh `/cars`.
- Refresh `/admin/approvals`.
- Refresh deep link từ push notification.

---

### 6.2.3 Cloudflare/HTTPS/PWA

#### File liên quan

- `cloudflared-config.yml`
- DNS/domain config
- `docker-compose.yml`
- `frontend/vite.config.js`
- `frontend/src/hooks/usePushNotifications.js`

#### Cần đảm bảo

- Domain HTTPS hợp lệ.
- Backend API URL đúng.
- CORS cho domain đúng.
- Service worker served từ same origin frontend.
- Push permission chỉ hoạt động trên secure context.

#### Test cần chạy

- Chrome DevTools: secure context true.
- Service worker registered.
- Push subscription thành công.
- API không bị CORS.

---

## 6.3 Kết quả mong muốn Phase 6

- Docker deploy ổn định.
- SPA route refresh không lỗi.
- HTTPS/CORS/PWA đúng production.
- Env rõ ràng, không hard-code secret/domain.

---

# Phase 7: Monitoring, Logging, Test

## 7.1 Mục tiêu

Giảm rủi ro regression và dễ debug lỗi production.

---

## 7.2 Việc cần chỉnh sửa

### 7.2.1 Backend tests cho booking/security

#### File liên quan

- `backend/src/test/java/com/booking/system/`
- `BookingRoomService.java`
- `BookingCarService.java`
- `ApprovalService.java`
- `NotificationService.java`

#### Test nên có

- Tạo booking hợp lệ.
- Start >= end bị reject.
- Booking overlap bị reject.
- Booking không overlap được tạo.
- User không giả requesterId.
- Approval chuyển status đúng.
- Notification event không rollback booking.

---

### 7.2.2 Frontend test/build/lint

#### File liên quan

- `frontend/package.json`
- `frontend/src/pages/RoomBooking.jsx`
- `frontend/src/pages/CarBooking.jsx`
- `frontend/src/contexts/NotificationContext.jsx`
- `frontend/src/hooks/usePushNotifications.js`

#### Test nên có

- Build production.
- Lint.
- Calendar render với event list lớn.
- Push unsupported browser.
- iOS not standalone message.
- Notification mark read.

---

### 7.2.3 Logging production

#### File liên quan

- `EmailService.java`
- `PushService.java`
- `NotificationEventListener.java`
- `AuthService.java`
- `JwtAuthFilter.java`
- logging config nếu có

#### Cần log đủ

- notification type.
- sourceType/sourceId.
- recipientId.
- push subscription id.
- mail recipient domain hoặc email nếu policy cho phép.

#### Không được log

- JWT token.
- password.
- VAPID private key.
- SMTP password.
- full Authorization header.

---

## 7.3 Kết quả mong muốn Phase 7

- Có test baseline cho booking/security.
- Build frontend/backend ổn.
- Log đủ để debug mail/push/notification.
- Không lộ secret trong log.

---

# 8. Bảng tổng hợp việc nên chỉnh sửa

| Priority | Vị trí | Việc cần chỉnh | Tác động | Phase |
|---|---|---|---|---|
| Critical | `BookingRoomService.java`, `BookingCarService.java` | Không tin `requesterId` từ client | Chặn giả danh user | Phase 1 |
| Critical | `SecurityConfig.java`, `WebConfig.java` | Review CORS/public endpoint | Giảm rủi ro lộ API | Phase 1 |
| Critical | `docker-compose.yml`, env | Chuẩn hóa JWT/Mail/VAPID/Timezone | Production ổn định | Phase 1 |
| High | `BookingRoomController.java`, `BookingCarController.java` | API booking theo range | Calendar scale tốt | Phase 2 |
| High | `RoomBooking.jsx`, `CarBooking.jsx` | Fetch calendar theo visible range | Giảm network/render | Phase 2 |
| High | DB booking tables | Thêm index overlap | Tăng tốc check trùng lịch | Phase 3 |
| High | `EmailService.java` | Bỏ hard-code domain | Email đúng local/staging/prod | Phase 4 |
| High | `NotificationService.java` | Chống duplicate bằng DB/idempotency | Tránh notification trùng | Phase 4 |
| Medium | `PushService.java` | Retry/backoff push | Tăng độ tin cậy push | Phase 4 |
| Medium | `NotificationContext.jsx` | Giảm re-render context | UX mượt hơn | Phase 4 |
| Medium | `frontend/src/sw.js` | Verify navigate message/offline fallback | PWA tốt hơn | Phase 5 |
| Medium | `vite.config.js`, `index.html` | Verify manifest/iOS icon/safe-area | Android/iOS ổn hơn | Phase 5 |
| Medium | Docker/Nginx config | SPA route fallback | Deep link không 404 | Phase 6 |
| Medium | Tests/logging | Bổ sung test & log | Dễ vận hành | Phase 7 |

---

# 9. Checklist thực hiện theo thứ tự

## Blocker trước khi production

- [ ] Backend không còn tin `requesterId` từ request body.
- [ ] CORS chỉ allow domain hợp lệ.
- [ ] JWT secret/expiry lấy từ env.
- [ ] Mail/VAPID env đầy đủ.
- [ ] Timezone backend/DB/container thống nhất.
- [ ] PWA chạy trên HTTPS.

## Calendar/API

- [ ] Backend hỗ trợ booking range API.
- [ ] Frontend calendar fetch theo range.
- [ ] Chuyển month/week/day gọi API đúng.
- [ ] Filter room/car không render toàn bộ không cần thiết.
- [ ] Mobile calendar view ổn.

## Database

- [ ] Index overlap booking room.
- [ ] Index overlap booking car.
- [ ] Index notification recipient/read/createdAt.
- [ ] Unique/index notification source nếu cần.
- [ ] Unique endpoint push subscription.

## Notification/Mail/Push

- [ ] Email URL lấy từ config.
- [ ] Push cleanup 410/403/404 giữ nguyên.
- [ ] Push retry giới hạn cho lỗi tạm thời.
- [ ] Notification duplicate xử lý an toàn.
- [ ] Frontend notification context giảm re-render.

## PWA/Mobile

- [ ] Manifest đủ field.
- [ ] Maskable icons khai báo đúng.
- [ ] iOS Add to Home Screen UX rõ.
- [ ] iOS safe-area ổn.
- [ ] Notification click navigate đúng route.
- [ ] Offline fallback không cache nhầm API booking.

## Deploy/Test

- [ ] Docker Compose có restart/healthcheck/volume.
- [ ] SPA route refresh không 404.
- [ ] Backend tests cho booking/security.
- [ ] Frontend build/lint pass.
- [ ] Manual push test Android/iOS.
- [ ] Log không lộ secret.

---

# 10. Các việc không nên làm ngay

Các việc sau chưa nên làm trong giai đoạn đầu nếu chưa có yêu cầu rõ:

- Không thay toàn bộ kiến trúc notification.
- Không chuyển ngay sang microservice.
- Không đưa mail/push vào transaction booking.
- Không thay database nếu MySQL hiện tại vẫn đáp ứng.
- Không thêm Redis/queue nếu chưa có bằng chứng tải lớn; có thể để phase sau.
- Không refactor toàn bộ frontend state management nếu chỉ cần tối ưu context nhỏ.
- Không cache API booking trong service worker nếu chưa có chiến lược invalidation rõ.

---

# 11. Gợi ý thứ tự triển khai ngắn gọn

Nếu chỉ có thời gian làm ít việc trước, nên làm theo thứ tự:

1. Fix `requesterId` lấy từ JWT.
2. Chuẩn hóa env/CORS/VAPID/timezone.
3. Thêm booking range API.
4. Sửa calendar frontend fetch theo range.
5. Thêm index DB cho booking overlap.
6. Bỏ hard-code email domain.
7. Thêm unique/index cho notification và push subscription.
8. Tối ưu NotificationContext.
9. Verify PWA manifest/SW/iOS.
10. Bổ sung test booking/security.

---

# 12. File nên đọc trước khi code từng phase

## Phase 1

- `backend/src/main/java/com/booking/system/config/SecurityConfig.java`
- `backend/src/main/java/com/booking/system/security/JwtAuthFilter.java`
- `backend/src/main/java/com/booking/system/controller/BookingRoomController.java`
- `backend/src/main/java/com/booking/system/controller/BookingCarController.java`
- `backend/src/main/java/com/booking/system/service/BookingRoomService.java`
- `backend/src/main/java/com/booking/system/service/BookingCarService.java`
- `frontend/src/pages/CreateRoomBooking.jsx`
- `frontend/src/pages/CreateCarBooking.jsx`

## Phase 2

- `frontend/src/pages/RoomBooking.jsx`
- `frontend/src/pages/CarBooking.jsx`
- `frontend/src/api/bookingApi.js`
- `backend/src/main/java/com/booking/system/controller/BookingRoomController.java`
- `backend/src/main/java/com/booking/system/controller/BookingCarController.java`
- `backend/src/main/java/com/booking/system/repository/BookingRoomRepository.java`
- `backend/src/main/java/com/booking/system/repository/BookingCarRepository.java`

## Phase 3

- `BookingRoom.java`
- `BookingCar.java`
- `Notification.java`
- `PushSubscription.java`
- `BookingRoomRepository.java`
- `BookingCarRepository.java`
- `NotificationRepository.java`
- `PushSubscriptionRepository.java`

## Phase 4

- `NotificationEvent.java`
- `NotificationEventListener.java`
- `NotificationService.java`
- `EmailService.java`
- `PushService.java`
- `PushSubscriptionService.java`
- `frontend/src/contexts/NotificationContext.jsx`

## Phase 5

- `frontend/src/sw.js`
- `frontend/src/hooks/usePushNotifications.js`
- `frontend/src/components/PushNotificationSettings.jsx`
- `frontend/vite.config.js`
- `frontend/index.html`
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

## Phase 6

- `docker-compose.yml`
- `cloudflared-config.yml`
- `.env.example`
- `Dockerfile` nếu có
- `nginx.conf` nếu có
- `frontend/vite.config.js`

## Phase 7

- `backend/src/test/java/com/booking/system/`
- `frontend/package.json`
- `backend/pom.xml`

---

# 13. Kết luận

Dự án hiện có nền tảng tốt:

- Booking có transaction.
- Có kiểm tra overlap.
- Có lock resource.
- Notification/mail/push được tách sau commit.
- PWA push flow đã có service worker và subscription.
- Notification API đã có pagination.

Nhưng trước production hoặc trước khi scale, nên ưu tiên:

1. **Fix bảo mật requesterId.**
2. **Không load toàn bộ booking cho calendar.**
3. **Thêm index database cho overlap/notification/push.**
4. **Chuẩn hóa env/CORS/VAPID/timezone.**
5. **Bỏ hard-code domain trong email.**
6. **Tối ưu PWA Android/iOS và notification click.**
7. **Bổ sung test/logging cho booking/security/notification.**