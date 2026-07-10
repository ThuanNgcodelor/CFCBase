# Kế hoạch triển khai Login thuần Email + OTP cho BookingBase

## 1. Mục tiêu

Chuyển hệ thống đăng nhập từ phụ thuộc Google Login sang cơ chế đăng nhập thuần bằng Email/Mật khẩu để tránh lỗi Safari/iOS/PWA khi xác thực Google.

Yêu cầu chính:

- Ẩn hoặc loại bỏ nút đăng nhập Google ở màn hình Login.
- Giữ nguyên chức năng profile hiện tại, không thay đổi luồng cập nhật hồ sơ.
- Người dùng ngoài hệ thống có thể đăng ký bằng Email.
- Đăng ký phải xác thực OTP qua Email.
- Quên mật khẩu phải xác thực OTP qua Email.
- Admin có nơi tạo account mới bằng Email.
- Password khi Admin tạo account là một dãy số tự nhập/dùng chung theo nhu cầu vận hành.
- Không phá cấu trúc hiện tại của hệ thống Booking, Booking Room, Booking Car, Approval, Profile.

---

## 2. Hướng triển khai tổng thể

### 2.1. Frontend

Các màn hình cần thay đổi/thêm:

1. `frontend/src/pages/Login.jsx`
   - Ẩn Google Login.
   - Giữ form Email/Mật khẩu hiện tại.
   - Thêm link:
     - Đăng ký tài khoản
     - Quên mật khẩu
   - Không thay đổi logic profile sau login.

2. Thêm trang `Register.jsx`
   - Nhập Email.
   - Gửi OTP về Email.
   - Nhập OTP.
   - Nhập mật khẩu.
   - Hoàn tất đăng ký.
   - Sau đăng ký thành công chuyển về Login.

3. Thêm trang `ForgotPassword.jsx`
   - Nhập Email.
   - Gửi OTP về Email.
   - Nhập OTP.
   - Nhập mật khẩu mới.
   - Cập nhật mật khẩu.
   - Sau khi đổi mật khẩu thành công chuyển về Login.

4. Cập nhật `frontend/src/api/authApi.js`
   - Thêm API:
     - `requestRegisterOtp(email)`
     - `verifyRegisterOtp(...)`
     - `requestForgotPasswordOtp(email)`
     - `resetPasswordWithOtp(...)`

5. Cập nhật routing trong `frontend/src/App.jsx`
   - Thêm route:
     - `/register`
     - `/forgot-password`

6. Thêm khu vực Admin tạo tài khoản
   - Ưu tiên tích hợp vào trang quản lý user hiện có nếu đã có.
   - Nếu chưa có màn hình quản lý user riêng, tạo một mục nhỏ trong Admin Dashboard hoặc trang Admin Users.
   - Form gồm:
     - Email
     - Password dạng số dùng chung/tự nhập
     - Role mặc định hoặc chọn role nếu hệ thống đang hỗ trợ
     - Department nếu hệ thống yêu cầu

---

## 3. Backend

### 3.1. Các file cần khảo sát trước khi code

Cần đọc kỹ các file sau trước khi chỉnh sửa:

- `backend/src/main/java/com/booking/system/controller/AuthController.java`
- `backend/src/main/java/com/booking/system/service/AuthService.java`
- `backend/src/main/java/com/booking/system/entity/User.java`
- `backend/src/main/java/com/booking/system/repository/UserRepository.java`
- `backend/src/main/java/com/booking/system/controller/UserController.java`
- `backend/src/main/java/com/booking/system/config/SecurityConfig.java`
- `backend/src/main/java/com/booking/system/dto/LoginRequest.java`
- `backend/src/main/java/com/booking/system/dto/AuthResponse.java`
- `backend/src/main/java/com/booking/system/enums/RoleEnum.java`
- `backend/src/main/java/com/booking/system/enums/UserStatus.java`

Không tự tiện thay đổi mạnh `SecurityConfig.java` nếu không cần thiết.

---

## 4. API đề xuất

### 4.1. Đăng ký bằng OTP

#### Gửi OTP đăng ký

```http
POST /api/v1/auth/register/request-otp
```

Body:

```json
{
  "email": "user@company.com"
}
```

Xử lý:

- Kiểm tra email hợp lệ.
- Nếu email đã tồn tại thì báo lỗi.
- Sinh OTP 6 số.
- Lưu OTP vào Redis hoặc DB tạm.
- Gửi email chứa OTP.
- OTP hết hạn sau khoảng 5 phút.

#### Xác nhận OTP và tạo tài khoản

```http
POST /api/v1/auth/register/verify
```

Body:

```json
{
  "email": "user@company.com",
  "otp": "123456",
  "password": "123456"
}
```

Xử lý:

- Kiểm tra OTP đúng và còn hạn.
- Hash password bằng `PasswordEncoder`.
- Tạo user mới.
- Gán role mặc định là `CLIENT` hoặc role user thông thường hiện tại.
- Gán trạng thái active nếu hệ thống đang dùng `UserStatus`.
- Xoá OTP sau khi dùng.

