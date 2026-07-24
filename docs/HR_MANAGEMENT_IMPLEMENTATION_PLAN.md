# Kế Hoạch Triển Khai Phân Hệ Quản Lý Nhân Sự

Cập nhật: 2026-07-24
Trạng thái: **Phase 0.1–6 hoàn thành ở source code và automated test; Phase 5–6 chờ deploy/UAT runtime; Phase 7 ứng viên thử việc đã triển khai source schema/API/UI, chờ deploy/UAT; ngày phép tự động đã gỡ/defer**

Ghi nhận vận hành: ngày `2026-07-23`, người dùng hiệu chỉnh số liệu lịch sử: `T6-26` đúng là `339` nhân sự, không phải `329`. Agent chưa query độc lập database/runtime, nên preview/import mới vẫn là gate bắt buộc.

## 1. Mục tiêu

Xây dựng phân hệ HR độc lập trong BookingBase để role `MANAGER` có thể:

- Quản lý hồ sơ nhân sự, phòng ban, chức vụ và điều kiện lao động.
- Thêm, sửa, xem chi tiết, xử lý hồ sơ sai và ghi nhận ngừng làm việc.
- Theo dõi tăng/giảm nhân sự theo tháng.
- Tạo/chốt snapshot danh sách nhân sự tháng.
- Import có preview/validate và export Excel.
- Quản lý ứng viên thử việc và sinh hợp đồng thử việc Word.
- Quản lý CCCD, BHXH, BHYT, liên hệ và quá trình công tác.
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
- Backend dùng `/api/v1/hr/**`.
- Frontend dùng `/manager/hr`.
- Backend luôn enforce authorization; ẩn menu frontend không thay thế kiểm tra quyền.

### 2.4 Flow độc lập

- Không dùng booking approval cho nghỉ phép hoặc biến động nhân sự.
- Không gộp HR với calendar phòng/xe.
- Flow phê duyệt nghỉ phép, nếu làm, là flow HR riêng.
- Ứng viên thử việc là domain trước `HrEmployee`; không tự động tính vào roster chính thức.

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
- Ngoại lệ bất biến: nếu snapshot tháng hiệu lực đã `CLOSED` (đặc biệt baseline T6), movement xác nhận muộn không sửa snapshot cũ mà được áp dụng vào kỳ kế tiếp chưa chốt.
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
- Dữ liệu `leave_days` trong snapshot/schema được giữ để không mất dữ liệu đã import, nhưng tính ngày phép tự động không còn active trong source hiện tại.
- Nhóm bảng ứng viên thử việc/hợp đồng Word đã thêm ở Phase 7 qua Flyway V3.

Field nhạy cảm phải được mask ở list, kiểm soát quyền ở API, không ghi log và có audit khi xem/export.

## 5. Giao diện Manager dự kiến

Navigation riêng tại `/manager/hr`:

1. Tổng quan.
2. Danh sách nhân sự.
3. Tăng/Giảm.
4. Danh sách theo tháng.
5. Ứng viên thử việc.
6. Phòng ban HR.
7. Chức vụ HR.
8. Điều kiện lao động.
9. Import/Export.
10. Nhật ký thay đổi.

Trang chi tiết nhân sự dự kiến có: thông tin chung, công việc, bảo hiểm, định danh, liên hệ, đào tạo, tăng/giảm, lịch sử tháng và audit. Ngày phép/chấm nghỉ chỉ làm lại ở phase riêng khi có rule chính thức.

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

Trạng thái: **hoàn thành ngày 2026-07-22 ở source code/test cô lập; người dùng xác nhận migration đã được chạy ngày 2026-07-23 nhưng agent chưa query độc lập runtime**.

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

Trạng thái: **hoàn thành ngày 2026-07-22 ở source code/test cô lập; người dùng xác nhận đã import baseline 329 nhân sự ngày 2026-07-23 nhưng agent chưa query độc lập runtime**.

