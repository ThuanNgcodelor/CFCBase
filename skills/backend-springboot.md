---
name: backend-springboot
description: Quy chuẩn thiết kế Backend, cấu trúc mã nguồn Spring Boot, xử lý Database (JPA) và luồng xác thực cho dự án BookingBase.
---

# Quy chuẩn Code Backend (Spring Boot + JPA)

Tài liệu này cung cấp cho AI ngữ cảnh quan trọng về kiến trúc Backend của hệ thống Booking, giúp AI không đi chệch hướng trong quá trình sinh code.

## 1. Công nghệ (Tech Stack)
- **Ngôn ngữ:** Java 21 (JDK 21). Bắt buộc tuân thủ cú pháp Java hiện đại (như Records nếu cần).
- **Framework:** Spring Boot 4.0.0.
- **Database & ORM:** MySQL 8, Spring Data JPA, Hibernate.
- **Cache & Session:** Redis (Sử dụng `RedisTemplate`).
- **Công cụ hỗ trợ:** Lombok (Bắt buộc dùng `@Getter`, `@Setter`, `@RequiredArgsConstructor` để code ngắn gọn).
- **Bảo mật:** Spring Security, JJWT, Google OAuth2 API.

## 2. Tiêu chuẩn Mã Nguồn (Code Convention)
- **Tên biến/Hàm/Lớp:** Tiếng Anh chuẩn (camelCase, PascalCase).
- **Bình luận (Comments):** BẮT BUỘC sử dụng Tiếng Việt, ngắn gọn trên đầu các hàm cốt lõi, endpoint Controller hoặc logic phức tạp.
- **Cấu trúc gói (Packages):**
  - `com.booking.system.config`: Các cấu hình hệ thống (Security, Redis, Cors).
  - `com.booking.system.controller`: Tầng API Endpoints (Nhận request và trả về `ResponseEntity`).
  - `com.booking.system.dto`: Object truyền dữ liệu (Request/Response). Luôn dùng DTO, KHÔNG bao giờ ném trực tiếp Entity ra ngoài.
  - `com.booking.system.entity`: Lớp Map với DB (Dùng `@Entity`). ID luôn dùng UUID (chuỗi string tự generate).
  - `com.booking.system.repository`: Tầng truy xuất DB.
  - `com.booking.system.service`: Tầng Business Logic. Business logic không bao giờ được nằm trên Controller.

## 3. Kiến trúc Cốt lõi (Domain Logic)
- **Response Format:** Bắt buộc sử dụng `ApiResponse<T>` chuẩn hoá:
  ```json
  {
    "status": 200,
    "message": "Thông báo thành công/thất bại (Tiếng Việt)",
    "data": { ... }
  }
  ```
- **Xử lý Xung đột (Concurrency):** Hệ thống Booking cực kỳ nhạy cảm với trùng lịch. BẮT BUỘC dùng Pessimistic Lock (`@Lock(LockModeType.PESSIMISTIC_WRITE)`) ở Repository khi thao tác đặt tài nguyên để chặn tình trạng Race Condition.
- **Authentication:** Tích hợp 2 luồng: Email/Password và Google OAuth2. JWT sinh ra gồm Access Token (sống ngắn) và Refresh Token (lưu vào Redis). 
- **Quyền hạn (Roles):** Dùng `RoleEnum` (ADMIN, EMPLOYEE). Phải check kỹ quyền hạn trước khi thao tác xoá/sửa.

## 4. Lưu ý cho AI Agent
- Mọi thay đổi về cấu trúc bảng (Entity) đều sẽ được Hibernate tự động cập nhật xuống MySQL nhờ `ddl-auto: update`.
- Tuyệt đối không sinh ra code dùng thư viện lỗi thời, phải check sự tương thích với Java 21 và Spring Boot 4.
