# HR Phase 4 — Giao Diện Quản Lý Cho Manager

> Tài liệu này là acceptance của artifact Phase 4 tại thời điểm các trang movement/roster còn read-only. Phase 5 hiện đã được triển khai ở source; xem [HR Phase 5 — Tăng/Giảm và danh sách tháng](HR_PHASE_5_WORKFORCE_MONTHLY.md).

Cập nhật: `2026-07-23`

Trạng thái: **hoàn thành triển khai source và automated verification ngày 2026-07-23; chờ deploy/UAT runtime**.

Ngày `2026-07-23`, người dùng xác nhận đã chạy migration HR và xác nhận import baseline thành công với `329` nhân sự. Agent chưa query độc lập database/runtime đang được người dùng sử dụng, vì vậy đây là **trạng thái do người dùng xác nhận**, chưa phải bằng chứng vận hành đã được agent đối chiếu.

## 1. Mục tiêu Phase 4

Phase 4 hoàn thiện giao diện sử dụng các API an toàn đã có từ Phase 3 cho tài khoản có đúng role `MANAGER`:

- đăng nhập, silent refresh hoặc mở PWA tại `/` đều đi tới `/manager/hr`;
- sidebar của Manager chỉ hiển thị `Thông báo` và nhóm `Quản lý nhân sự`;
- xem tổng quan, tìm kiếm và tra cứu 329 hồ sơ baseline theo phân trang;
- xem chi tiết hồ sơ với dữ liệu nhạy cảm được che;
- tạo và chỉnh sửa hồ sơ `DRAFT`;
- quản lý danh mục phòng ban, chức vụ và điều kiện lao động riêng của HR;
- theo dõi batch import baseline;
- tra cứu read-only biến động, snapshot tháng và audit hiện có;
- hoạt động rõ ràng trên desktop, mobile và khi refresh deep link.

Phase 4 không tự thêm API ghi mới để mô phỏng chức năng của các phase sau.

## 2. Phạm vi giao diện

### 2.1 Route và navigation

Các route thuộc Phase 4:

- `/manager/hr`: tổng quan HR;
- `/manager/hr/employees`: danh sách nhân sự;
- `/manager/hr/employees/new`: tạo hồ sơ nháp;
- `/manager/hr/employees/:id`: chi tiết hồ sơ;
- `/manager/hr/employees/:id/edit`: chỉnh sửa hồ sơ nháp;
- `/manager/hr/catalogs`: danh mục HR;
- `/manager/hr/imports`: lịch sử và flow import baseline;
- `/manager/hr/movements`: lịch sử biến động read-only;
- `/manager/hr/rosters`: danh sách kỳ nhân sự read-only;
- `/manager/hr/rosters/:id`: chi tiết snapshot tháng read-only;
- `/manager/hr/audit`: nhật ký HR read-only.

Chỉ `MANAGER` được vào các route/API HR. Việc ẩn menu không thay thế authorization ở backend.

### 2.2 Trạng thái sau import baseline

Theo contract Phase 2, một lần confirm baseline thành công phải tạo nguyên tử:

- `329` Employee độc lập với User;
- `329` movement `INITIAL_LOAD` ở trạng thái `CONFIRMED`;
- một snapshot `T6-26` ở trạng thái `CLOSED` với `329` dòng;
- batch import ở trạng thái `CONFIRMED` và audit tương ứng.

Với kích thước trang `20`, danh sách 329 nhân sự có `17` trang; trang cuối có `9` dòng. Đây là giá trị kỳ vọng để UAT, chưa phải kết quả agent đã query ở runtime hiện tại.

### 2.3 Dữ liệu nhạy cảm

- List nhân sự không trả CCCD/CMND, BHXH, BHYT, địa chỉ, điện thoại hoặc lương.
- Detail mặc định chỉ hiển thị giá trị đã mask hoặc cờ cho biết dữ liệu lương/phụ cấp đã tồn tại.
- Form edit không đưa chuỗi mask ngược về server; để trống field được bảo vệ phải giữ nguyên dữ liệu hiện có.
- UI không log token, nội dung file import hoặc PII.
- Việc xem số định danh/bảo hiểm đầy đủ không thuộc Phase 4.

### 2.4 Trạng thái read-only

Các hồ sơ baseline đã confirm là `ACTIVE`; API Phase 3 chỉ cho chỉnh sửa trực tiếp hồ sơ `DRAFT`. Giao diện phải thể hiện rõ trạng thái này và không hiển thị nút sửa gây hiểu nhầm trên hồ sơ `ACTIVE`.

Tăng/Giảm, snapshot tháng đã chốt và audit hiện chỉ để tra cứu. UI không được tạo action ghi giả hoặc làm người dùng tin rằng dữ liệu tháng sau đã được sinh tự động.

## 3. Acceptance criteria