- Dùng `baseline-values-2026.xlsx`, không dùng trực tiếp file gốc/archive.
- Parse schema `T6-26!A4:AH333`; dữ liệu nhân sự ở hàng 5–333.
- Upload -> parse -> preview -> validate -> confirm; không insert ngay khi upload.
- Mapping theo field allowlist, không map DB bằng vị trí cột một cách ngầm định.
- Không import literal `#N/A`; báo theo sheet/cell/field để Manager sửa hoặc xác nhận thiếu.
- Idempotency theo checksum và khóa nghiệp vụ.
- Lưu batch/result từng dòng để audit và rollback.
- Confirm tạo Employee/hồ sơ/movement/snapshot T6 trong một transaction; xung đột rollback toàn bộ.
- Rollback chỉ chạy khi chưa có dữ liệu downstream và luôn giữ batch/audit.
- V2 purge raw/normalized staging PII sau deadline; batch preview bị bỏ quên cũng hết hạn.
- Snapshot roster không sao chép CCCD/BHXH/BHYT/địa chỉ/lương.

Chi tiết: [HR Phase 2 — Import baseline T6-26](HR_PHASE_2_BASELINE_IMPORT.md).

### Phase 3 — Security và API

Trạng thái: **hoàn thành ngày 2026-07-22 ở source code và test cô lập; trạng thái runtime hiện tại chưa được agent kiểm tra độc lập**.

- Enforce `ROLE_MANAGER` cho `/api/v1/hr/**`.
- List API có pagination, sort, filter; detail dùng DTO và mask PII.
- Actor của thao tác ghi luôn lấy từ authenticated principal; request body không được truyền actor giả.
- Có overview; list/detail; tạo và sửa hồ sơ `DRAFT`; CRUD/ngừng dùng danh mục HR riêng.
- Expose flow import Phase 2 qua HTTP: history, upload, preview, validate, confirm và rollback.
- Có API read-only cho movement, roster, roster item và audit để phục vụ kiểm tra dữ liệu hiện có.
- PII/compensation không xuất hiện ở list, detail được mask; edit không làm mất giá trị đã che khi client bỏ trống.
- Test HTTP đạt: `401` khi thiếu token, `403` với `ADMIN`/`EMPLOYEE`, `200` chỉ với `MANAGER`.
- Tăng/giảm, mở/chốt tháng và export đúng template vẫn thuộc Phase 5–6; Phase 3 không tạo action giả.

### Phase 4 — Giao diện quản lý HR

Trạng thái: **hoàn thành source và automated verification ngày 2026-07-23; chờ deploy/UAT runtime**.

- `MANAGER` login/silent refresh/PWA root tự chuyển tới `/manager/hr`; deep link được SPA forward.
- Dùng chung `DashboardLayout`, notification và push hiện tại; có nav HR responsive riêng cho Manager.
- Có overview, list/detail/form hồ sơ `DRAFT`, filter/sort/pagination, quản lý danh mục và import baseline.
- Có màn hình read-only cho Tăng/Giảm, danh sách tháng và audit, ghi rõ chức năng ghi thuộc Phase 5–6.
- Route HR lazy-load; danh sách không tải toàn bộ nhân sự một lần.
- Chưa triển khai xác nhận giảm nhân sự, mở/chốt tháng, xóa bản nháp hoặc export PII vì phụ thuộc Phase 5–6.
- Đã hoàn thiện trải nghiệm với baseline thật: catalog tải đủ mọi trang, deep link roster tự tải metadata, import đã confirm có trạng thái rõ ràng và rollback nằm trong khu vực khôi phục có xác nhận nhiều lớp.
- Audit trả/hiển thị danh sách trường thay đổi đã lọc; token của tài khoản không còn `ACTIVE` không thể tiếp tục truy cập API bằng phiên cũ.

Phạm vi, acceptance và UAT: [HR Phase 4 — Giao diện Manager](HR_PHASE_4_MANAGER_UI.md).

