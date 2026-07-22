# Kế Hoạch Triển Khai Phân Hệ Quản Lý Nhân Sự

Cập nhật: 2026-07-22
Trạng thái: **Phase 0.1 và Phase 1 hoàn thành ở source code; chưa deploy production**

## 1. Mục tiêu

Xây dựng phân hệ HR độc lập trong BookingBase để role `MANAGER` có thể:

- Quản lý hồ sơ nhân sự, phòng ban, chức vụ và điều kiện lao động.
- Thêm, sửa, xem chi tiết, xử lý hồ sơ sai và ghi nhận ngừng làm việc.
- Theo dõi tăng/giảm nhân sự theo tháng.
- Tạo/chốt snapshot danh sách nhân sự tháng.
- Import có preview/validate và export Excel.
- Quản lý CCCD, BHXH, BHYT, liên hệ, quá trình công tác và ngày nghỉ phép.
- Xem lịch sử thay đổi và truy vết người thao tác.

## 2. Kiến trúc đã chốt

### 2.1 Employee tách hoàn toàn khỏi User

- `Employee` là miền HR riêng, không phải `User` mở rộng.
- Không có `user_id`, foreign key hoặc đồng bộ ngầm `User -> Employee`.
- Tài khoản đăng nhập và hồ sơ nhân sự có vòng đời độc lập.
- Không sửa login, register, profile hoặc booking để phục vụ HR.

### 2.2 Danh mục HR riêng

- `hr_departments`: phòng ban HR.
- `hr_positions`: chức vụ HR.
- `hr_working_conditions`: điều kiện/môi trường lao động.

Không tái sử dụng `Department` hoặc chức vụ hiện tại của BookingBase.

### 2.3 Phân quyền và route

- Chỉ role hiện có `MANAGER` được truy cập phân hệ HR.
- `ADMIN` không tự động có quyền HR.
- Backend dự kiến dùng `/api/v1/hr/**`.
- Frontend dự kiến dùng `/manager/hr`.
- Backend luôn enforce authorization; ẩn menu frontend không thay thế kiểm tra quyền.

### 2.4 Flow độc lập

- Không dùng booking approval cho nghỉ phép hoặc biến động nhân sự.
- Không gộp HR với calendar phòng/xe.
- Flow phê duyệt nghỉ phép, nếu làm, là flow HR riêng.

## 3. Hợp đồng Excel đã khóa

### 3.1 Chuỗi artifact

| Artifact | Vai trò | SHA-256 |
| --- | --- | --- |
| `docs/Danh sách nhân sự 2026.xlsx` | File gốc bất biến để đối chiếu | `3e88290c865b73870c6557ff06b8273fcff012f22225c094526d020c39359a60` |
| `docs/hr-template/archive/baseline-values-2026-user-formatted-source.xlsx` | Bản người dùng đã format, build input bất biến | `8c4d54aa757fc75a16a5ab15b031c1245668a0dfdc4a99afb42f6ea143fef195` |
| `docs/hr-template/baseline-values-2026.xlsx` | Baseline sạch dùng cho import/đối chiếu | `d8f4ff9e292b68d1ec50b623159ef34095f7441d3487fa1e422140f0fdeaadbe` |

Không sửa/save lại file gốc hoặc archive. Builder Phase 0.1 luôn tạo output từ archive đã khóa checksum.

### 3.2 Cấu trúc baseline cuối

- Chỉ còn ba sheet vật lý và đều visible: `GIAM`, `TĂNG`, `T6-26`.
- Không giữ `T1-26` đến `T5-26`; baseline nghiệp vụ bắt đầu tại tháng 6/2026.
- Hệ thống chỉ tạo `T7-26` trở đi khi Manager mở/tạo tháng tương ứng.
- `GIAM` và `TĂNG` giữ nguyên dữ liệu lịch sử do người dùng format.
- `T6-26` là sheet dữ liệu nền, vùng hợp lệ `A1:AH333`.
- Header ở hàng 4; 329 nhân sự ở hàng 5–333.
- `AH4 = NGÀY NGHỈ PHÉP`; `AH5:AH333` trống tại baseline.
- Không còn sheet ẩn, formula cell, shared-string của sheet đã xóa hoặc relationship mồ côi.

