# Handoff sự cố Web Push/PWA

Cập nhật trạng thái: 2026-07-20 (nội dung điều tra gốc: 2026-07-15)

> Trạng thái: sự cố crypto đã được xử lý và production Fedora hiện đang chạy JAR đã smoke-test. Backend/tunnel active, local/public HTTP 200. Tài liệu bên dưới giữ lại chi tiết incident lịch sử; các câu lệnh Windows là bối cảnh tại thời điểm 15/07. Luồng deploy hiện tại xem `CURRENT_WORK_STATUS.md` và `deployserver/linux/`.

## 1. Trạng thái hiện tại

Hai sự cố `InvalidKeyException: Not an EC key: ECDH` và `JCE cannot authenticate the provider BC` đã được sửa trong source và production artifact.

Production JAR mới đã được build tại:

```text
backend/target/booking-system-0.0.1-SNAPSHOT.jar
```

Artifact ngày 15/07 đã được thay thế bởi các production JAR mới hơn. Fedora/Linux hiện dùng `deployserver/linux/build-prod.sh` và `deployserver/linux/run.sh`.

Không sửa hoặc rollback thay đổi riêng của người dùng trong:

```text
backend/src/main/java/com/booking/system/config/DataSeeder.java
```

## 2. Nguyên nhân gốc

### Lỗi ECDH trên iOS và Android

`web-push 5.1.2` tạo EC key bằng Bouncy Castle nhưng hai vị trí trong `HttpEce` gọi:

```java
KeyAgreement.getInstance("ECDH")
```

Trong runtime thực tế, JCA resolve lời gọi này về SunEC. SunEC không nhận private key implementation của Bouncy Castle và ném:

```text
InvalidKeyException: Not an EC key: ECDH
```

Lỗi xảy ra khi backend mã hóa payload, trước khi request được gửi tới Apple/Google push endpoint. Vì vậy đây không phải lỗi riêng của subscription iOS hay Android.

### Race condition khi subscribe

Backend cũ dùng `findByEndpoint()` rồi `save()`. Hai request subscribe đồng thời có thể cùng không thấy endpoint và cùng INSERT, dẫn đến unique constraint failure.

Việc catch `DataIntegrityViolationException` rồi query lại trong cùng transaction cũng không an toàn vì transaction có thể đã bị đánh dấu rollback-only.

### Retry quá rộng

Backend cũ có thể retry exception không tự phục hồi. Crypto/config/validation failure không nên retry; chỉ network, HTTP 408, 429 và 5xx mới được retry giới hạn.

## 3. Thay đổi đã triển khai

### Crypto

- Giữ `web-push 5.1.2` để giảm phạm vi thay đổi.
- Thêm bản vá tương thích có cùng FQCN `nl.martijndwars.webpush.HttpEce` và giữ nguyên MIT license của upstream.
- Cả hai thao tác ECDH đều chỉ định trực tiếp provider Bouncy Castle.
- Spring Boot Maven Plugin dùng `requiresUnpack` cho `bcprov-jdk18on`, vì signed JCE provider không thể được Java 23 xác thực khi nằm trực tiếp trong nested fat JAR.
- Không dùng global `jdk.security.provider.preferred`.
- Không đưa BC lên provider slot 1 và không fail-fast làm backend chết khi startup.
- Gửi payload bằng `Encoding.AES128GCM`.

### Subscription

- Đổi đăng ký endpoint sang MySQL `INSERT ... ON DUPLICATE KEY UPDATE` trong một statement nguyên tử.
- Endpoint cũ được cập nhật key, user, device info và active state.
- Không log endpoint, `p256dh`, `auth` hoặc VAPID private key.

### Retry

- Retry giới hạn cho `IOException`, network exception được wrap, HTTP 408, 429 và 5xx.
- Không retry crypto failure, exception không xác định, HTTP 403/404/410/413.
- `SecurityException`/`JarException` từ JCE provider được xem là permanent failure và không bị nhận nhầm thành network error.
- HTTP 403/404/410 deactivate subscription.
- Khôi phục interrupt flag và dừng retry khi thread bị interrupt.

## 4. File đã sửa

Backend runtime:

- `backend/src/main/java/com/booking/system/config/WebPushConfig.java`
- `backend/src/main/java/com/booking/system/repository/PushSubscriptionRepository.java`
- `backend/src/main/java/com/booking/system/service/PushService.java`
- `backend/src/main/java/com/booking/system/service/PushSubscriptionService.java`
- `backend/src/main/java/nl/martijndwars/webpush/HttpEce.java`
- `backend/pom.xml`
- `build-prod.bat`
- `deployserver/linux/build-prod.sh` (luồng production hiện tại)