### Phase 5 — Tăng/Giảm và snapshot tháng

Trạng thái: **hoàn thành source và automated verification ngày 2026-07-23; chưa deploy/restart production, chưa UAT runtime**.

- Tạo thủ công `INCREASE` cho Employee `DRAFT` và `DECREASE` cho Employee `ACTIVE`; movement có ngày hiệu lực, reason/quyết định, principal-derived actor, idempotency key và `rowVersion`.
- Vòng đời movement là `DRAFT -> CONFIRMED/CANCELLED`; movement đã xác nhận là bất biến.
- Tạo đúng tháng liền sau, `DRAFT -> OPEN -> CLOSED`; close dựng lại item để nhận movement vừa xác nhận rồi tạo checksum.
- Reopen chỉ cho kỳ `CLOSED` không phải baseline, chưa export, chưa có kỳ downstream và bắt buộc lý do.
- `T6-26` sinh từ import là baseline bất biến. Movement lịch sử xác nhận muộn không sửa T6 mà được áp dụng idempotent vào kỳ kế tiếp chưa chốt.
- Hard-delete chỉ cho Employee/movement/roster `DRAFT` tạo tay, chưa có reference; mọi action có audit đã lọc.
- UI Manager đã có form Tăng/Giảm, confirm/cancel/delete nháp, tạo/mở/chốt/reopen/delete kỳ và xóa hồ sơ nháp.
- Test khóa baseline hiệu chỉnh: `T6-26 CLOSED` có 339 item/checksum, 339 Employee active và không tạo `T7-26` tự động.

Chi tiết flow, API và UAT: [HR Phase 5 — Tăng/Giảm và danh sách tháng](HR_PHASE_5_WORKFORCE_MONTHLY.md).

### Phase 6 — Export Excel hoàn chỉnh

Trạng thái: **hoàn thành source và automated test ngày 2026-07-23; chưa deploy/restart production, chưa UAT runtime**.

- Export đặt tại `/manager/hr/rosters`.
- Export năm tạo workbook 14 sheet: `TĂNG`, `GIẢM`, `T1-26` ... `T12-26`.
- Export tháng tạo workbook 3 sheet: `TĂNG`, `GIẢM`, `T?-26`.
- Backend dùng template sạch trong `backend/src/main/resources/hr/templates/workforce-export-template.xlsx` để giữ format giống workbook chuẩn nhưng không phụ thuộc workbook PII trong runtime.
- Sheet chưa có roster vẫn có header/format để đúng cấu trúc.
- API vẫn nằm dưới `/api/v1/hr/**`, chỉ `MANAGER` active được tải file.
- Import hàng loạt sheet `TĂNG`/`GIẢM` từ workbook bất kỳ chưa triển khai; hiện import chính vẫn là baseline/transition đã khóa.

Chi tiết: [HR Phase 6 — Export Excel](HR_PHASE_6_EXCEL_EXPORT.md).

### Phase 7 — Ứng viên thử việc và hợp đồng Word

Trạng thái: **đã hoàn thành source schema/API/UI ngày 2026-07-24; chưa deploy/restart production, chưa UAT runtime**.

- Thêm domain `Ứng viên thử việc` trước `HrEmployee`.
- Sinh hợp đồng thử việc `.docx` từ template backend.
- Template đã tạo: `backend/src/main/resources/hr/templates/probation-contract-template.docx`.
- Migration đã thêm: `V3__add_hr_probation_candidates.sql`.
- API nằm dưới `/api/v1/hr/probation/**`.
- UI đặt tại `/manager/hr/probation`, menu Manager là `Thử việc`.
- Có tab `Mẫu công việc thử việc` để tự điền phòng ban/chức vụ/điều kiện/lương/mô tả khi nhập ứng viên.
- Có seeder mẫu công việc mặc định từ file Word gốc: chỉ seed dữ liệu nghiệp vụ an toàn và không ghi đè template Manager đã chỉnh.
- Flow chuẩn: `Ứng viên thử việc -> hợp đồng thử việc -> đạt -> HrEmployee DRAFT -> Tăng nhân sự -> ACTIVE/roster chính thức`.
- Không đưa ứng viên thử việc vào roster chính thức.
- Không tự tạo `Tăng nhân sự` khi ứng viên đạt; Manager vẫn phải xác nhận ở màn `Tăng / Giảm`.
- Ngày phép tự động không còn thuộc Phase 7 hiện tại; nếu làm lại sẽ là phase riêng sau khi có rule TCHC.