### 3.3 Mapping T6-26

```text
Mới A:J  <- Gốc A:J
Mới K:P  <- Gốc L:Q
Mới Q:U  <- Gốc T:X
Mới V:AG <- Gốc AA:AL
Mới AH   <- Cột ngày nghỉ phép mới
```

Các cột gốc `K`, `R`, `S`, `Y`, `Z` là helper/lookup/validation và không thuộc allowlist hồ sơ chính. Adapter import phải dùng mapping field đã chốt, không suy luận DB field trực tiếp từ chữ cột Excel.

### 3.4 Dữ liệu cần xác minh

- Cột `Z` còn 29 literal `#N/A`, đúng cached error ở file gốc.
- Phase 2 phải coi các ô này là dữ liệu thiếu/cần xác minh, không insert chuỗi `#N/A` như giá trị nghiệp vụ.
- Header `Z4` của file người dùng đang ghi `NƠI SINH (Sau sát nhập)`; baseline giữ nguyên để bảo toàn bản format. UI/schema có thể chuẩn hóa nhãn thành `NƠI SINH (SAU SÁP NHẬP)` mà không sửa dữ liệu đã khóa.

### 3.5 Quy tắc tăng/giảm và snapshot

- Tăng có hiệu lực tháng nào thì nhân sự xuất hiện trong snapshot từ tháng đó.
- Giảm có hiệu lực tháng nào thì nhân sự không còn trong snapshot cuối tháng đó và các tháng sau.
- Nhân sự giảm vẫn giữ hồ sơ, lịch sử và audit; không hard-delete nghiệp vụ.
- Snapshot `CLOSED` là bất biến; điều chỉnh về sau phải có bản ghi điều chỉnh.
- Trạng thái tháng dự kiến: `DRAFT`, `OPEN`, `CLOSED`, `EXPORTED`.

## 4. Mô hình dữ liệu dự kiến

- `hr_employees`: hồ sơ cốt lõi, không có `user_id`.
- `hr_employee_employment`: công việc, hợp đồng hiện tại, lương/phụ cấp và mốc tính phép.
- `hr_employee_identity`: CCCD/giấy tờ định danh.
- `hr_employee_insurance`: BHXH, BHYT và thông tin liên quan.
- `hr_employee_contacts`: địa chỉ, điện thoại, liên hệ khẩn cấp.
- `hr_departments`, `hr_positions`, `hr_working_conditions`: danh mục HR riêng.
- `hr_employee_movements`: tăng, giảm, chuyển đơn vị/chức vụ, điều chỉnh.
- `hr_monthly_rosters`: kỳ snapshot tháng.
- `hr_monthly_roster_items`: snapshot nhân sự và ngày phép tại thời điểm chốt.
- `hr_excel_import_batches` và row results: audit/rollback import.
- `hr_excel_template_versions`: version/checksum template.
- `hr_audit_events`: audit append-only, actor dạng snapshot chuỗi và không FK tới User.
- Nhóm bảng nghỉ phép thiết kế riêng ở Phase 7–8.

Field nhạy cảm phải được mask ở list, kiểm soát quyền ở API, không ghi log và có audit khi xem/export.

## 5. Giao diện Manager dự kiến

Navigation riêng tại `/manager/hr`:

1. Tổng quan.
2. Danh sách nhân sự.
3. Tăng/Giảm.
4. Danh sách theo tháng.
5. Nghỉ phép.
6. Phòng ban HR.
7. Chức vụ HR.
8. Điều kiện lao động.
9. Import/Export.
10. Nhật ký thay đổi.

Trang chi tiết nhân sự dự kiến có: thông tin chung, công việc, bảo hiểm, định danh, liên hệ, đào tạo, nghỉ phép, tăng/giảm, lịch sử tháng và audit.

## 6. Kế hoạch theo phase

### Phase 0 — Chốt kiến trúc và chọn nguồn

Trạng thái: **hoàn thành**.

- Chốt `Employee`/danh mục HR tách khỏi User và chỉ `MANAGER` truy cập.
- Khóa file gốc và chọn `T6-26` làm nguồn dữ liệu so sánh.
- Phân tích workbook/công thức/helper columns mà không sửa file gốc.

