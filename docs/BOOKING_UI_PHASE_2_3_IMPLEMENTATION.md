# BookingBase UI — Phase 2 và Phase 3

Cập nhật: 2026-07-27  
Trạng thái: **Hoàn thành source code, chưa deploy production**

## Mục tiêu

Triển khai nền giao diện `CFC Operations Desk` đã duyệt mà không thay đổi:

- API và backend.
- Route, deep-link và route guard.
- Quyền `ADMIN`, `MANAGER`, `EMPLOYEE`.
- Luồng booking, duyệt, từ chối, hủy.
- Luồng notification, WebSocket, Web Push và PWA gate.

## Phase 2 — Design system

Nguồn token:

- `frontend/src/styles/cfc-design-system.css`

Các token chính:

- Operations navy `#062A3D`
- Ink `#0B1F3A`
- CFC emerald `#009B63`
- Action cobalt `#0F5BFF`
- Room blue `#2563EB`
- Vehicle teal `#0F8A83`
- Canvas `#F5F8F7`
- Border `#D7E0E6`

Primitive đã chuẩn hóa:

- `Button`: primary, secondary, outline, success, danger, ghost.
- `Input`: label liên kết đúng input, hint/error và trạng thái accessibility.
- `Modal`: Escape để đóng, khóa scroll an toàn, mobile sheet anatomy.
- `Avatar`: fallback initials, xử lý ảnh lỗi.
- `Surface`, `StatusBadge`, `BottomSheet`.

Quy tắc chung:

- Touch target chính tối thiểu 44px.
- Focus ring cobalt dễ nhận biết.
- Radius 8–12px; border mảnh; shadow tiết chế.
- Có `safe-area-inset-*`, reduced-motion và scrollbar gọn.

## Phase 3 — App shell

Các component:

- `frontend/src/layouts/app-shell/AppSidebar.jsx`
- `frontend/src/layouts/app-shell/AppTopBar.jsx`
- `frontend/src/layouts/app-shell/NotificationMenu.jsx`
- `frontend/src/layouts/app-shell/UserMenu.jsx`
- `frontend/src/layouts/app-shell/MobileBottomNav.jsx`
- `frontend/src/layouts/app-shell/MobileMoreSheet.jsx`
- `frontend/src/layouts/app-shell/AppFooter.jsx`
- `frontend/src/layouts/app-shell/BrandMark.jsx`
- `frontend/src/layouts/app-shell/navigation.js`

Desktop:

- Sidebar navy 248px, có thể thu còn 84px.
- Active navigation dùng emerald và rail trắng.
- Top bar hiển thị ngữ cảnh, notification, tên/phòng ban và avatar.
- Trạng thái sidebar được lưu trong `localStorage`.

Mobile/PWA:

- App bar navy nằm dưới safe area.
- `EMPLOYEE`/`ADMIN`: Trang chủ, Phòng họp, Xe công tác, Thông báo.
- `MANAGER`: Tổng quan, Nhân sự, Thử việc, Thêm.
- Chức năng HR phụ và chức năng ADMIN nằm trong bottom sheet phù hợp vai trò.
- Hồ sơ và đăng xuất nằm trong user menu/bottom sheet.
- Bottom navigation tự ẩn ở route form/detail để tránh che bàn phím và sticky action.

## Kiểm tra đã thực hiện

- `npm run lint`: pass; chỉ còn warning có sẵn ở calendar/HR Overview, không phát sinh error.
- `npm run build`: pass với Vite 8 và PWA injectManifest.
- Browser QA bằng Playwright:
  - Desktop MANAGER 1440×900.
  - Desktop ADMIN 1280×800.
  - Mobile/PWA 390×844.
  - Mở/đóng mobile more sheet.
  - Thu gọn/mở rộng desktop sidebar.
  - Refresh/deep-link trực tiếp `/manager/hr/employees`, `/admin/approvals`, `/rooms/create`.
  - Xác nhận bottom navigation ẩn trên form tạo booking.

Ảnh kiểm tra local:

- `output/playwright/phase23-hr-desktop.png`
- `output/playwright/phase23-admin-desktop.png`
- `output/playwright/phase23-hr-mobile.png`
- `output/playwright/phase23-mobile-more-sheet.png`
- `output/playwright/phase23-booking-form-mobile.png`

Các request API trong browser QA dùng token giả và origin local nên bị CORS theo đúng cấu hình production. Không có lỗi render JavaScript; không có request ghi dữ liệu.

## Bước tiếp theo

Phase 4 nên redesign nội dung trang Dashboard và hai lịch Room/Car theo concept `01–03`, sau đó Phase 5 xử lý form booking, detail và admin approvals theo concept `04–06`.