---

### 4.2. Quên mật khẩu bằng OTP

#### Gửi OTP quên mật khẩu

```http
POST /api/v1/auth/forgot-password/request-otp
```

Body:

```json
{
  "email": "user@company.com"
}
```

Xử lý:

- Kiểm tra email tồn tại.
- Sinh OTP 6 số.
- Lưu OTP.
- Gửi email.
- Không trả thông tin nhạy cảm.

#### Đổi mật khẩu bằng OTP

```http
POST /api/v1/auth/forgot-password/reset
```

Body:

```json
{
  "email": "user@company.com",
  "otp": "123456",
  "newPassword": "654321"
}
```

Xử lý:

- Kiểm tra OTP đúng và còn hạn.
- Hash mật khẩu mới.
- Cập nhật password cho user.
- Xoá OTP sau khi dùng.
- Không thay đổi profile.

---

### 4.3. Admin tạo account

```http
POST /api/v1/admin/users
```

Hoặc nếu `UserController` đang dùng `/api/v1/users`, có thể dùng:

```http
POST /api/v1/users
```

Yêu cầu bảo vệ quyền:

- Chỉ `ADMIN` được gọi.

Body đề xuất:

```json
{
  "email": "staff@company.com",
  "password": "123456",
  "role": "CLIENT",
  "departmentId": 1
}
```

Xử lý:

- Kiểm tra email chưa tồn tại.
- Hash password.
- Tạo user.
- Trạng thái mặc định active.
- Không gửi OTP vì đây là account do Admin tạo.
- Có thể gửi email thông báo tài khoản đã được tạo nếu muốn.

---

## 5. OTP Storage

Ưu tiên dùng Redis vì project đã có dependency:

```xml
spring-boot-starter-data-redis
```

Key đề xuất:

- Đăng ký:
  - `otp:register:{email}`
- Quên mật khẩu:
  - `otp:forgot-password:{email}`

TTL:

- 5 phút.

Nội dung lưu:

```json
{
  "otp": "123456",
  "createdAt": "...",
  "attempts": 0
}
```

Có thể đơn giản hơn ở giai đoạn đầu:

- Lưu thẳng OTP string.
- Redis TTL tự xử lý hết hạn.

---

## 6. Mail Service

Project đã có:

```xml
spring-boot-starter-mail
```

Cần kiểm tra cấu hình mail hiện có trong `application.yml` hoặc biến môi trường.

Nên tạo service riêng:

```java
OtpMailService
```

Chức năng:

- `sendRegisterOtp(String email, String otp)`
- `sendForgotPasswordOtp(String email, String otp)`

Nội dung email nên ngắn gọn:

```text
Mã OTP của bạn là: 123456
Mã có hiệu lực trong 5 phút.
Không chia sẻ mã này cho người khác.
```

---

## 7. DTO cần thêm

Có thể thêm các DTO:

```java
RegisterOtpRequest
RegisterVerifyRequest
ForgotPasswordOtpRequest
ResetPasswordRequest
AdminCreateUserRequest
```

Ví dụ:

```java
public record RegisterOtpRequest(
    @Email @NotBlank String email
) {}
```

```java
public record RegisterVerifyRequest(
    @Email @NotBlank String email,
    @NotBlank String otp,
    @NotBlank String password
) {}
```

```java
public record ResetPasswordRequest(
    @Email @NotBlank String email,
    @NotBlank String otp,
    @NotBlank String newPassword
) {}
```

---

## 8. Bảo mật cần lưu ý

1. Không lưu password dạng plain text.
2. Password Admin nhập cũng phải hash.
3. OTP:
   - 6 số.
   - Hết hạn sau 5 phút.
   - Dùng xong xoá.
   - Nên giới hạn số lần nhập sai.
4. API gửi OTP nên có rate limit nếu sau này cần tăng bảo mật.
5. Không trả về lỗi quá chi tiết kiểu:
   - Email này có tồn tại/không tồn tại.
   - Tuy nhiên với hệ thống nội bộ, có thể chấp nhận thông báo rõ ràng để dễ vận hành.
6. Không thay đổi JWT/AuthResponse nếu không cần.
7. Không thay đổi profile flow.

---

## 9. Cách triển khai theo từng bước

### Bước 1: Khảo sát auth hiện tại

Đọc các file:

- `AuthController`
- `AuthService`
- `User`
- `UserRepository`
- `SecurityConfig`
- `authApi.js`
- `App.jsx`
- `Login.jsx`

Mục tiêu:

- Xác định endpoint login hiện tại.
- Xác định user đang có các field nào.
- Xác định role/status hiện tại.
- Xác định frontend đang lưu token như thế nào.

---

### Bước 2: Ẩn Google Login trước

Trong `Login.jsx`:

- Xoá import `GoogleLogin`.
- Xoá `handleGoogleSuccess`.
- Xoá `handleGoogleError`.
- Xoá block UI Google Login.
- Có thể giữ dependency `@react-oauth/google` tạm thời, chưa cần xoá khỏi package để tránh tác động rộng.

Kết quả:

- Màn Login chỉ còn Email/Mật khẩu.

---

### Bước 3: Thêm backend OTP

Thêm service:

- `OtpService`
- `OtpMailService`

Thêm endpoint trong `AuthController`:

- `/register/request-otp`
- `/register/verify`
- `/forgot-password/request-otp`
- `/forgot-password/reset`

Thêm DTO tương ứng.

---

### Bước 4: Thêm frontend đăng ký/quên mật khẩu

Thêm:

- `frontend/src/pages/Register.jsx`
- `frontend/src/pages/ForgotPassword.jsx`

Cập nhật:

- `frontend/src/api/authApi.js`
- `frontend/src/App.jsx`
- `frontend/src/pages/Login.jsx`

UI nên đơn giản, sạch, dùng Tailwind CSS v4 thuần:

- Card trắng.
- Border nhẹ.
- Button thống nhất component hiện tại.
- Không dùng giao diện lòe loẹt.

---

### Bước 5: Thêm Admin tạo account

Tùy cấu trúc hiện tại:

- Nếu đã có trang quản lý user: thêm form tạo user ở đó.
- Nếu chưa có: thêm trang `AdminUsers.jsx`.
- Thêm API ở `userApi.js`.
- Backend thêm endpoint trong `UserController` hoặc controller admin riêng.

Trường cần có:

- Email
- Password dạng số
- Role
- Department nếu bắt buộc

---

### Bước 6: Kiểm tra

Backend:

```bash
cd backend && ./mvnw test
```

Hoặc:

```bash
cd backend && ./mvnw clean package
```

Frontend:

```bash
cd frontend && npm run build
```

---

## 10. Những file dự kiến thay đổi

### Backend

Dự kiến thêm:

- `backend/src/main/java/com/booking/system/dto/RegisterOtpRequest.java`
- `backend/src/main/java/com/booking/system/dto/RegisterVerifyRequest.java`
- `backend/src/main/java/com/booking/system/dto/ForgotPasswordOtpRequest.java`
- `backend/src/main/java/com/booking/system/dto/ResetPasswordRequest.java`
- `backend/src/main/java/com/booking/system/dto/AdminCreateUserRequest.java`
- `backend/src/main/java/com/booking/system/service/OtpService.java`
- `backend/src/main/java/com/booking/system/service/OtpMailService.java`

Dự kiến sửa:

- `backend/src/main/java/com/booking/system/controller/AuthController.java`
- `backend/src/main/java/com/booking/system/service/AuthService.java`
- `backend/src/main/java/com/booking/system/controller/UserController.java`
- `backend/src/main/java/com/booking/system/repository/UserRepository.java` nếu thiếu method tìm email

Có thể cần sửa:

- `backend/src/main/java/com/booking/system/config/SecurityConfig.java`
  - Chỉ thêm permit public cho các endpoint OTP nếu endpoint mới bị chặn.
  - Không thay đổi cấu trúc security lớn.

### Frontend

Dự kiến thêm:

- `frontend/src/pages/Register.jsx`
- `frontend/src/pages/ForgotPassword.jsx`

Dự kiến sửa:

- `frontend/src/pages/Login.jsx`
- `frontend/src/api/authApi.js`
- `frontend/src/api/userApi.js`
- `frontend/src/App.jsx`

Có thể thêm:

- `frontend/src/pages/AdminUsers.jsx`

---

## 11. Thứ tự ưu tiên nên làm

1. Ẩn Google Login.
2. Đảm bảo login Email/Mật khẩu hiện tại vẫn chạy.
3. Thêm quên mật khẩu bằng OTP.
4. Thêm đăng ký bằng OTP.
5. Thêm Admin tạo account.
6. Kiểm tra không ảnh hưởng profile.
7. Build backend/frontend.

---

## 12. Ghi chú vận hành

Vì hệ thống nội bộ và có nhu cầu Admin tạo account bằng password số dùng chung:

- Nên cho Admin nhập password khi tạo user.
- Không hardcode password trong code.
- Có thể hiển thị cảnh báo nhỏ: "Mật khẩu này sẽ được mã hóa khi lưu."
- Nếu dùng password chung, nên yêu cầu user đổi mật khẩu sau này, nhưng giai đoạn đầu có thể chưa cần.

---

## 13. Kết luận

Giải pháp phù hợp nhất cho BookingBase hiện tại là chuyển sang Email/Mật khẩu + OTP qua Email. Cách này ổn định hơn cho Safari, iOS và PWA, không phụ thuộc popup/cookie/cross-site behavior của Google Login.

Triển khai nên làm theo hướng bổ sung auth flow mới, hạn chế đụng các module profile, booking, approval hiện có.