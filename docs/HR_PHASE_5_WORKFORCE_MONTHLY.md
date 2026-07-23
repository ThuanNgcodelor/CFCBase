# HR Phase 5 — Tăng/Giảm Và Danh Sách Tháng

Cập nhật: 2026-07-23

Trạng thái: **hoàn thành ở source code và automated test; chưa deploy/restart production, chưa UAT trên database đang chạy**

## 1. Phạm vi đã triển khai

Phase 5 bổ sung nghiệp vụ ghi cho đúng role `MANAGER`:

- tạo hồ sơ nhân sự `DRAFT` rồi ghi nhận Tăng;
- ghi nhận Giảm cho nhân sự `ACTIVE`;
- vòng đời movement `DRAFT -> CONFIRMED` hoặc `DRAFT -> CANCELLED`;
- tạo kỳ tháng kế tiếp, mở, chốt và mở lại có kiểm soát;
- kế thừa snapshot tháng trước và áp dụng movement đã xác nhận;
- xóa cứng chỉ với hồ sơ, movement hoặc kỳ `DRAFT` chưa có reference;
- audit actor, action, entity và các trường thay đổi đã lọc;
- optimistic version và pessimistic lock cho các thao tác chuyển trạng thái.

Ngoài thao tác thủ công, source hiện có một import one-time khóa checksum để dựng đúng baseline `T6-26 = 339`. Đây không phải import Tăng/Giảm hàng loạt tổng quát. Điều chuyển, đổi chức vụ và import workbook tùy ý vẫn chưa được mở để tránh tạo flow chưa đầy đủ.

## 2. Quy tắc đã khóa

### 2.1 T6-26 là baseline bất biến

- Snapshot `T6-26` sinh từ batch import không thể reopen hoặc delete.
- Confirm Tăng/Giảm không sửa trực tiếp roster đã `CLOSED`.
- Movement có hiệu lực muộn trong tháng 6 được áp dụng khi dựng kỳ kế tiếp chưa chốt, thường là `T7-26`.
- Một kỳ `CLOSED` không thay đổi số dòng, checksum hoặc dữ liệu item khi movement mới được xác nhận sau đó.

### 2.2 Tăng nhân sự

- Chỉ chọn Employee đang `DRAFT`.
- Ngày hiệu lực không được ở tương lai khi bấm xác nhận.
- Confirm chuyển Employee sang `ACTIVE`, ghi `statusEffectiveDate` và bổ sung `hireDate` nếu hồ sơ chưa có.
- Employee được thêm vào snapshot kỳ chưa chốt có ngày cuối tháng không trước ngày hiệu lực.

### 2.3 Giảm nhân sự

- Chỉ chọn Employee đang `ACTIVE`.
- Lý do là bắt buộc.
- Ngày giảm không được trước ngày vào làm hoặc trước trạng thái hiện tại.
- Confirm chuyển Employee sang `INACTIVE` và ghi `terminationDate`.
- Employee bị loại khỏi snapshot kỳ chưa chốt có ngày cuối tháng không trước ngày hiệu lực.

### 2.4 Movement và chống trùng

- Mỗi lệnh tạo có `idempotencyKey`; gửi lại cùng lệnh trả về cùng movement.
- Một Employee chỉ có tối đa một movement `DRAFT` tại một thời điểm.
- Movement `CONFIRMED` là bằng chứng lịch sử, không cancel/delete trực tiếp.
- `CANCELLED` vẫn được giữ để audit.
- Chỉ movement nhập tay còn `DRAFT`, chưa được roster/import tham chiếu mới được hard-delete.

### 2.5 Danh sách tháng

Vòng đời:

```text
DRAFT -> OPEN -> CLOSED -> EXPORTED
           ^        |
           |--------|
           reopen có lý do, chỉ khi chưa có tháng sau
```

- Chỉ tạo đúng tháng liền sau kỳ mới nhất đã `CLOSED` hoặc `EXPORTED`.
- `DRAFT` chưa có item; bấm Mở kỳ sẽ dựng snapshot xem trước.
- Bấm Chốt sẽ dựng lại snapshot một lần nữa để nhận đủ Tăng/Giảm vừa được xác nhận khi kỳ đang mở, sau đó tạo checksum.
- Không chốt tháng chưa bắt đầu theo múi giờ nghiệp vụ `Asia/Ho_Chi_Minh`.
- Chỉ kỳ `CLOSED`, không phải baseline, chưa `EXPORTED` và chưa có kỳ kế thừa mới được reopen; lý do reopen là bắt buộc.
- Chỉ kỳ `DRAFT` không có item/reference mới được hard-delete.

