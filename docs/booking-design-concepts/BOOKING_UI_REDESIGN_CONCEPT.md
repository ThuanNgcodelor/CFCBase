# Concept redesign BookingBase

Cập nhật: 2026-07-27

Trạng thái: **Hoàn thành Phase 0–3 — baseline, concept, design system và app shell**

Visual reference được người dùng chọn:

- `docs/hr-design-concepts/02-employees-desktop.png`
- `docs/hr-design-concepts/03-probation-desktop.png`
- `docs/hr-design-concepts/04-movements-drawer-desktop.png`

## 1. Hướng thiết kế

Tên định hướng: **CFC Operations Desk**

Mục tiêu:

- Dùng chung một bản sắc với `CFC People Operations`, để Booking và HR là hai phân hệ của cùng một sản phẩm.
- Mang cảm giác bàn điều phối nội bộ: nhanh, rõ, đáng tin, dễ dùng cho nhân viên và lãnh đạo.
- Không dùng bento dashboard, gradient lớn, glow hoặc card bo tròn lặp lại.
- Không thay đổi nghiệp vụ, API, route, role, notification hay PWA.

## 2. Design system đề xuất

### Màu sắc

| Token | Giá trị | Vai trò |
|---|---|---|
| Operations navy | `#062A3D` | Sidebar/app shell |
| Ink | `#0B1F3A` | Heading và dữ liệu chính |
| CFC emerald | `#009B63` | Active rail, trạng thái tích cực |
| Action cobalt | `#0F5BFF` | CTA và focus |
| Room blue | `#2563EB` | Ngữ cảnh phòng họp |
| Vehicle teal | `#0F8A83` | Ngữ cảnh xe |
| Pending amber | `#D97706` | Chờ duyệt |
| Danger | `#E5484D` | Từ chối/hủy |
| Canvas | `#F5F8F7` | Nền ứng dụng |
| Surface | `#FFFFFF` | Bề mặt chính |
| Border | `#D7E0E6` | Phân vùng |
| Muted text | `#637087` | Mô tả/phụ |

### Typography

- UI và nội dung: `Be Vietnam Pro`.
- Số, ngày giờ và dữ liệu calendar dùng cùng family với `font-variant-numeric: tabular-nums`.
- Heading đậm vừa, không dùng uppercase dài.
- Label và table header rõ nhưng không quá nhỏ.

### Container

- Sidebar desktop khoảng 232–248px.
- Top bar cao khoảng 72–80px.
- Canvas mở, true white surface, border mảnh, shadow rất nhẹ.
- Radius 8–12px.
- Calendar là một workspace lớn, không đặt trong nhiều lớp card.
- Drawer dùng cho xem nhanh/tạo nhanh trên desktop; mobile chuyển full-screen sheet.

### Signature

Họa tiết cánh chim hạc CFC dạng line-art rất mảnh chỉ xuất hiện ở cuối sidebar và empty state. Đây là điểm nhận diện duy nhất; không lặp lại như trang trí trên mọi card.

## 3. Information architecture chung

Desktop:

- Sidebar navy cố định.
- Top bar trắng: notification, avatar, tên/phòng ban.
- Nội dung có page title, primary action và command rail.
- Bảng/list/detail dùng cùng anatomy với HR.

Mobile/PWA:

- App bar nằm dưới `safe-area-inset-top`.
- Bottom navigation ưu tiên: Trang chủ, Phòng họp, Xe, Thông báo.
- Nút tạo booking là hành động nổi hoặc action nổi bật theo màn hình.
- Filter dùng bottom sheet.
- Chi tiết dùng full-screen dossier.
- Form một cột, sticky actions nằm trên `safe-area-inset-bottom`.

## 4. Bộ concept Phase 1

1. `01-booking-dashboard-desktop.png`
   - Trang tổng quan cho Employee.
   - Hai hành động chính: đặt phòng, đặt xe.
   - Lịch trình sắp tới dạng operational ledger.
2. `02-room-calendar-desktop.png`
   - Workspace lịch phòng họp.
   - Command rail cho phòng, trạng thái và view.
   - Calendar tuần có event rõ trạng thái.
