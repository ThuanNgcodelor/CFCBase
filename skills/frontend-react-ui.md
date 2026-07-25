---
name: frontend-react-ui
description: Quy chuẩn viết code Frontend (React, Vite, Tailwind CSS v4) và các nguyên tắc thiết kế UI/UX cốt lõi cho dự án BookingBase.
---

# Quy chuẩn Code Frontend (React + Vite + Tailwind CSS)

Tài liệu này đóng vai trò như một bộ não bổ sung cho AI, giúp duy trì chất lượng code và tính thẩm mỹ thống nhất trên toàn bộ dự án Frontend của hệ thống Booking.

## 1. Công nghệ & Thư viện (Tech Stack)
- **Framework:** React 19 chạy trên nền Vite. Bắt buộc dùng cú pháp JavaScript chuẩn, không dùng TypeScript unless explicitly requested.
- **Styling:** **Tailwind CSS v4** (Không cần file config, được cấu hình trực tiếp qua plugin Vite).
- **Routing:** `react-router-dom`.
- **API Client:** `axios` (Tuyệt đối KHÔNG dùng `fetch` hay `axios` thô. Luôn `import { baseApi } from '../api/baseApi'` để tận dụng cấu hình baseUrl và Interceptors).
- **Icons:** Sử dụng thư viện `lucide-react` cho toàn bộ biểu tượng.

## 2. Triết lý Thiết kế (Design Principles - Dựa trên `desige.md`)
- **Tối giản & Sang trọng:** KHÔNG dùng các kiểu màu mè, đổ bóng gắt hay background cam/kem phong cách "AI default". Sử dụng tông nền xám nhạt (`bg-[#F9FAFB]`) và các thẻ trắng tinh tế có viền mỏng (`border-gray-200`, `shadow-sm`).
- **Nói KHÔNG với Modal/Popup:** Tuyệt đối tránh sử dụng Modal cho các Form tạo mới hoặc màn hình Chi tiết phức tạp (do trải nghiệm kém trên Mobile). Hãy sử dụng **Dedicated Sub-pages** (Trang riêng rẽ) với Layout rộng rãi.
- **Màu chủ đạo (Primary Color):** Blue/Navy (như `bg-blue-600`, `text-blue-700`).
- **UI Components:** Chỉ sử dụng và mở rộng các component trong thư mục `src/components/ui/` (như `Button`, `Input`). KHÔNG viết lại style thô trong từng trang.
- **Ngôn ngữ Text (UX Copywriting):** Viết Tiếng Việt chủ động, rõ ràng. Thay vì "Submit", hãy viết "Gửi yêu cầu". Thay vì "Error", hãy mô tả rõ "Không tìm thấy phòng họp".

## 3. Kiến trúc Cấu trúc Code
- **Cấu trúc thư mục:**
  - `src/components/`: Chứa các Component tái sử dụng (như nút bấm, form, modal).
  - `src/pages/`: Chứa các View chính (Ví dụ: `Dashboard.jsx`, `RoomBooking.jsx`).
  - `src/layouts/`: Chứa khung giao diện (như `DashboardLayout.jsx` có kèm Sidebar, Header).
  - `src/api/`: Chứa file cấu hình kết nối Backend (`baseApi.js`).
- **State Management:** Ưu tiên dùng Local State (`useState`) kết hợp Local Storage cho những state đơn giản như Auth, Role.

## 4. Xử lý API & Xác thực (Auth Flow)
- Mọi API call cần Auth token phải gọi thông qua `baseApi.js`.
- Interceptors sẽ tự động gắn Access Token và tự động ngầm xin lại Token mới (Refresh) nếu gặp lỗi 401. Không được can thiệp vào logic này nếu không cần thiết.
- Phân quyền Giao diện (Role-based): Luôn kiểm tra `user.role === 'ADMIN'` trước khi render ra các nút/menu nhạy cảm.

## 5. Lưu ý cho AI Agent
- Trước khi thêm một trang mới, hãy xem cấu trúc của trang `Dashboard.jsx` để học hỏi cách sử dụng Layout, margin, padding, typography của dự án.
- **KHÔNG ĐƯỢC** thêm các package UI ngoài như Material UI hay Ant Design. Phải xây dựng từ đầu bằng Tailwind CSS để giữ đúng tính chất riêng biệt của UI.