### Phase 0.1 — Khóa baseline người dùng đã format

Trạng thái: **hoàn thành ngày 2026-07-22**.

- Lưu byte-identical archive của bản người dùng đã format.
- Chỉ giữ `GIAM`, `TĂNG`, `T6-26`.
- Thu `T6-26` từ used-range `A1:CT1000` về `A1:AH333`.
- Xóa 25 sheet ẩn, vùng helper/rác, relationship/comment/drawing mồ côi.
- Giữ nguyên value/type/style của 14.657 cell được giữ trên ba sheet; `styles.xml` không đổi.
- Giữ 20 comment cần thiết.
- Chuyển 29 pseudo-formula lỗi thành 29 literal `#N/A`; final còn 0 công thức.
- Đối chiếu file gốc: `T6-26` 10.857 ô, `GIAM` 130 ô có dữ liệu, `TĂNG` 119 ô có dữ liệu; tất cả 0 mismatch.
- ZIP, deterministic verifier, manifest, LibreOffice headless open/PDF smoke đều `PASS`.
- Không thay đổi backend, frontend, database hoặc server.

Chi tiết: [Báo cáo Phase 0.1](hr-template/PHASE_0_1_BASELINE_REPORT.md).

### Phase 1 — Schema HR độc lập

Trạng thái: **hoàn thành ngày 2026-07-22 ở source code; chưa chạy production**.

- Đã thêm Flyway, baseline version `0` cho schema BookingBase hiện hữu và V1 tạo 15 bảng `hr_*`.
- Migration chỉ tạo object HR; không sửa, xóa hoặc liên kết tới bảng legacy.
- Đã tạo entity/repository nền, index, constraint, audit fields và Java enum/status contract.
- `hr_employees` không có `user_id`; toàn bộ audit actor là snapshot chuỗi, không FK tới `users`.
- Có raw staging cho dữ liệu trùng/sai định dạng; không ép unique BHXH/CMND gây mất dữ liệu.
- Hibernate schema filter chặn `ddl-auto` thay đổi `hr_*`; Flyway là owner duy nhất của schema HR.
- Repository mặc định không expose delete; snapshot/import history dùng RESTRICT và status lifecycle có CHECK ngữ nghĩa.
- Import retry tách theo `attempt_number`; audit HR chuẩn hóa UTC.
- Có test clean migrate, migrate lần hai no-op, baseline schema cũ bảo toàn dữ liệu, domain isolation và MySQL 8 ORM validation.
- Có quy trình final backup sau khi production dừng, row-count comparison, first-deploy opt-in, verifier và rollback tại [HR_PHASE_1_SCHEMA.md](HR_PHASE_1_SCHEMA.md).

### Phase 2 — Import baseline T6-26

- Dùng `baseline-values-2026.xlsx`, không dùng trực tiếp file gốc/archive.
- Parse schema `T6-26!A4:AH333`; dữ liệu nhân sự ở hàng 5–333.
- Upload -> parse -> preview -> validate -> confirm; không insert ngay khi upload.
- Mapping theo field allowlist, không map DB bằng vị trí cột một cách ngầm định.
- Không import literal `#N/A`; báo theo sheet/cell/field để Manager sửa hoặc xác nhận thiếu.
- Idempotency theo checksum và khóa nghiệp vụ.
- Lưu batch/result từng dòng để audit và rollback.

### Phase 3 — Security và API

- Enforce `ROLE_MANAGER` cho `/api/v1/hr/**`.
- List API có pagination, sort, filter; detail dùng DTO và mask PII.
- CRUD, tăng/giảm, mở/chốt tháng, import preview/confirm và export.
- Test 401 khi thiếu token; 403 với `ADMIN`/`EMPLOYEE`.

### Phase 4 — Giao diện quản lý HR

- Layout/nav riêng cho Manager.
- List/detail/form thêm-sửa, filter, sort, pagination.
- Xác nhận rõ trước giảm nhân sự, xóa bản nháp sai hoặc export PII.
- Không load toàn bộ nhân sự một lần.

