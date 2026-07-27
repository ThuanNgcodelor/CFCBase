# Concept redesign giao diện HR

Trạng thái: **Chờ duyệt concept, chưa triển khai vào source code**

Phạm vi áp dụng: chỉ các route `/manager/hr/**`.

## 1. Hướng thiết kế

Tên định hướng: **CFC People Operations**

Mục tiêu:

- Giữ nhận diện CFC nhưng tạo một không gian HR độc lập, nghiêm túc và có tính con người.
- Tránh giao diện dashboard AI đại trà: card bo tròn lặp lại, bento grid, gradient, glow và khoảng trống thiếu chủ đích.
- Ưu tiên bảng dữ liệu, ledger, timeline và hồ sơ dạng tài liệu.
- Không thay đổi nghiệp vụ HR hiện tại.

Ngôn ngữ thị giác:

- Sidebar desktop xanh navy đậm, active rail xanh CFC.
- Nền nội dung xám xanh lạnh rất nhạt; surface chính dùng trắng thật.
- Xanh CFC dùng cho điều hướng và trạng thái tích cực.
- Cobalt dùng cho hành động chính.
- Đỏ chỉ dùng cho trạng thái tiêu cực hoặc thao tác phá hủy.
- Typography đề xuất: `Be Vietnam Pro`.
- Bo góc 8–12px, border mảnh, shadow rất nhẹ.
- Họa tiết chim hạc chỉ xuất hiện như line motif nhỏ ở app shell/empty state.

Token màu đề xuất để tinh chỉnh khi triển khai:

| Token | Giá trị |
|---|---|
| HR navy | `#062A3D` |
| HR ink | `#0B1F3A` |
| CFC emerald | `#009B63` |
| Emerald tint | `#E8F7F0` |
| Action cobalt | `#0F5BFF` |
| Canvas | `#F5F8F7` |
| Border | `#D7E0E6` |
| Muted text | `#637087` |
| Danger | `#E5484D` |

## 2. Bộ concept đã chọn

1. `01-overview-desktop.png`: tổng quan HR, summary band và quick-access ledger.
2. `02-employees-desktop.png`: bộ lọc và bảng nhân sự desktop.
3. `03-probation-desktop.png`: ứng viên thử việc và empty state.
4. `04-movements-drawer-desktop.png`: Tăng/Giảm với form dạng drawer.
5. `05-rosters-desktop.png`: danh sách tháng dạng timeline-ledger.
6. `06-employee-detail-desktop.png`: hồ sơ nhân sự dạng personnel dossier.
7. `07-catalogs-desktop.png`: primitive dùng chung cho danh mục, import history và audit table.
8. `08-overview-mobile-pwa.png`: tổng quan mobile/PWA.
9. `09-employees-mobile-pwa.png`: danh sách nhân sự mobile.
10. `10-candidate-form-mobile-pwa.png`: form ứng viên thử việc mobile.

Các ảnh là specification về bố cục và ngôn ngữ thị giác. Tên, ngày, phòng ban và dữ liệu minh họa do Image Gen dựng không thay thế dữ liệu thật từ API.

## 3. Quy tắc responsive

Desktop lớn:

- Sidebar khoảng 232px.
- Content fluid, giới hạn khoảng 1480px.
- Bảng dữ liệu giữ dạng table.
- Không scale toàn bộ UI nhỏ đi trên màn Full HD.

Tablet:

- Thu gọn sidebar hoặc chuyển thành drawer.
- Command rail cho phép wrap theo nhóm hợp lý.
- Form hai cột chuyển dần về một cột.

Mobile/PWA:

- App bar nằm trong `safe-area-inset-top`.
- Điều hướng chính ở bottom navigation: Tổng quan, Nhân sự, Thử việc, Thêm.
- Mục “Thêm” mở navigation sheet cho Tăng/Giảm, Danh sách tháng, Danh mục, Nhập dữ liệu và Nhật ký.
- Table chuyển thành ledger list có label; không ép horizontal scroll.
- Bộ lọc mở trong bottom sheet.
- Form dài dùng section accordion và sticky action phía trên `safe-area-inset-bottom`.
- Khi đang nhập form, ẩn bottom navigation để dành không gian cho nút Hủy/Lưu.
- Touch target tối thiểu 44px.

Viewport bắt buộc kiểm tra khi triển khai:

- Android: 360×800 và 412×915.
- iPhone: 375×812, 390×844 và 430×932.
- Desktop: 1366×768, 1440×900 và 1920×1080.

## 4. Ánh xạ toàn bộ route HR

| Khu vực | Primitive concept |
|---|---|
| Tổng quan | Summary band + operational ledger |
| Nhân sự | Command rail + desktop table/mobile ledger list |
| Chi tiết nhân sự | Personnel dossier + activity timeline |
| Form nhân sự | Document form + section accordion trên mobile |
| Thử việc | Tabs + command rail + table/empty state |
| Mẫu công việc thử việc | Document form, dùng cùng primitive với form ứng viên |
| Tăng/Giảm | Audit table + create drawer/full-screen mobile sheet |
| Danh sách tháng | Monthly timeline-ledger |
| Chi tiết danh sách tháng | Table/mobile ledger list |
| Danh mục | Tabs + command rail + master-data table |
| Nhập dữ liệu | Upload workflow panel + import-history table |
| Nhật ký thay đổi | Read-only audit table + filters |

## 5. Giới hạn của concept

- Không thay đổi backend, API, role hoặc flow nghiệp vụ.
- Không thêm metric, chart hoặc module mới.
- Không dùng ảnh concept làm giao diện tĩnh.
- Khi triển khai, toàn bộ text, bảng, form và control phải là code React thật.
- Dữ liệu thật và copy hiện tại trong source/API là nguồn chính xác.