Tests:

- `backend/src/test/java/com/booking/system/config/WebPushCryptoCompatibilityTest.java`
- `backend/src/test/java/com/booking/system/config/WebPushExecutableJarSmoke.java`
- `backend/src/test/java/com/booking/system/service/PushServiceTest.java`
- `backend/src/test/java/com/booking/system/service/PushSubscriptionServiceTest.java`

Frontend không cần sửa trong đợt này. `usePushNotifications.js` hiện đã gửi đúng `endpoint`, `p256dh`, `auth` và có single-flight guard trong module.

## 5. Kết quả kiểm chứng

### Backend

```text
.\mvnw.cmd test
Tests run: 29, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Test crypto cố tình ép generic `KeyAgreement("ECDH")` về SunEC, sau đó tạo VAPID/user key bằng BC và gọi `preparePost(..., AES128GCM)`. Payload vẫn mã hóa thành công.

JAR đã được kiểm tra có:

```text
BOOT-INF/classes/nl/martijndwars/webpush/HttpEce.class
BOOT-INF/classes/com/booking/system/service/PushService.class
BOOT-INF/classes/com/booking/system/repository/PushSubscriptionRepository.class
BOOT-INF/lib/web-push-5.1.2.jar
BOOT-INF/lib/bcprov-jdk18on-1.84.jar
```

Bytecode của `HttpEce.class` gọi:

```text
KeyAgreement.getInstance(String, Provider)
```

ở cả hai vị trí ECDH.

Smoke check đã chạy qua chính production fat JAR và pass:

```text
WEB_PUSH_EXECUTABLE_JAR_SMOKE_OK
provider=file:/.../Temp/.../bcprov-jdk18on-1.84.jar
```

Kết quả này xác nhận Spring Boot đã unpack BC ra file thật trước khi Java xác thực signed JCE provider.

Luồng hiện tại trên Fedora build vào staging, smoke-test fat JAR, giữ `.previous`, sau đó `deployserver/linux/run.sh` restart backend, health-check rồi mới start tunnel.

### Frontend

```text
npm.cmd run lint
Pass, còn 1 warning cũ tại CustomDateHeader.jsx

npm.cmd run build
Pass, còn warning main chunk lớn khoảng 750 kB
```

## 6. Việc cần test thủ công

Automated test không thể thay thế thiết bị thật. Sau khi deploy bằng Linux scripts:

1. iOS: mở installed PWA từ Home Screen, bật notification, tạo booking và approve/reject.
2. Android: bật notification, tạo booking và approve/reject.
3. Kiểm tra push khi app mở, chạy nền và đóng.
4. Kiểm tra notification click điều hướng đúng.
5. Theo dõi log không còn `Not an EC key: ECDH` hoặc `JCE cannot authenticate the provider BC`.
6. Xác nhận booking/approval vẫn thành công nếu cố tình làm push endpoint lỗi.

Subscription hiện có không cần xóa chỉ để sửa provider mismatch. Chỉ subscribe lại nếu endpoint đã bị trình duyệt thu hồi hoặc backend nhận HTTP 403/404/410.

## 7. Rủi ro và rollback

- `HttpEce` là bản shadow/fork nhỏ của class trong `web-push 5.1.2`. Khi nâng dependency Web Push phải so sánh upstream và bỏ bản shadow nếu upstream đã sửa provider mismatch.
- Atomic upsert dùng cú pháp MySQL, phù hợp database hiện tại nhưng không portable sang PostgreSQL/H2.
- Runtime hiện dùng Java 23 trong khi `pom.xml` target Java 21. Bản vá không dựa vào provider order nên đã test trên Java 23, nhưng production vẫn nên pin một JDK rõ ràng.
- `requiresUnpack` dùng thư mục `java.io.tmpdir`; hệ điều hành không được xóa file BC đã unpack trong lúc ứng dụng còn chạy.

Rollback theo phạm vi:

1. Revert các file backend runtime/build ở mục 4.
2. Xóa các test/smoke utility mới hoặc cập nhật ở mục 4.
3. Build lại JAR và restart có chủ đích.

Không rollback booking, approval, email, WebSocket, Calendar, login/profile hoặc `DataSeeder.java` để xử lý sự cố này.