### Phase 5 — Tăng/Giảm và snapshot tháng

- Movement có ngày hiệu lực, lý do, người thao tác và trạng thái.
- Tạo/chốt/reopen có kiểm soát và audit.
- Kế thừa snapshot theo quy tắc tăng/giảm.
- Hard-delete chỉ cho bản nháp/sai import chưa có reference.

### Phase 6 — Import/Export Excel hoàn chỉnh

- Dùng template version đã khóa; không save trực tiếp source/baseline.
- Dự kiến dùng Apache POI `XSSFWorkbook` cho workbook có format phức tạp.
- Có blank import template riêng, không phát tán baseline có PII.
- Export `GIAM`, `TĂNG`, `T6-26` và các tháng từ `T7-26` được yêu cầu.
- Ghi dữ liệu bằng allowlist rồi chạy contract verifier.

### Phase 7 — Tính và lưu ngày phép

- Rule phép có version/effective date, không hard-code chỉ trong Excel.
- Backend tính theo ngày bắt đầu tính phép, điều kiện lao động, thâm niên và chính sách.
- Lưu kết quả cùng calculation snapshot để giải thích lịch sử.
- Điều chỉnh phải có lý do và audit.

### Phase 8 — Đơn nghỉ và phê duyệt HR

- Flow riêng, không dùng booking approval.
- Quản lý số dư, đơn nghỉ, hủy, phê duyệt và lịch sử.
- Chống trừ phép hai lần bằng transaction/idempotency.

### Phase 9 — Báo cáo, audit và UAT

- Báo cáo headcount, tăng/giảm, bảo hiểm, hồ sơ thiếu và ngày phép.
- Audit truy cập/export PII.
- UAT đối chiếu DB, UI và Excel với dữ liệu thực.
- Tài liệu vận hành, backup/restore và rollback.

## 7. Gate sau Phase 1, trước Phase 2

Phase 0.1 đã đạt:

- File gốc/archive checksum đúng và không bị ghi đè.
- Final đúng ba sheet visible, 0 hidden, 0 formula, 329 nhân sự/329 mã duy nhất.
- `T6-26` đúng `A1:AH333`, cột ngày phép `AH` trống.
- Data/comment/style comparison và deterministic verifier đều `PASS`.
- Workbook có PII bị ignore, quyền `600`; manifest không chứa dữ liệu nhân sự.

Phase 1 đã đạt:

- Flyway V1 tạo đúng 15 bảng HR và chạy lại là no-op.
- Schema HR không có `user_id` hoặc foreign key tới `users`.
- Đã có `leave_accrual_start_date`; rule phép có version/effective date vẫn thuộc Phase 7.
- Dữ liệu tuổi, thâm niên và tổng thu nhập được xác định là derived, không persist trùng.
- Dữ liệu nguồn trùng/không chuẩn được giữ ở staging trước normalize/confirm.
- V1 và Hibernate mappings đã pass trên MySQL 8.0.46 cô lập; H2 không còn là bằng chứng duy nhất.
- Hibernate update không được tạo/sửa/xóa `hr_*`; history repository không có generic delete.
- Không deploy/restart server và không thay đổi database production trong lúc xây Phase 1.

Trước Phase 2 vẫn phải:

- Áp dụng V1 lên MySQL trong cửa sổ deploy riêng, có backup và chạy verifier.
- Dùng baseline đã khóa; không seed 329 nhân sự hoặc 9 tăng/2 giảm bằng migration schema.
- Thiết kế preview/validate/confirm và rollback batch trước khi viết dữ liệu chính thức.

## 8. Nguyên tắc không được vi phạm

- Không ghi đè file gốc hoặc archive bản người dùng format.
- Không commit workbook chứa PII hoặc đóng gói workbook vào production JAR.
- Không tự biến `#N/A` thành dữ liệu hợp lệ.
- Không đổi flow login/profile/booking để phục vụ HR.
- Không hard-delete lịch sử nhân sự đã phát sinh nghiệp vụ.
- Không log CCCD, BHXH, BHYT, token hoặc nội dung file import nhạy cảm.
- Không xem blank template và baseline chứa PII là cùng một artifact.