## 3. Cách dùng trên giao diện

### 3.1 Tăng một người

1. Vào `Quản lý nhân sự -> Nhân sự -> Thêm hồ sơ`.
2. Nhập hồ sơ và lưu; hệ thống tạo trạng thái `Hồ sơ nháp`.
3. Vào `Tăng / Giảm`, bấm `Tạo Tăng/Giảm`.
4. Chọn `Tăng nhân sự`, tìm hồ sơ nháp, chọn ngày hiệu lực và lưu bản nháp.
5. Kiểm tra lại rồi bấm `Xác nhận`.

Nếu nhập sai trước khi xác nhận, có thể Hủy để giữ dấu vết hoặc Xóa movement nháp. Hồ sơ nháp chỉ xóa được sau khi không còn movement/reference.

### 3.2 Giảm một người

1. Vào `Tăng / Giảm`, bấm `Tạo Tăng/Giảm`.
2. Chọn `Giảm nhân sự`, tìm người đang làm việc.
3. Nhập ngày hiệu lực, lý do và thông tin quyết định nếu có.
4. Lưu bản nháp, kiểm tra rồi bấm `Xác nhận`.

### 3.3 Tạo T7-26 từ T6-26

1. Chỉ tạo T7-26 khi đã bắt đầu quản lý biến động tháng 7 hoặc cần chốt snapshot tháng 7.
2. Vào `Danh sách tháng`, bấm `Tạo T7-26`.
3. Mở chi tiết T7 và bấm `Mở kỳ`.
4. Kiểm tra số lượng/danh sách. Có thể tiếp tục xác nhận movement trong lúc kỳ đang `OPEN`.
5. Bấm `Chốt tháng`; backend dựng lại dữ liệu rồi khóa snapshot.

Quy tắc số lượng:

```text
T6-26 baseline:       339
Tăng tháng 7:          +N
Giảm tháng 7:          -M
T7-26 sau khi chốt:   339 + N - M
T6-26 sau xử lý:      339, không thay đổi
```

Nếu chưa có Tăng/Giảm tháng 7 thật, chưa cần tạo T7-26. Để T6-26 đứng yên sẽ sạch dữ liệu hơn.

### 3.4 Import một lần baseline 339

Dùng đúng `docs/hr-template/workforce-baseline-339-2026.xlsx`, SHA-256:

```text
e35f22c83f5dacb542c7b3cff76238fcbaf8ac22f7e85b786d62d2c1de6cf6f7
```

File có đúng ba sheet hiển thị: `TĂNG`, `GIẢM`, `T6-26`. Sheet `T6-26` chứa 339 dòng value-only, không có sheet ẩn, không có `T7-26` và không có công thức. Không upload trực tiếp file nguồn `Baseline-value-339-2026.xlsx`.

- Nếu HR trống, một lần confirm sẽ nguyên tử dựng `T6-26 CLOSED = 339`.
- Kết quả là 339 Employee `ACTIVE`, 339 movement `INITIAL_LOAD` và 339 hồ sơ lịch sử.
- Import không tự sinh Tăng/Giảm, không tự tạo `T7-26` và không tạo hồ sơ nghỉ việc giả.
- Nếu có dữ liệu HR nửa vời, roster cũ hoặc movement nháp, preview chặn và không ghi dữ liệu.

Thao tác tại `Quản lý nhân sự -> Nhập dữ liệu`: chọn file, bấm `Đọc và đối chiếu`, kiểm tra mục tiêu `339`, nhập `339` rồi confirm. Flow đầy đủ và các bước đối chiếu sau import nằm tại [HR — Import Baseline T6-26 gồm 339 nhân sự](HR_WORKFORCE_IMPORT_339.md).

