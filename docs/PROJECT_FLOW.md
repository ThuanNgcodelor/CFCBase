# Luồng Dự Án BookingBase

Cập nhật: 2026-07-24

File này mô tả flow nghiệp vụ hiện tại bằng tiếng Việt. Giữ nguyên thuật ngữ kỹ thuật như `JWT`, `DTO`, `WebSocket`, `Service Worker`, `PWA`, `Redis`, `range-based fetch`.

## 1. Login, Register, Forgot Password

Login:
1. Frontend gửi email/password tới `POST /api/v1/auth/login`.
2. Backend validate user, password và status.
3. Backend trả access token, refresh token và user info.
4. Frontend lưu token/user vào cookie.
5. Protected route kiểm tra token; nếu hết access token nhưng còn refresh token thì gọi silent refresh.

Google login đang ẩn trên UI. Existing account vẫn phải `ACTIVE`; Google user mới không được tự tạo để bỏ qua OTP/Admin approval.

Register OTP:
1. User gửi email tới `/api/v1/auth/register/request-otp`.
2. Backend tạo OTP và lưu Redis TTL.
3. Backend gửi email OTP.
4. User verify qua `/api/v1/auth/register/verify`, đồng thời nhập họ tên và mật khẩu.
5. Backend tạo user `PENDING_APPROVAL` và thông báo cho Admin.
6. Admin duyệt/từ chối ở `/admin/users?tab=pending`.
7. User nhận email kết quả; chỉ `ACTIVE` mới login được.

Forgot password OTP:
1. User gửi email tới `/api/v1/auth/forgot-password/request-otp`.
2. Backend gửi OTP nếu email tồn tại.
3. User reset password qua `/api/v1/auth/forgot-password/reset`.

Register/Forgot UI đều nhắc kiểm tra Spam/Thư rác khi chưa thấy OTP.

Session:
- Access token mặc định 8 giờ.
- Refresh token 90 ngày và tách session/device bằng `refreshToken:{email}:{sessionId}`.
- Frontend silent-refresh để duy trì login PWA iOS/Android.

Quy tắc:
- Không đổi login/profile flow nếu task không yêu cầu.
- Token/refresh token phải được xử lý nhất quán.

## 2. Tạo Room Booking

1. User mở `/rooms`.
2. Frontend load rooms bằng `resourceApi.getRooms`.
3. Calendar fetch bookings theo visible range.
4. User chọn slot hoặc bấm create.
5. Frontend gửi booking request.
6. Backend lấy requester từ `@AuthenticationPrincipal`.
7. Backend validate thời gian và resource.
8. Backend lock room trước overlap check.
9. Nếu không overlap, tạo booking `PENDING`.
10. Sau commit, publish notification/email/push cho approver.

Không được:
- Tin `requesterId` từ request body.
- Bỏ validation `startTime < endTime`.
- Bỏ overlap check.

## 3. Tạo Car Booking

Luồng tương tự room booking:
1. User mở `/cars`.
2. Frontend load vehicles.
3. Calendar fetch bookings theo visible range.
4. User tạo booking xe.
5. Backend lấy requester từ principal.
6. Backend lock vehicle trước overlap check.
7. Tạo booking `PENDING`.
8. Dispatch notification/email/push sau commit.

Car event title có thể lấy từ title hoặc route `departure - destination`.

## 4. Overlap Check

Overlap logic chuẩn:

```text
existing.start < new.end
AND
existing.end > new.start
```

Blocking statuses:
- `PENDING`
- `APPROVED`

Room/vehicle phải được lock trước overlap check nếu chưa có giải pháp tương đương đã chứng minh.

## 5. Approve Hoặc Reject Booking

1. Approver mở approval list hoặc booking detail.
2. Approver approve/reject.
3. Reject reason là optional; legacy `note` vẫn được backend nhận để backward compatibility.
4. Backend lấy approver từ `@AuthenticationPrincipal`.
5. Approve cho `ADMIN` hoặc `MANAGER`; reject theo flow hiện tại chỉ `ADMIN`.
6. Backend ignore `approverId` từ body.
7. Backend lưu `ApprovalStep` với approver thật và reason.
8. Booking status chuyển `APPROVED` hoặc `REJECTED`.
9. Dispatch notification/email/push cho requester sau commit.

Reject reason phải hiển thị được ở booking detail.

## 6. Cancel Booking

Admin có thể hủy booking đã `APPROVED` tại trang chi tiết bằng hộp xác nhận, không yêu cầu nhập lý do.

Luồng cancel giữ nguyên các quy tắc bảo mật:
- Canceller phải lấy từ authenticated principal.
- Không tin `cancellerId` từ request body.
- Cần preserve status/cancel reason.
- Notification sau cancel không được rollback transaction nếu mail/push fail.