Chi tiết: [HR Phase 7 — Ứng viên thử việc và hợp đồng Word](HR_PHASE_7_PROBATION_CONTRACTS.md).

### Phase 8 — Đơn nghỉ và phê duyệt HR

- Flow riêng, không dùng booking approval.
- Quản lý số dư, đơn nghỉ, hủy, phê duyệt và lịch sử.
- Chống trừ phép hai lần bằng transaction/idempotency.

### Phase 9 — Báo cáo, audit và UAT

- Báo cáo headcount, tăng/giảm, bảo hiểm, hồ sơ thiếu và ngày phép.
- Audit truy cập/export PII.
- UAT đối chiếu DB, UI và Excel với dữ liệu thực.
- Tài liệu vận hành, backup/restore và rollback.

## 7. Gate triển khai hiện tại

Phase 0.1 đã đạt:

- File gốc/archive checksum đúng và không bị ghi đè.
- Final đúng ba sheet visible, 0 hidden, 0 formula, 329 nhân sự/329 mã duy nhất.
- `T6-26` đúng `A1:AH333`, cột ngày phép `AH` trống.
- Data/comment/style comparison và deterministic verifier đều `PASS`.
- Workbook có PII bị ignore, quyền `600`; manifest không chứa dữ liệu nhân sự.

Phase 1 đã đạt:

- Flyway V1 tạo đúng 15 bảng HR và chạy lại là no-op.
- Schema HR không có `user_id` hoặc foreign key tới `users`.
- Đã có `leave_accrual_start_date`/`leave_days` ở schema để bảo toàn dữ liệu, nhưng rule phép tự động đã gỡ/defer khỏi source active.
- Dữ liệu tuổi, thâm niên và tổng thu nhập được xác định là derived, không persist trùng.
- Dữ liệu nguồn trùng/không chuẩn được giữ ở staging trước normalize/confirm.
- V1 và Hibernate mappings đã pass trên MySQL 8.0.46 cô lập; H2 không còn là bằng chứng duy nhất.
- Hibernate update không được tạo/sửa/xóa `hr_*`; history repository không có generic delete.
- Trong lượt xây/test Phase 1 ngày `2026-07-22`, agent không deploy/restart server hoặc thay đổi database production.

Phase 2 đã đạt:

- Parser/contract baseline thật, preview/validate/confirm, idempotency và rollback đã pass.
- V2 retention/purge PII đã pass trên H2 và MySQL 8 cô lập.
- Không seed 329 nhân sự hoặc 9 tăng/2 giảm bằng migration schema.
- Trong lượt xây/test Phase 2 ngày `2026-07-22`, agent không deploy/restart server hoặc thay đổi database production.

Ghi nhận sau gate source: người dùng xác nhận ngày `2026-07-23` rằng migration/import baseline đã hoàn tất và có 329 nhân sự. Agent chưa đối chiếu độc lập Employee, `INITIAL_LOAD`, roster `T6-26` và batch `CONFIRMED` trên runtime đó.

Phase 3 đã đạt:

- `/api/v1/hr/**` chỉ cho đúng role `MANAGER`; `ADMIN` không tự kế thừa quyền HR.
- API ghi lấy actor từ authenticated principal; list/detail dùng DTO, pagination và masking.
- Edit hồ sơ chỉ cho `DRAFT`, có optimistic `rowVersion` và giữ nguyên PII/lương khi field bảo vệ bị bỏ trống.
- Frontend `MANAGER` tự vào `/manager/hr`; deep link, PWA root, responsive nav và route lazy-load đã có.
- Frontend lint/build và toàn bộ backend regression suite đạt; rollback import Phase 2 vẫn hoạt động sau mapping Phase 3.
- Trong lượt xây/test Phase 3 ngày `2026-07-22`, agent không tạo account Manager, deploy/restart server hoặc thay đổi database production.

Phase 4 đã đóng gate source/automated:

- Frontend lint/build đạt; PWA/service worker build đạt, còn một lint warning và chunk-size warning cũ.
- Backend target test đạt `8/8`; toàn bộ regression đạt `75` test, `0` failure/error và `1` skip theo điều kiện môi trường.
- Production JAR chứa frontend mới build thành công; `git diff --check` đạt.
- Chưa có read-only reconciliation độc lập cho 329 Employee, 329 `INITIAL_LOAD`, snapshot `T6-26` và batch import trên runtime người dùng vừa thao tác.
- Chưa deploy/restart server và chưa hoàn tất browser UAT desktop/mobile trong lượt này.

Phase 5 đã đóng gate source/automated:

- API ghi lấy actor từ principal `MANAGER`; không thêm liên kết Employee -> User và không đổi login/profile/booking.
- Lock/version/idempotency và guard hard-delete đã có; confirmed history và baseline không thể hard-delete.
- T6 baseline bất biến; snapshot kế thừa áp dụng movement theo ngày hiệu lực và tạo checksum khi chốt.
- Target integration/controller/security test đạt; full backend regression đạt 80 test, 0 failure/error và 1 skip; frontend lint/build đạt.
- Chưa deploy/restart server, chưa chạy movement trên database người dùng và chưa UAT browser/runtime.

Phase 6 đã đóng gate source/automated:

- Export năm/tháng có API và UI đúng vị trí `/manager/hr/rosters`.
- Export năm trả workbook 14 sheet; export tháng trả workbook 3 sheet.
- Template format đã chuyển vào backend resource để production JAR tự mang theo.
- Automated test khóa attachment XLSX và số sheet export.
- Chưa deploy/restart server và chưa UAT runtime trên database người dùng.

Phase 7 đã đóng gate source cơ bản:

- File nguồn Word đã được phân tích: có 10 hợp đồng đã điền, không có mail merge/content control.
- Template backend sạch đã tạo, còn một hợp đồng và 22 placeholder.
- Đã verify không còn tên/CCCD mẫu trong `probation-contract-template.docx`.
- Đã có Flyway V3, entity/repository/service/controller, API client và trang `/manager/hr/probation`.
- Backend compile pass; frontend build/lint pass; migration target tests pass với V1/V2/V3.
- Full backend regression hiện bị chặn bởi Mockito inline/ByteBuddy self-attach trên JDK 25 Fedora, không phải failure migration/source Phase 7.
- Tính ngày phép tự động đã gỡ khỏi backend/frontend; cột/schema `leave_days` vẫn giữ để không mất dữ liệu đã import hoặc snapshot cũ.

Do người dùng đã xác nhận migration/import được thực hiện, bước tiếp theo không phải chạy lại initialization hoặc baseline. Trước UAT ghi Phase 5 cần backup, đối chiếu read-only đúng runtime và dùng hồ sơ test riêng.

## 8. Nguyên tắc không được vi phạm

- Không ghi đè file gốc hoặc archive bản người dùng format.
- Không commit workbook chứa PII hoặc đóng gói workbook vào production JAR.
- Không tự biến `#N/A` thành dữ liệu hợp lệ.
- Không đổi flow login/profile/booking để phục vụ HR.
- Không hard-delete lịch sử nhân sự đã phát sinh nghiệp vụ.
- Không log CCCD, BHXH, BHYT, token hoặc nội dung file import nhạy cảm.
- Không xem blank template và baseline chứa PII là cùng một artifact.