Các tiêu chí dưới đây là gate nghiệm thu đầy đủ. Source và automated gate đã đạt; các mục cần dữ liệu/browser thật tiếp tục được kiểm tra sau khi deploy artifact mới.

### 3.1 Đăng nhập và phân quyền

- `MANAGER` login, silent refresh và PWA root được chuyển tới `/manager/hr`.
- Sidebar Manager chỉ còn `Thông báo` và nhóm `Quản lý nhân sự`.
- Refresh trực tiếp mọi deep link `/manager/hr/**` không mất ngữ cảnh cần thiết và không trả 404.
- Thiếu token nhận `401`; `ADMIN` và `EMPLOYEE` nhận `403` từ `/api/v1/hr/**`; chỉ `MANAGER` nhận dữ liệu.

### 3.2 Tổng quan và baseline

- Overview hiển thị số liệu thật từ API, không hard-code.
- Runtime được đối chiếu đủ 329 Employee, 329 `INITIAL_LOAD`, roster `T6-26` có 329 dòng và batch `CONFIRMED`.
- Màn import thể hiện baseline đã hoàn tất, không khuyến khích người dùng upload lại file như thao tác thường ngày.
- Rollback, nếu còn hiển thị, phải có xác nhận rõ và vẫn phụ thuộc guard backend.

### 3.3 Danh sách nhân sự

- Search mã/họ tên, filter trạng thái/phòng ban/chức vụ/điều kiện lao động và sort hoạt động phía server.
- Pagination đúng với 329 hồ sơ; chuyển trang không trùng hoặc bỏ dòng.
- Tất cả catalog active đều chọn được trong filter/form, không chỉ 20 phần tử đầu tiên.
- Có trạng thái loading, empty, error và retry; request cũ không ghi đè request mới.
- Bảng desktop và card mobile không lộ PII/lương.

### 3.4 Chi tiết và hồ sơ nháp

- Deep link chi tiết Employee tải độc lập, không phụ thuộc navigation state.
- Detail hiển thị đủ nhóm thông tin hiện có trong API và luôn giữ masking.
- Có thể tạo hồ sơ `DRAFT` với mã nhân sự duy nhất.
- Chỉ `DRAFT` có nút sửa; update gửi đúng `rowVersion`.
- Hai tab cùng sửa một hồ sơ phải nhận conflict ở bản lưu cũ và yêu cầu tải lại.
- Field nhạy cảm để trống khi edit không làm mất giá trị đang lưu.

### 3.5 Danh mục HR

- Ba nhóm danh mục có search, status filter và pagination.
- Create/edit/deactivate có thông báo thành công hoặc lỗi rõ ràng.
- Chọn phòng ban cấp trên từ toàn bộ tập hợp hợp lệ, không giới hạn ở trang bảng đang xem.
- Chặn self-parent/cycle, mã hoặc tên trùng và stale `rowVersion` theo lỗi backend.

### 3.6 Import, movement, roster và audit

- Import history/preview phản ánh đúng trạng thái batch; payload đã purge có thông báo phù hợp.
- Movement read-only phân trang và hiển thị đúng nhân sự, loại, ngày hiệu lực, trạng thái.
- Danh sách tháng mở được snapshot `T6-26`; refresh URL chi tiết vẫn còn tên kỳ và trạng thái.
- Roster item theo đúng `displayOrder`, có 329 dòng và không chứa PII/lương.
- Audit read-only hiển thị actor, action, entity và thời gian; không hiển thị metadata nhạy cảm.

### 3.7 Chất lượng frontend

- Giao diện usable ở desktop và mobile portrait/landscape.
- Không còn nội dung kỹ thuật kiểu “Phase 3/Phase 5” trong thông báo dành cho người dùng cuối; thay bằng mô tả nghiệp vụ.
- Route HR tiếp tục lazy-load và list không tải cả 329 hồ sơ trong một request.
- Frontend lint/build, backend regression và UAT thực tế đều hoàn tất sau thay đổi cuối cùng.

## 4. UAT sau baseline 329