Nếu chạm cancel flow, thêm test chống giả mạo user.

## 7. Load Calendar

Frontend calendar:
1. Tính visible range theo view `month`, `week`, `day`.
2. Fetch bookings theo `start`, `end`, resource filter và status filter.
3. Dùng `AbortController` để hủy request cũ.
4. Dùng request sequence guard để stale response không ghi đè state mới.
5. Dùng `useMemo` cho event mapping/filter.
6. Calendar responsive theo resize/orientation.

Màu event:
- Event quá khứ: màu xám/lịch sử.
- Pending quá hạn: màu cảnh báo.
- Approved hiện tại/tương lai: màu chính.
- Pending tương lai: màu chờ duyệt.

Không để notification list update làm Calendar render lại nếu không liên quan.

## 8. Admin Approval List Và Booking Detail

Admin approval/history list:
- Hiển thị và phân trang booking đã xử lý; có filter/sort/status/type/keyword.
- Không dùng dữ liệu mẫu cho người duyệt.

Booking detail:
- Load booking detail.
- Load approval steps.
- Hiển thị approver thật, role/department nếu có.
- Hiển thị reject/approve reason.
- Cho phép approve nếu user là `ADMIN`/`MANAGER`; reject và cancel approved booking chỉ cho `ADMIN` theo flow hiện tại.

## 9. Notification Database

Database notification là `Source of Truth`.

Notification nên có:
- recipient.
- sender.
- type.
- title/message.
- targetUrl.
- sourceType/sourceId.
- read state.

Idempotency:
- Tránh duplicate notification theo source type/source id/event.
- Không rollback business transaction vì notification side effect fail.

Deep link:
- Booking pending mở `/admin/approvals/{id}`.
- Profile request mở `/admin/profile-approvals/{id}`.
- Account registration mở `/admin/users?tab=pending`.
- Resolver dùng `type/sourceType/sourceId`, không đoán theo title.

Schema hiện tại dùng `notifications.type VARCHAR(64)` và `source_type VARCHAR(64)` để NotificationType mới không bị MySQL ENUM cũ từ chối.

## 10. Realtime Qua WebSocket

1. Frontend tạo STOMP client qua SockJS.
2. CONNECT gửi JWT trong header.
3. Backend WebSocket/STOMP phải validate JWT.
4. Client subscribe `/user/queue/notifications`.
5. Khi nhận realtime notification:
   - upsert notification list.
   - tăng unread count nếu chưa đọc.
   - hiện toast.
6. Nếu parse lỗi hoặc STOMP error, refresh unread count.

Provider value đã memo hóa; subscription có cleanup.

## 11. Email

Email là kênh độc lập/fallback.

Rule:
- Email gửi async.
- Email fail chỉ log, không rollback booking.
- Không đưa email vào booking transaction.
- Link email lấy từ `app.frontend-url` / `${FRONTEND_URL}`.
- Không log SMTP password hoặc secret.
- Tất cả mail dùng chung responsive `EmailTemplateService`.
- Mail booking có resource, địa điểm/hành trình, ngày và giờ bắt đầu-kết thúc.

## 12. Web Push

Subscribe:
1. Frontend lấy VAPID public key.
2. Browser tạo PushSubscription.
3. Frontend gửi endpoint, p256dh, auth, device info lên backend.

Send:
1. Backend tạo payload.
2. Backend gửi Web Push tới active subscriptions.
3. Retry giới hạn cho network/408/429/5xx.
4. 403/404/410 deactivate subscription và không retry.

PWA:
- Required notification gate chỉ áp dụng khi app chạy dạng installed PWA trên Android/iOS.
- Web không thể tự bật permission nếu user đã block; user phải bật lại trong Settings.
- Người chưa từng login chưa có subscription gắn user; registration push được gửi cho active Admin devices, còn applicant nhận UI/email.

## 13. Scheduler Reminder/Completed

Chưa phải trọng tâm hiện tại. Nếu thêm scheduler:
- Không spam notification/email.
- Phải idempotent.
- Phải có sourceType/sourceId.
- Phải test timezone.

## 14. Docker Và Deploy

Production Fedora hiện tại:
- `deployserver/linux/build-prod.sh`: build frontend + package backend JAR + Web Push smoke test.
- `deployserver/linux/run.sh`: start DB/Redis, backend systemd unit, health-check, rồi tunnel.
- `deployserver/linux/stop-prod.sh`: stop production.
- Windows scripts vẫn được giữ để tương thích.

Docker:
- MySQL/Redis được constrain để giảm RAM.
- Adminer không start mặc định trong production script.