3. `03-car-calendar-desktop.png`
   - Workspace lịch xe.
   - Giữ cấu trúc với phòng, dùng accent teal cho ngữ cảnh xe.
4. `04-create-room-booking-desktop.png`
   - Form tạo lịch phòng theo nhóm thông tin.
   - Có summary thời gian/resource và action rõ.
5. `05-booking-detail-approval-desktop.png`
   - Booking dossier, timeline xử lý và panel hành động duyệt/từ chối.
6. `06-admin-approvals-desktop.png`
   - Command rail + approval ledger.
   - Drawer xem nhanh chi tiết mà không mất vị trí danh sách.
7. `07-room-calendar-mobile-pwa.png`
   - Mobile agenda/day-first, bottom navigation và safe area.
8. `08-create-car-booking-mobile-pwa.png`
   - Form xe một cột, route trực quan và sticky action.

Dữ liệu trong ảnh chỉ là dữ liệu minh họa. Khi triển khai, copy và dữ liệu thật trong source/API là nguồn chính xác.

## 5. Ánh xạ primitive

| Khu vực | Primitive |
|---|---|
| Dashboard | Quick actions + upcoming booking ledger |
| Room/Car calendar | Command rail + calendar workspace |
| Create booking | Document form + booking summary |
| Booking detail | Booking dossier + approval timeline |
| Admin approvals | Command rail + ledger + detail drawer |
| Notifications | Inbox timeline |
| Profile | Identity dossier + account settings |
| Admin users/profile approvals | Data table/mobile ledger + review drawer |

## 6. Quy tắc responsive

- Không thu nhỏ toàn bộ UI trên màn Full HD; content mở rộng có giới hạn hợp lý.
- Calendar desktop giữ đủ trục thời gian và event.
- Tablet thu gọn sidebar và cho command rail wrap theo nhóm.
- Mobile ưu tiên agenda/day; month chỉ là navigation overview.
- Table chuyển thành ledger list, không ép horizontal scroll.
- Drawer desktop chuyển thành full-screen sheet trên mobile.
- Input, button và icon action có touch target tối thiểu 44px.
- Khi bàn phím mở, sticky action vẫn nhìn thấy và bottom nav được ẩn nếu cần.

## 7. Trạng thái triển khai

### Phase 0 — Baseline

- Đã chốt route, role, luồng nghiệp vụ, notification và PWA không được thay đổi.
- Đã ghi nhận hiện trạng trước redesign trong `docs/BOOKING_UI_PHASE_0_BASELINE.md`.

### Phase 1 — Concept

- Đã tạo và duyệt 8 màn hình tham chiếu trong thư mục này.
- Hướng thiết kế được chọn là `CFC Operations Desk`.

### Phase 2 — Design system

- Đã tạo token thương hiệu tại `frontend/src/styles/cfc-design-system.css`.
- Đã chuẩn hóa Button, Input, Modal và bổ sung Avatar, Surface, StatusBadge, BottomSheet.
- Touch target chính tối thiểu 44px, focus ring rõ, có reduced-motion và safe-area utility.

### Phase 3 — App shell

- Đã tách sidebar, top bar, notification menu, user menu, mobile bottom navigation, mobile more sheet và footer thành component riêng.
- Desktop dùng sidebar navy có thể thu gọn; trạng thái thu gọn được giữ trong local storage.
- Mobile/PWA dùng app bar + bottom navigation theo role; form/detail tự ẩn bottom navigation.
- ADMIN, MANAGER và EMPLOYEE tiếp tục dùng đúng route/guard cũ.
- Chi tiết kiểm thử và danh sách file: `docs/BOOKING_UI_PHASE_2_3_IMPLEMENTATION.md`.

## 8. Phạm vi chưa triển khai

- Chưa redesign nội dung riêng của Dashboard, calendar, form booking, booking detail và admin ledgers; đây là các phase tiếp theo.
- Không thay đổi backend/API.
- Không đổi route, role, redirect, deep link hoặc nghiệp vụ.
- Không đổi logic calendar, create, approve, reject hoặc cancel.
- Chưa deploy/restart server production.