| ID | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| UAT-01 | Login bằng tài khoản `MANAGER` | Chuyển tới `/manager/hr`; sidebar chỉ có Thông báo và HR |
| UAT-02 | Mở HR khi không có token/role khác | API trả lần lượt `401`/`403`; không hiển thị dữ liệu HR |
| UAT-03 | Mở Tổng quan HR | Hiển thị số liệu thật; kỳ gần nhất là `T6-26`, batch gần nhất `CONFIRMED` |
| UAT-04 | Mở danh sách nhân sự | Tổng 329, 17 trang ở size 20, trang cuối 9 dòng |
| UAT-05 | Search và filter theo catalog ngoài trang đầu | Kết quả đúng và catalog vẫn chọn được |
| UAT-06 | Xem một hồ sơ baseline | Hồ sơ `ACTIVE`, không có nút sửa trực tiếp, PII/lương được che |
| UAT-07 | Tạo rồi sửa một hồ sơ nháp | Tạo `DRAFT`, sửa thành công, audit có actor Manager |
| UAT-08 | Mở cùng hồ sơ nháp ở hai tab và lưu lần lượt | Tab lưu sau nhận stale-version conflict rõ ràng |
| UAT-09 | Thêm/sửa/ngừng một catalog test | Trạng thái UI và API đồng bộ; dữ liệu lịch sử không bị xóa |
| UAT-10 | Mở batch baseline đã confirm | Hiện 329 imported; không confirm lần hai; cảnh báo rollback rõ ràng |
| UAT-11 | Mở Tăng/Giảm | Có 329 `INITIAL_LOAD`; không có nút tạo Tăng/Giảm Phase 5 |
| UAT-12 | Mở `T6-26`, copy URL rồi refresh | Vẫn hiện đúng kỳ, trạng thái `CLOSED` và 329 dòng |
| UAT-13 | Mở Nhật ký thay đổi | Có sự kiện import/draft/catalog phù hợp, không lộ payload PII |
| UAT-14 | Thử mạng lỗi rồi retry | Có error state rõ ràng; retry không nhân đôi thao tác ghi |
| UAT-15 | Kiểm tra iPhone-like và desktop | Sidebar, bảng/card, modal, form và pagination sử dụng được |

## 5. Đối chiếu vận hành read-only

Trước khi ghi nhận import runtime là đã được agent xác minh, cần đối chiếu tối thiểu:

```sql
SELECT employment_status, COUNT(*)
FROM hr_employees
GROUP BY employment_status;

SELECT movement_type, status, COUNT(*)
FROM hr_employee_movements
GROUP BY movement_type, status;

SELECT id, period_start, status, item_count
FROM hr_monthly_rosters
ORDER BY period_start DESC;

SELECT status, total_rows, imported_rows, confirmed_at
FROM hr_excel_import_batches
ORDER BY created_at DESC;
```

Chỉ chạy read-only trên đúng database đang phục vụ môi trường cần kiểm tra. Không rollback, import lại hoặc sửa tay để làm cho số đếm khớp.

## 6. Ranh giới Phase 5–9

### Phase 5 — Tăng/Giảm và snapshot tháng

- tạo/xác nhận/hủy movement;
- ghi nhận tăng và giảm có ngày hiệu lực; điều chuyển/điều chỉnh tiếp tục khóa đến khi có contract riêng;
- mở/kế thừa/chốt/reopen kỳ có kiểm soát;
- sinh `T7-26` trở đi;
- xóa hồ sơ nháp chỉ khi chưa có reference.

### Phase 6 — Import/Export Excel hoàn chỉnh

- blank template không chứa PII;
- import Tăng/Giảm theo contract mới;
- export đúng format `GIAM`, `TĂNG`, `T6-26` và các tháng tiếp theo;
- verifier workbook trước khi phát hành file.

### Phase 7 — Tính ngày phép

- rule có version/effective date;
- calculation snapshot giải thích được kết quả;
- điều chỉnh ngày phép có lý do và audit.

### Phase 8 — Đơn nghỉ và phê duyệt HR

- flow nghỉ phép độc lập với booking;
- số dư, tạo/hủy/phê duyệt đơn và chống trừ hai lần.

### Phase 9 — Báo cáo, quyền PII và UAT vận hành

- báo cáo headcount, hồ sơ thiếu, bảo hiểm và ngày phép;
- cơ chế xem/export PII có kiểm soát và audit truy cập;
- flow sửa dữ liệu `ACTIVE` phải được chốt riêng, không mở edit trực tiếp chỉ bằng frontend;
- đối chiếu DB/UI/Excel, backup/restore và sign-off UAT.

## 7. Kết quả verification Phase 4

Kết quả trên source cuối ngày `2026-07-23`:

- Frontend `npm run lint`: **PASS**, còn đúng một warning cũ tại `CustomDateHeader.jsx`.
- Frontend `npm run build`: **PASS**, PWA/service worker build thành công; main chunk khoảng `780,55 kB` còn warning kích thước cũ.
- Backend target test cho roster detail/audit/security: **8 test PASS**.
- Toàn bộ backend regression suite với ByteBuddy Java agent trên JDK 25: **75 test, 0 failure, 0 error, 1 skip theo điều kiện môi trường**.
- Backend production JAR chứa frontend mới, build bằng `./mvnw -DskipTests package`: **PASS**.
- `git diff --check`: **PASS**.
- Read-only reconciliation trên runtime có 329 nhân sự: **chưa được agent thực hiện**.
- Browser UAT desktop/mobile/deep-link: **chưa thực hiện đầy đủ**.

Phase 4 được xem là hoàn thành ở source code. Chưa tuyên bố artifact mới đã hoạt động trên production cho tới khi người dùng build/deploy và hoàn tất các UAT runtime còn lại.