Database backup:
- `bookingbase-backup.timer` chạy vào phút `05` mỗi giờ và giữ 24 bản gần nhất.
- Dump chứa toàn bộ schema/data/triggers/routines/events, được gzip và validate trước atomic rename.
- Restore tạo backup khẩn cấp, yêu cầu xác nhận `RESTORE`, rồi import toàn bộ database.
- Chi tiết vận hành xem `docs/DATABASE_BACKUP.md`.

Cloudflare:
- Web/API đều trỏ backend `8080`.
- Spring Boot serve SPA static files.
- Deep link refresh không 404 nhờ `SpaForwardController`.

## 15. Phân Hệ HR Cho Manager

Security và domain:

- Chỉ `MANAGER` đang `ACTIVE` truy cập `/manager/hr` và `/api/v1/hr/**`.
- `ADMIN`/`EMPLOYEE` nhận `403`; thiếu token nhận `401`.
- Employee HR không phải User và không có `user_id`; authenticated User chỉ được dùng để tạo actor audit dạng chuỗi.

Baseline:

1. Upload workbook chuẩn chỉ tạo staging/preview.
2. Validate trước khi confirm; `#N/A` không được insert như dữ liệu nghiệp vụ.
3. Baseline production hiện dùng artifact hiệu chỉnh, confirm tạo nguyên tử 339 Employee, 339 `INITIAL_LOAD` và roster `T6-26` đã `CLOSED`.
4. `T6-26` là baseline bất biến; không reopen/delete.

Baseline hiệu chỉnh T6-26 = 339:

1. Chỉ nhận `workforce-baseline-339-2026.xlsx` có SHA-256 `e35f22c83f5dacb542c7b3cff76238fcbaf8ac22f7e85b786d62d2c1de6cf6f7`; không nhận trực tiếp file nguồn `Baseline-value-339-2026.xlsx`.
2. Workbook có ba sheet visible `TĂNG`, `GIẢM`, `T6-26`; sheet T6 có 339 dòng.
3. Chỉ import khi HR trống. Confirm tạo nguyên tử 339 Employee `ACTIVE`, 339 `INITIAL_LOAD` và `T6-26 CLOSED` 339 item.
4. Không tự tạo Tăng/Giảm, không tạo `T7-26` và không tạo hồ sơ nghỉ việc giả.
5. Preview chặn trạng thái có dữ liệu HR; G083 để trống CCCD chờ xác minh.
6. Đây là baseline khóa cho dữ liệu 2026, không phải generic bulk import của Phase 6.

Tăng/Giảm:

1. Tăng bắt đầu bằng Employee `DRAFT`; Giảm chọn Employee `ACTIVE` và phải có lý do.
2. Tạo movement ở `DRAFT` với ngày hiệu lực và idempotency key.
3. Manager kiểm tra rồi confirm hoặc cancel; confirm không được trước ngày hiệu lực.
4. Confirm Tăng chuyển hồ sơ sang `ACTIVE`; confirm Giảm chuyển sang `INACTIVE` và ghi ngày nghỉ việc.
5. Movement `CONFIRMED` không sửa/cancel/hard-delete; correction phải dùng nghiệp vụ bù được thiết kế riêng.

Danh sách tháng:

1. Chỉ tạo tháng liền sau roster mới nhất đã `CLOSED/EXPORTED`.
2. `DRAFT -> OPEN`: kế thừa kỳ nguồn và áp dụng movement confirmed đến cuối tháng đích.
3. `OPEN -> CLOSED`: dựng lại snapshot để nhận movement vừa xác nhận, đánh lại STT liên tục và tạo checksum.
4. Kỳ `CLOSED` chỉ reopen khi không phải baseline, chưa export, chưa có tháng sau và có lý do.
5. Movement xác nhận muộn không sửa snapshot cũ; nó được áp dụng vào kỳ kế tiếp chưa chốt.

Hard-delete chỉ áp dụng cho Employee/movement/roster `DRAFT` tạo tay và chưa có reference. Snapshot không chứa CCCD, BHXH/BHYT, địa chỉ, điện thoại hoặc lương. Chi tiết tại `docs/HR_PHASE_5_WORKFORCE_MONTHLY.md`; flow file khóa 339 tại `docs/HR_WORKFORCE_IMPORT_339.md`.

Chi tiết hồ sơ HR trả đầy đủ CCCD/CMND, BHXH/BHYT, liên hệ và lương/phụ cấp cho `MANAGER` để tra cứu/chỉnh sửa hồ sơ. Danh sách tháng và audit metadata vẫn không sao chép các giá trị nhạy cảm này; riêng export Excel Phase 6 có thể join lại hồ sơ Employee để xuất đúng template đầy đủ cho `MANAGER`.
