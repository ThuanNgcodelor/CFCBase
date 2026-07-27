# Booking UI — Phase 4 và Phase 5

> **LƯU TRỮ:** Đây là phase cuối của Booking. Booking Phase 6–10 đã hủy; roadmap active chỉ còn HR.

Cập nhật: 2026-07-27

Trạng thái: **Hoàn thành ở source và kiểm thử local; chưa deploy/restart production**

## 1. Phạm vi

Phase 4:

- Dashboard Admin và Employee.
- Calendar phòng họp và xe công tác.
- Command rail, trạng thái, search và responsive day/week/month.

Phase 5:

- Form đặt phòng và đặt xe.
- Chi tiết booking, timeline và action theo role.
- Danh sách chờ duyệt, lịch sử xử lý và drawer xem nhanh.

## 2. Kết quả chính

- Áp dụng bản sắc `CFC Operations Desk`: navy shell, emerald navigation, cobalt CTA, room blue, vehicle teal và pending amber.
- Desktop dùng operational ledger, surface phẳng, border mảnh và khoảng trắng rõ.
- Mobile/PWA dùng app bar, bottom navigation, card ledger, day-first calendar và sticky form actions có safe area.
- Dashboard client gọi `/dashboard/client` và backend luôn lấy user từ authenticated principal.
- Endpoint `/dashboard/admin` chỉ cho role `ADMIN`; Employee/Manager bị trả `403`.
- Giữ endpoint `/dashboard/client/{userId}` cho tương thích nhưng chỉ owner hoặc Admin được đọc.
- Payload tạo booking không gửi `requesterId`.
- Calendar giữ range-based fetch, request cancellation, stale sequence guard và memoization.
- Trang duyệt hỗ trợ tìm theo nội dung/người đặt/tài nguyên, lọc loại và xem nhanh không rời danh sách.

## 3. Fidelity ledger

Đối chiếu với 8 concept đã duyệt:

1. Sidebar navy, top bar trắng, emerald active rail và line-art signature được giữ nhất quán.
2. Dashboard dùng ba chỉ số vận hành và activity ledger thay cho bento/gradient.
3. Calendar có command rail hai tầng, resource accent riêng và workspace lớn.
4. Form dùng document layout, summary sticky ở desktop và sticky action ở mobile.
5. Booking detail dùng dossier + timeline + action panel theo concept.
6. Approval ledger có drawer xem nhanh ở desktop và full-screen sheet ở mobile.
7. Mobile calendar tự dùng chế độ ngày, touch target 44px và không tràn ngang.
8. Mobile form xe là một cột, route rõ và action nằm trên safe area.

## 4. Copy diff

Concept dùng dữ liệu minh họa. Source sử dụng copy nghiệp vụ hiện có:

- `Request` được diễn đạt là `Yêu cầu` hoặc `Đăng ký`.
- `Review request` được diễn đạt là `Mở xử lý`.
- `Meeting room`/`Business vehicle` dùng `Phòng họp`/`Xe công tác`.
- Các trạng thái giữ đúng enum hiện tại: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`.
- Không hiển thị giả trạng thái “còn trống”; form nói rõ backend kiểm tra xung đột khi gửi.

## 5. Sai khác có chủ đích

- Không thêm API availability mới chỉ để giống ảnh concept.
- Không thay đổi route/deep link, role hoặc flow approve/reject/cancel.
- Không cache booking API trong Service Worker.
- Admin Approvals hiện ghép hai API phòng/xe để giữ tương thích backend; lịch sử đã dùng server-side pagination.
- Mobile calendar dùng day view thay vì ép week view thu nhỏ.

## 6. Kiểm thử

- `npm run lint`: pass; còn 8 warning không liên quan trong `HrOverview.jsx`.
- `npm run build`: pass, gồm PWA service worker.
- Dashboard backend security/controller: 6 test pass.
- Full backend suite với Mockito Java agent: 92/93 test pass; còn 1 failure có sẵn trong `HrManagementServiceTest` (`expected 1L`, thực tế `41L`), ngoài phạm vi Booking Phase 4–5.
- `git diff --check`: pass.
- Playwright local với API mock, không gọi production:
  - Desktop 1440×900: dashboard, room calendar, room form, approval ledger/drawer và booking detail.
  - Mobile/PWA 390×844: room calendar, car form, approval ledger và booking detail.
- Lỗi console trong browser QA chỉ là SockJS `/ws/**` trả `404` vì không khởi động backend local; các API màn hình đều được mock.

## 7. Ghi chú vận hành

- Không có migration database.
- Không restart backend, tunnel hoặc production.
- Khi triển khai thật cần smoke-test với API hiện hữu, đăng nhập đủ ba role và kiểm tra deep link từ notification.