## 4. API

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `POST` | `/api/v1/hr/movements` | Tạo movement nháp |
| `POST` | `/api/v1/hr/movements/{id}/confirm` | Xác nhận movement |
| `POST` | `/api/v1/hr/movements/{id}/cancel` | Hủy movement nháp |
| `DELETE` | `/api/v1/hr/movements/{id}?rowVersion=...` | Xóa movement nháp có guard |
| `DELETE` | `/api/v1/hr/employees/{id}?rowVersion=...` | Xóa Employee nháp có guard |
| `POST` | `/api/v1/hr/rosters` | Tạo tháng kế tiếp |
| `POST` | `/api/v1/hr/rosters/{id}/open` | Mở và materialize snapshot |
| `POST` | `/api/v1/hr/rosters/{id}/close` | Dựng lại và chốt snapshot |
| `POST` | `/api/v1/hr/rosters/{id}/reopen` | Mở lại kỳ có lý do |
| `DELETE` | `/api/v1/hr/rosters/{id}?rowVersion=...` | Xóa kỳ nháp có guard |
| `POST` multipart | `/api/v1/hr/imports/workforce-snapshot/preview` | Đối chiếu artifact 339, không ghi dữ liệu |
| `POST` multipart | `/api/v1/hr/imports/workforce-snapshot/confirm` | Import baseline T6-26 = 339 nguyên tử |

Mọi API vẫn nằm dưới security rule `/api/v1/hr/**`: thiếu token trả `401`, `ADMIN`/`EMPLOYEE` trả `403`, chỉ `MANAGER` đang `ACTIVE` được phép. Actor không lấy từ request body mà được resolve từ authenticated principal. Employee HR vẫn không có quan hệ hoặc foreign key tới `User`.

## 5. Audit và dữ liệu nhạy cảm

- Snapshot tháng chỉ chứa dữ liệu phục vụ danh sách: mã, họ tên, danh mục HR, trạng thái, ngày vào làm và ngày phép.
- Không sao chép CCCD/CMND, BHXH/BHYT, địa chỉ, điện thoại hoặc lương vào roster item/audit metadata.
- Audit lưu subject/display name/role dạng snapshot chuỗi; không foreign key tới `users`.
- Lý do reopen và reason movement được lưu theo nghiệp vụ nhưng không ghi ra application log.
- Confirmed movement và snapshot `CLOSED` là lịch sử, không hard-delete.

## 6. Verification và UAT còn lại

Automated test phải bảo đảm:

- baseline T6-26 = 339 không đổi sau Tăng/Giảm;
- T7 được tính bằng 339 cộng Tăng đã xác nhận và trừ Giảm đã xác nhận;
- checksum snapshot có 64 ký tự SHA-256;
- retry idempotency không tạo movement thứ hai;
- future effective date, stale `rowVersion`, baseline reopen và downstream reopen đều bị chặn;
- principal Manager được dùng làm actor;
- security `401/403/MANAGER` vẫn giữ nguyên;
- frontend lint/build và PWA service worker build thành công.

Kết quả source hiện tại: target Phase 5 pass; toàn bộ backend regression đạt `80` test, `0` failure/error, `1` skip theo môi trường; frontend lint/build, PWA service worker và production JAR package đều pass.

Sau khi người dùng chủ động build/deploy, cần UAT runtime trên bản backup mới:

1. Tạo một Employee nháp test, sửa rồi xóa khi chưa có movement.
2. Tạo movement Tăng nháp, thử cancel/delete và xác nhận một bản hợp lệ.
3. Tạo movement Giảm cho một Employee test có lý do.
4. Khi có biến động tháng 7 thật, tạo/mở T7 và đối chiếu item count trước khi chốt.
5. Chốt T7, kiểm tra checksum và xác nhận T6 vẫn 339.
6. Kiểm tra `ADMIN` không truy cập API HR.
7. Kiểm tra giao diện desktop/mobile và refresh deep link.

Không import lại baseline 329 chỉ để UAT Phase 5. Nếu HR đã trống và cần dựng lại đúng bộ 339, chỉ dùng flow one-time ở mục 3.4. Không dùng dữ liệu nhân sự thật làm case phá/xóa; nên dùng hồ sơ test riêng và backup database trước UAT ghi.

## 7. Ngoài phạm vi

- Import sheet `TĂNG`/`GIAM` hàng loạt từ workbook bất kỳ: Phase 6 hoặc phase riêng sau export. Baseline 339 khóa cứng không làm thay đổi phạm vi này.
- Export Excel theo năm/tháng đã được triển khai ở Phase 6; xem [HR Phase 6 — Export Excel](HR_PHASE_6_EXCEL_EXPORT.md).
- Công thức/quy tắc ngày phép: Phase 7.
- Đơn nghỉ và phê duyệt HR: Phase 8.
- Export PII và báo cáo nâng cao: Phase 9.
