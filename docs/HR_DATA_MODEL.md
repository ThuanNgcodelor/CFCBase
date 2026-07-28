# Mô hình dữ liệu HR hiện tại và Google Sheets đề xuất

Cập nhật: 2026-07-28
Trạng thái: thiết kế logic, chưa tạo sheet và chưa migration dữ liệu.

## 1. Kết luận

Prototype Apps Script hiện tại không có data model HR đúng nghĩa. Nó đọc một tab `T6-26`, đoán vị trí cột, tạo ID từ số dòng và chỉ tạo thêm `Changes_Log` khi ghi biến động. Cách này không thể bảo toàn quan hệ, lịch sử, phân quyền, idempotency hoặc rollback.

Mô hình đích phải:

- dùng UUID ổn định, giữ `legacy_id` để chuyển đổi qua lại;
- tách current state khỏi append-only history;
- không dùng họ tên hoặc số dòng làm khóa;
- chuẩn hóa catalog và FK logic;
- lưu template/document metadata tách khỏi job preset;
- soft-delete/archive dữ liệu nghiệp vụ;
- có `row_version`, audit fields và schema version;
- cho phép đối soát với 18 bảng `hr_*` hiện tại;
- không backfill lịch sử chưa tồn tại bằng suy đoán.

## 2. Mô hình MySQL hiện tại

Flyway hiện tạo 15 bảng ở V1, thêm 3 bảng thử việc ở V3 và thêm liên kết correction ở V4.

| Nhóm | Bảng hiện tại | Vai trò | Nguồn |
|---|---|---|---|
| Template/import | `hr_excel_template_versions`, `hr_excel_import_batches`, `hr_excel_import_rows` | version workbook, staging/preview/confirm/rollback | `V1__create_hr_phase_1_schema.sql:5-83,398-420`; V2 retention |
| Catalog | `hr_departments`, `hr_positions`, `hr_working_conditions` | danh mục HR độc lập | V1:85-146 |
| Employee | `hr_employees` | hồ sơ cốt lõi/status | V1:148-174 |
| Employee detail | `hr_employee_employment`, `hr_employee_identity`, `hr_employee_insurance`, `hr_employee_contacts` | công việc, định danh, bảo hiểm, liên hệ hiện tại | V1:176-260 |
| Workforce | `hr_employee_movements` | ledger baseline/tăng/giảm/correction | V1:262-318; V4 |
| Roster | `hr_monthly_rosters`, `hr_monthly_roster_items` | baseline/snapshot tháng | V1:320-396 |
| Audit | `hr_audit_events` | audit append-only đã lọc | V1:422-435 |
| Probation | `hr_probation_job_templates`, `hr_probation_candidates`, `hr_probation_contracts` | job preset, candidate, DOCX history | V3:5-117 |

### 2.1. Điểm mạnh cần giữ

- `HrEmployee` tách khỏi tài khoản `User`.
- Employee code unique; status có allowlist.
- Catalog có UUID, code/name unique và parent department.
- Movement có effective date, lifecycle, idempotency, actor và correction link.
- Baseline/roster item giữ snapshot và checksum.
- Import có batch/row/status/checksum/retention.
- Generated DOCX có template SHA, output SHA và placeholder snapshot.
- Audit không FK vào user, giữ snapshot actor.

### 2.2. Khoảng trống của schema hiện tại

- Chỉ lưu hợp đồng lao động hiện tại trong `hr_employee_employment`; chưa có lịch sử hợp đồng chung.
- Chưa có attachment repository.
- Chưa có document-template registry/version cho Google Docs.
- Chưa có generated-document API lịch sử đầy đủ, PDF/Drive metadata hoặc void command.
- Chưa có workflow nâng lương/phụ cấp/điều chuyển/tạm nghỉ hoàn chỉnh.
- Không có fine-grained HR role/permission tables.
- Audit chưa phải event store đủ để phục dựng mọi field.

## 3. Data model Apps Script hiện tại

### 3.1. Workbook

`QuanLyNhanSu_AppScripts/Quan_Ly_Nhan_Su.xlsx` có một tab `T6-26` với 336 mã nhân sự duy nhất trong file được audit. Đây là artifact Excel, không phải Google Sheets schema versioned.

`EmployeeService.getAllEmployees()`:

- đọc `getDataRange()` toàn tab;
- dò header trong 10 dòng đầu;
- tạo `id = EMP_<row>`;
- map cột Q/R/S thành status/CCCD/địa chỉ dù dữ liệu thật lần lượt là loại hợp đồng/số hợp đồng/năm công tác;
- chèn default giả như giới tính, phòng ban, ngày vào làm và địa chỉ khi ô trống.

Nguồn: `QuanLyNhanSu_AppScripts/EmployeeService.js:18-95`.

### 3.2. Movement

`ChangeLogService.addChangeLog()` tạo/append tám cột vào `Changes_Log`, không có UUID, employee FK, before/after, actor, status, idempotency hoặc confirmation. `getChangeLogs(month, year)` không dùng tham số filter.

Nguồn: `QuanLyNhanSu_AppScripts/ChangeLogService.js:6-59`.

### 3.3. Kết luận

Không migrate tiếp trên cấu trúc này. File hiện tại chỉ được giữ như input evidence, checksum và staging source; không được biến nó thành database production bằng cách thêm dần cột.

## 4. Quy ước dữ liệu đích

### 4.1. Kiểu logic

| Ký hiệu | Lưu trên Sheet | Quy tắc |
|---|---|---|
| `text` | text Unicode | normalize NFC, trim theo field, giới hạn độ dài trong schema; không dùng làm FK nếu đã có UUID |
| `number` | number nguyên an toàn | validate finite/integer và min/max theo field; không dùng số thực cho ID |
| `UUID` | text 36 ký tự | tạo bằng `Utilities.getUuid()`, immutable |
| `CODE` | text | trim, Unicode normalize theo rule, unique có index in-memory |
| `DATE` | text ISO `yyyy-MM-dd` hoặc Date cell thống nhất | không dùng chuỗi `dd/MM/yyyy` làm storage |
| `DATETIME` | ISO-8601 UTC | hiển thị theo `Asia/Ho_Chi_Minh` |
| `DECIMAL` | number | không ghép `đ`, không dùng string đã format |
| `ENUM` | text allowlist | validate server trước write |
| `BOOL` | boolean | không dùng `Có/Không` làm storage |
| `JSON` | canonical JSON string | chỉ cho snapshot/metadata bounded; không thay thế cột query chính |
| `SHA256` | lowercase hex 64 | checksum canonical payload/artifact |

### 4.2. Cột audit chuẩn

Mọi master/workflow row mutable có:

```text
created_at, created_by, updated_at, updated_by, row_version,
record_status, legacy_system, legacy_id, source_hash
```

- `record_status`: `ACTIVE`, `INACTIVE`, `ARCHIVED`; chỉ dùng `DELETED` nếu policy soft-delete đã chốt.
- `row_version` tăng sau mỗi write thành công và được client gửi lại.
- Ledger append-only không update nội dung đã confirm; correction là row mới.

### 4.3. FK logic

Google Sheets không enforce FK. Repository/validator phải:

- build index UUID/code bằng một batch read;
- chặn FK mồ côi trước write;
- chạy reconciliation định kỳ;
- không cascade delete;
- archive parent chỉ khi không vi phạm policy reference.

## 5. Cấu trúc workbook đề xuất

Khởi đầu dùng một **operational workbook** do tài khoản/Shared Drive tổ chức sở hữu và một vùng audit/migration hạn chế. Việc tách thành nhiều spreadsheet chỉ thực hiện sau load/permission test vì cross-file write không có transaction.

Không cấp quyền editor trực tiếp cho người chỉ sử dụng web app. Nếu mô hình deployment bắt buộc share workbook cho mọi user và làm lộ PII ngoài permission service, phải chọn kiến trúc hybrid/backend.

### 5.1. Master employee

#### `EMPLOYEES`

Mục đích: identity nghiệp vụ và trạng thái hiện tại, không chứa toàn bộ PII.

| Cột | Type | Required | Rule |
|---|---|---:|---|
| `employee_id` | UUID | yes | PK, immutable |
| `employee_code` | CODE | yes | unique, không tái sử dụng nếu chưa có policy |
| `full_name` | text | yes | không làm key |
| `gender` | ENUM | yes | `MALE/FEMALE/OTHER/UNKNOWN` |
| `date_of_birth` | DATE | no | ngày hợp lệ |
| `ethnicity`, `religion` | text | no | controlled text nếu có catalog |
| `birth_place_original`, `birth_place_current` | text | no | giữ riêng legacy/current |
| `education_level`, `major` | text | no |  |
| `employment_status` | ENUM | yes | `DRAFT/ACTIVE/INACTIVE` |
| `status_effective_date` | DATE | no | phải khớp movement confirmed |
| audit/source columns | mixed | yes | theo mục 4.2 |

Chống trùng: employee code unique; CCCD/BHXH chỉ phát cảnh báo vì nguồn cũ có ngoại lệ, không merge tự động.

#### `EMPLOYEE_EMPLOYMENT`

Mục đích: trạng thái công việc hiện tại, là projection được cập nhật bởi service/movement.

| Cột | Type | Required | FK/rule |
|---|---|---:|---|
| `employee_id` | UUID | yes | PK/FK `EMPLOYEES` 1:1 |
| `department_id`, `position_id`, `working_condition_id` | UUID | no | FK catalog |
| `hire_date`, `official_date`, `termination_date` | DATE | no | termination >= hire |
| `contract_type_code`, `current_contract_id` | CODE/UUID | no | FK contract nếu phase được duyệt |
| `base_salary`, `allowance` | DECIMAL | no | >= 0; restricted DTO |
| `job_description` | text | no | bounded |
| audit/source columns | mixed | yes | row version riêng |

Không persist `total_income` nếu chỉ là `base_salary + allowance`; tính khi trả DTO/export.

#### `EMPLOYEE_IDENTITY`

Mục đích: PII định danh, quyền truy cập chặt.

`employee_id:UUID* PK/FK`, `legacy_identity_number:text?`, `citizen_id:text?`, `issued_date:DATE?`, `issued_place:text?`, `verification_status:ENUM*`, audit/source columns.

Allowlist status: `UNVERIFIED/VERIFIED/NEEDS_REVIEW`. Index normalized chỉ dùng trong server; không trả ở list API.

#### `EMPLOYEE_INSURANCE`

`employee_id:UUID* PK/FK`, `social_insurance_number:text?`, `health_insurance_number:text?`, `valid_from:DATE?`, `valid_until:DATE?`, `insurance_status:ENUM*`, audit/source columns.

Chống trùng: warning report + review, không auto merge.

#### `EMPLOYEE_CONTACTS`

`employee_id:UUID* PK/FK`, `permanent_address:text?`, `current_address:text?`, `phone:text?`, `work_email:text?`, `personal_email:text?`, `emergency_contact_name:text?`, `emergency_contact_phone:text?`, `emergency_contact_relation:text?`, audit/source columns.

Email normalized lowercase; phone giữ text để không mất số 0.

### 5.2. Catalog

#### `DEPARTMENTS`

`department_id:UUID* PK`, `code:CODE* unique`, `name:text* unique-normalized`, `parent_department_id:UUID? FK self`, `description:text?`, `sort_order:number*`, `catalog_status:ACTIVE/INACTIVE`, audit/source columns.

Chặn self-parent và cycle; không archive khi còn employee active nếu policy chưa cho phép.

#### `POSITIONS`

`position_id:UUID* PK`, `code:CODE* unique`, `name:text* unique-normalized`, `description:text?`, `sort_order:number*`, `catalog_status:ACTIVE/INACTIVE`, audit/source columns.

#### `WORKING_CONDITIONS`

`working_condition_id:UUID* PK`, `code:CODE* unique`, `name:text* unique-normalized`, `description:text?`, `sort_order:number*`, `catalog_status:ACTIVE/INACTIVE`, audit/source columns.

### 5.3. Lịch sử và roster

#### `WORKFORCE_MOVEMENTS`

| Cột | Type | Required | Rule |
|---|---|---:|---|
| `movement_id` | UUID | yes | PK |
| `employee_id` | UUID | yes | FK employee |
| `movement_type` | ENUM | yes | chỉ enable loại đã có business rule |
| `movement_status` | ENUM | yes | `DRAFT/CONFIRMED/CANCELLED` |
| `effective_date` | DATE | yes | ngày nghiệp vụ |
| `from_*_id`, `to_*_id` | UUID | no | department/position/condition |
| `from_employee_status`, `to_employee_status` | ENUM | no | state transition |
| `reason`, `decision_number`, `decision_date` | mixed | theo type | Giảm bắt buộc reason |
| `correction_of_movement_id` | UUID | no | self FK; row gốc không bị sửa |
| `idempotency_key` | text | yes cho write | unique |
| `confirmed_at/by`, `cancelled_at/by` | datetime/text | theo status | lifecycle invariant |
| audit/source columns | mixed | yes | append-only sau confirm |

Các enum `TRANSFER`, `POSITION_CHANGE`, `WORKING_CONDITION_CHANGE`, `ADJUSTMENT` có trong schema cũ nhưng chưa đủ end-to-end; không mở trên UI trước BA/test case.

#### `MONTHLY_ROSTERS`

`roster_id:UUID* PK`, `period_start:DATE*`, `roster_kind:ENUM*` (`BASELINE/LIVE_EXPORT_SNAPSHOT`), `snapshot_version:number*`, `roster_status:ENUM*` (`ACTIVE/VOIDED`), `source_roster_id:UUID?`, `item_count:number*`, `roster_checksum:SHA256?`, `generated_at/by`, `exported_at/by`, source/audit columns. Unique `(period_start, roster_kind, snapshot_version)`.

Model active là projection sống từ baseline + confirmed movement. Không khôi phục flow mở/chốt tháng chỉ để khớp ảnh concept cũ.

#### `MONTHLY_ROSTER_ITEMS`

Chỉ dùng cho baseline bất biến và snapshot export cần tái lập: `roster_item_id:UUID*`, `roster_id:UUID*`, `employee_id:UUID*`, `display_order:number*`, snapshot catalog/code/name/status/date, `inclusion_reason:ENUM*`, `source_movement_id:UUID?`, `snapshot_payload:JSON*`, `payload_sha256:SHA256*`, `created_at/by`.

Unique `(roster_id, employee_id)`, `(roster_id, employee_code)`, `(roster_id, display_order)`.

### 5.4. Thử việc, hợp đồng và tài liệu

#### `PROBATION_JOB_TEMPLATES`

Đây là **job preset**, không phải file Google Docs:

`job_template_id:UUID*`, `code:CODE*`, `name:text*`, `version:number*`, catalog FKs và name snapshots, `probation_contract_type`, `job_description`, `base_salary_amount`, `currency`, `salary_note_suffix`, `department_rule_note`, `sort_order`, `template_status:DRAFT/ACTIVE/INACTIVE`, `effective_from/until`, `replaces_version`, `content_sha256`, audit/source columns.

Unique `(code, version)`; chỉ một version của một code được hiệu lực tại một thời điểm. Bản đã được dùng để sinh tài liệu không sửa tại chỗ. Raw salary note từ nguồn được giữ ở source columns để đối soát; suffix chuẩn không lặp literal `đồng/tháng` của bố cục tài liệu.

Current source có 9 preset tại `HrProbationJobTemplateSeeder.DEFAULT_TEMPLATES`, không phải 10 DOCX template.

#### `PROBATION_CANDIDATES`

`candidate_id:UUID*`, `candidate_code:CODE*`, `full_name:text*`, `candidate_title:text?`, `gender:ENUM*`, `date_of_birth:DATE?`, `birth_place:text?`, `nationality:text*`, `citizen_id:text?`, `citizen_id_issued_date:DATE?`, `citizen_id_issued_place:text?`, `permanent_address:text?`, `phone:text?`, `email:text?`, `department_id:UUID?`, `position_id:UUID?`, `working_condition_id:UUID?`, `job_template_id:UUID?`, `probation_contract_type:text?`, `probation_start_date:DATE?`, `probation_end_date:DATE?`, `base_salary:DECIMAL?`, `salary_note:text?`, `job_description:text?`, `department_rule_note:text?`, `candidate_status:ENUM*`, `status_reason:text?`, `converted_employee_id:UUID?`, `converted_at:DATETIME?`, `converted_by:UUID?`, audit/source columns.

PK `candidate_id`; unique `candidate_code` và `converted_employee_id` khi không null; FKs tới catalog, job template, employee và user. Rule required thay đổi theo state: các field hợp đồng phải đầy đủ trước generate, ngày kết thúc không trước ngày bắt đầu và fail/cancel cần reason theo state machine đã duyệt.

Status: `DRAFT/CONTRACT_CREATED/IN_PROBATION/PASSED/FAILED/CONVERTED/CANCELLED`. Candidate không tính vào active roster.

#### `EMPLOYMENT_CONTRACTS`

Mục đích: lịch sử hợp đồng lao động chung. Đây là extension đề xuất; backend hiện chỉ có current contract fields và probation document.

`contract_id:UUID*`, `employee_id:UUID*`, `contract_type_code`, `contract_number`, `signed_date`, `effective_from`, `effective_until`, `contract_status:DRAFT/ACTIVE/EXPIRED/TERMINATED/VOIDED`, `source_document_id:UUID?`, audit/source columns.

Không backfill lịch sử từ một giá trị current contract. Dữ liệu không có nguồn phải ghi `CHƯA XÁC ĐỊNH`.

#### `DOCUMENT_TEMPLATES`

`document_template_id:UUID*`, `template_code:CODE*`, `document_type:ENUM*`, `name:text*`, `drive_file_id:text*`, `drive_revision_id:text?`, `version_code:text*`, `placeholder_schema_version:text*`, `placeholder_manifest_json:JSON*`, `source_docx_sha256:SHA256`, `google_doc_export_sha256:SHA256`, `template_status:DRAFT/IN_REVIEW/ACTIVE/RETIRED`, `effective_from/until`, `replaces_template_id`, approval fields, audit/source columns.

Unique `(template_code, version_code)`; chỉ một active version theo policy/date.

#### `GENERATED_DOCUMENTS`

`generated_document_id:UUID*`, `operation_id:UUID*`, `document_type:ENUM*`, `document_template_id:UUID*`, `document_template_version:CODE*`, `document_template_hash:SHA256*`, `candidate_id:UUID?`, `employee_id:UUID?`, `contract_id:UUID?`, `job_template_id:UUID?`, `job_template_version:number?`, `job_template_hash:SHA256?`, `contract_no:text?`, `contract_year:number?`, `placeholder_schema_version:CODE*`, `secure_snapshot_ref:text*`, `render_payload_hash:SHA256*`, `private_folder_id:text*`, `google_doc_file_id:text?`, `google_doc_sha256:SHA256?`, `docx_file_id:text?`, `docx_sha256:SHA256?`, `pdf_file_id:text?`, `pdf_sha256:SHA256?`, `generation_status:PROCESSING/PREVIEW/GENERATED/SUPERSEDED/VOIDED/FAILED`, `generated_at/by`, `supersedes_document_id:UUID?`, `superseded_by_id:UUID?`, `void_reason?`, `error_code?`, audit/source columns.

Không lưu public URL hoặc snapshot PII inline trong operational sheet. `secure_snapshot_ref` trỏ tới JSON canonical nằm trong vùng Drive riêng có ACL tối thiểu (hoặc reference bất biến tới snapshot legacy còn ở backend); metadata sheet chỉ giữ hash. File permission kế thừa folder hạn chế; tái xuất tạo version mới.

#### Các sheet hỗ trợ tài liệu

- `DOCUMENT_PLACEHOLDER_SCHEMAS`: schema version, manifest canonical, type/required/sensitivity/owner của từng placeholder và SHA-256.
- `CONTRACT_NUMBER_SEQUENCES`: `sequence_id:UUID*`, `contract_type:ENUM*`, `year:number*`, `last_number:number*`, `sequence_status:ENUM*` (`ACTIVE/LOCKED`) và audit; chỉ cập nhật trong script lock/idempotent operation.
- `DOCUMENT_RENDER_EVENTS`: operation/document ID, event type, actor, result, sanitized error và thời điểm; không lưu payload PII.

Lifecycle kỹ thuật nhiều bước của một lần render nằm ở operation journal; trạng thái nghiệp vụ công khai của tài liệu dùng enum `generation_status` nêu trên. Chi tiết chuẩn tại `HR_TEMPLATE_MIGRATION.md`.

#### `ATTACHMENTS`

`attachment_id:UUID*`, `employee_id/candidate_id/contract_id` ít nhất một FK, `attachment_type`, `drive_file_id`, `file_name`, `mime_type`, `size_bytes`, `sha256`, `attachment_status:ACTIVE/ARCHIVED/VOIDED`, `uploaded_at/by`, audit/source columns.

Chống trùng theo owner + SHA + type; quét permission định kỳ.

### 5.5. Quyền, audit, config và migration

| Sheet | Mục đích | Cột typed tối thiểu | PK/unique/status |
|---|---|---|---|
| `USERS` | actor/role mapping, không lưu password | `user_id:UUID`, `email:text`, `display_name`, `org_unit`, audit | PK; email normalized unique; `ACTIVE/INACTIVE` |
| `ROLES` | nhóm quyền | `role_id:UUID`, `role_code`, `name`, audit | code unique; active/inactive |
| `USER_ROLES` | gán role/scope cho actor | `user_role_id:UUID`, `user_id`, `role_id`, `scope_json`, effective dates, audit | PK; unique user+role+scope; active/inactive |
| `ROLE_PERMISSIONS` | quyền server-side | `role_permission_id:UUID`, `role_id`, `permission_code`, `scope_json`, audit | unique role+permission |
| `AUDIT_LOGS` | append-only operation log | `audit_id:UUID`, actor snapshot, action, entity type/id, request ID, changed fields, sanitized metadata, result, occurred_at | PK; không hard-delete |
| `OPERATION_JOURNAL` | idempotency và phục hồi write nhiều bước | `operation_id:UUID`, `idempotency_key`, action, aggregate type/id, request ID, technical status, checkpoint, sanitized error, started/completed_at, actor | PK; idempotency key unique theo action/scope; không hard-delete |
| `SYSTEM_CONFIG` | non-secret config/version | `config_key`, `config_value`, `value_type`, `environment`, `config_status`, audit | key+environment unique |
| `SCHEMA_MIGRATIONS` | version sheet schema | `version`, `name`, `checksum`, `status`, `started/completed_at`, actor | version unique |
| `MIGRATION_RUNS` | manifest/run lifecycle | `run_id`, source, schema version, manifest SHA, counts JSON, watermark, status, timestamps | PK; status lifecycle |
| `ID_MAPPINGS` | old/new stable IDs | source system/type/id, target ID, source hash, run ID, status | unique source tuple |
| `MIGRATION_ROWS` | row staging/result | `migration_row_id`, run ID, entity type/source ID, hash, row status, issue codes | unique run+entity+source |
| `DATA_QUALITY_ISSUES` | duplicate/orphan/missing review | `issue_id`, run/entity/source, issue code/severity, masked detail, resolution/status/actor/time | `OPEN/ACCEPTED/FIXED/IGNORED` |

Secret/IDs môi trường như operational spreadsheet ID, Drive root và deployment config nằm trong Script Properties/secret management phù hợp, không nhân bản trong `SYSTEM_CONFIG` hoặc source.

### 5.6. Data dictionary contract theo từng Sheet

Các mô tả rút gọn ở trên được chuẩn hóa bằng hai bộ cột bắt buộc sau:

- **A — mutable master/workflow:** `created_at:DATETIME*`, `created_by:UUID* FK USERS`, `updated_at:DATETIME*`, `updated_by:UUID* FK USERS`, `row_version:number*`, `record_status:ENUM*`, `legacy_system:text?`, `legacy_id:text?`, `source_hash:SHA256?`. Tài khoản service dùng cho import phải là một `USERS` record được quản trị, không phải email/ID client tự khai.
- **L — append-only ledger/event:** `created_at:DATETIME*`, `created_by:UUID* FK USERS`, `source_hash:SHA256?`; `updated_at/updated_by` không áp dụng và bị cấm. Sửa sai bằng correction/superseding event, không overwrite row.

Dấu `*` là required. FK được repository validate trước write và được reconciliation quét lại; Sheet không tự enforce FK. Cột status bên dưới là enum nghiệp vụ, tách khỏi `record_status` kỹ thuật của bộ A.

#### Hồ sơ và danh mục

| Sheet | Cột typed lõi ngoài A/L | PK, FK và unique | Status/required | Chống trùng và sửa sai |
|---|---|---|---|---|
| `EMPLOYEES` (A) | `employee_id:UUID*`, `employee_code:CODE*`, `full_name:text*`, `gender:ENUM*`, `date_of_birth:DATE?`, `employment_status:ENUM*`, `status_effective_date:DATE?` | PK `employee_id`; unique `employee_code` | `DRAFT/ACTIVE/INACTIVE` | code chặn trùng; giấy tờ chỉ warning/review; không auto-merge |
| `EMPLOYEE_EMPLOYMENT` (A) | `employee_id:UUID*`, `department_id:UUID?`, `position_id:UUID?`, `working_condition_id:UUID?`, `hire_date:DATE?`, `official_date:DATE?`, `termination_date:DATE?`, `contract_type_code:CODE?`, `current_contract_id:UUID?`, `base_salary:DECIMAL?`, `allowance:DECIMAL?`, `job_description:text?` | PK/FK `employee_id -> EMPLOYEES`; FKs catalog/contract nullable | một row hiện tại/employee; dates/salary phải hợp lệ | unique employee; thay đổi active qua command/movement, không generic overwrite |
| `EMPLOYEE_IDENTITY` (A) | `employee_id:UUID*`, `legacy_identity_number:text?`, `citizen_id:text?`, `citizen_id_issued_date:DATE?`, `citizen_id_issued_place:text?`, `verification_status:ENUM*` | PK/FK `employee_id -> EMPLOYEES` | `UNVERIFIED/VERIFIED/NEEDS_REVIEW` | normalized document number tạo issue; ngoại lệ legacy được giữ, không merge |
| `EMPLOYEE_INSURANCE` (A) | `employee_id:UUID*`, `social_insurance_number:text?`, `health_insurance_number:text?`, `valid_from:DATE?`, `valid_until:DATE?`, `insurance_status:ENUM*` | PK/FK `employee_id -> EMPLOYEES` | `UNKNOWN/ACTIVE/INACTIVE/NEEDS_REVIEW` | normalized number warning + owner review; không tự ghi đè |
| `EMPLOYEE_CONTACTS` (A) | `employee_id:UUID*`, `permanent_address:text?`, `current_address:text?`, `phone:text?`, `work_email:text?`, `personal_email:text?`, `emergency_contact_name:text?`, `emergency_contact_phone:text?`, `emergency_contact_relation:text?` | PK/FK `employee_id -> EMPLOYEES` | field tùy chọn; `record_status` từ A | unique employee; email/phone normalized để tìm nhưng không auto-merge |
| `DEPARTMENTS` (A) | `department_id:UUID*`, `code:CODE*`, `name:text*`, `parent_department_id:UUID?`, `description:text?`, `sort_order:number*`, `catalog_status:ENUM*` | PK; self FK parent; unique code và normalized name | `ACTIVE/INACTIVE` | chặn self/cycle; archive bị chặn khi còn reference không hợp lệ |
| `POSITIONS` (A) | `position_id:UUID*`, `code:CODE*`, `name:text*`, `description:text?`, `sort_order:number*`, `catalog_status:ENUM*` | PK; unique code và normalized name | `ACTIVE/INACTIVE` | không tạo bản thứ hai chỉ vì khác hoa/thường/khoảng trắng |
| `WORKING_CONDITIONS` (A) | `working_condition_id:UUID*`, `code:CODE*`, `name:text*`, `description:text?`, `sort_order:number*`, `catalog_status:ENUM*` | PK; unique code và normalized name | `ACTIVE/INACTIVE` | cùng rule dedupe catalog; giữ legacy label qua mapping |

#### Workflow, roster, probation và tài liệu

| Sheet | Cột typed lõi ngoài A/L | PK, FK và unique | Status/required | Chống trùng và sửa sai |
|---|---|---|---|---|
| `WORKFORCE_MOVEMENTS` (A; bất biến sau confirm) | `movement_id:UUID*`, `employee_id:UUID*`, type/status/effective date, from/to catalog/status, reason/decision, correction link, `idempotency_key:text*` | PK; FKs employee/catalog/self; unique idempotency theo command scope | `DRAFT/CONFIRMED/CANCELLED`; required theo type | retry cùng key trả cùng result; confirmed sửa bằng correction row |
| `MONTHLY_ROSTERS` (A; immutable khi phát hành) | `roster_id:UUID*`, `period_start:DATE*`, `roster_kind:ENUM*`, `snapshot_version:number*`, `roster_status:ENUM*`, `source_roster_id:UUID?`, `item_count:number*`, `roster_checksum:SHA256?`, generated/exported actor/time fields | PK; self FK; unique period+kind+snapshot version | kind `BASELINE/LIVE_EXPORT_SNAPSHOT`; status `ACTIVE/VOIDED` | không tạo manual month lifecycle; snapshot mới supersede, không overwrite |
| `MONTHLY_ROSTER_ITEMS` (L) | `roster_item_id:UUID*`, roster/employee IDs, display order, bounded non-PII snapshot, inclusion reason, source movement, payload hash | PK; FKs roster/employee/movement; unique roster+employee, roster+code, roster+order | append-only; required snapshot/hash | checksum + composite unique; sửa roster bằng version mới |
| `PROBATION_JOB_TEMPLATES` (A; immutable sau use) | `job_template_id:UUID*`, `code:CODE*`, `name:text*`, `version:number*`, catalog IDs, contract/job/salary/rule fields, effective dates, content hash | PK; catalog FKs; unique code+version | `DRAFT/ACTIVE/INACTIVE`; required code/name/version/hash | chỉ một version hiệu lực; thay đổi tạo version mới; source record trùng không tạo preset thứ 10 |
| `PROBATION_CANDIDATES` (A) | `candidate_id:UUID*`, `candidate_code:CODE*`, identity/contact fields, catalog IDs, `job_template_id:UUID?`, probation dates/snapshot fields, converted employee, status/reason | PK; FKs catalog/job template/employee; unique candidate code | `DRAFT/CONTRACT_CREATED/IN_PROBATION/PASSED/FAILED/CONVERTED/CANCELLED` | rule giấy tờ là warning/review; state transition + row version ngăn double action |
| `EMPLOYMENT_CONTRACTS` (A) | `contract_id:UUID*`, `employee_id:UUID*`, type/number, signed/effective dates, `source_document_id:UUID?`, status | PK; FKs employee/generated document; unique number theo policy/year | `DRAFT/ACTIVE/EXPIRED/TERMINATED/VOIDED` | extension chỉ bật sau BA; không backfill history từ current value |
| `DOCUMENT_TEMPLATES` (A; immutable sau activate) | `document_template_id:UUID*`, code/type/name/version, Drive file/revision IDs, schema version/manifest, hashes, effective dates, replace/approval fields | PK; self FK replacement; unique code+version | `DRAFT/IN_REVIEW/ACTIVE/RETIRED`; manifest/hash required khi activate | một version active theo policy; content đổi phải tạo version mới |
| `DOCUMENT_PLACEHOLDER_SCHEMAS` (A; immutable sau activate) | `placeholder_schema_id:UUID*`, `schema_version:CODE*`, `document_type:ENUM*`, `manifest_json:JSON*`, `manifest_sha256:SHA256*` | PK; unique document type+schema version | `DRAFT/ACTIVE/RETIRED` | canonical JSON/hash chặn duplicate; schema active không sửa tại chỗ |
| `CONTRACT_NUMBER_SEQUENCES` (A) | `sequence_id:UUID*`, `contract_type:ENUM*`, `year:number*`, `last_number:number*`, `sequence_status:ENUM*` | PK; unique type+year | `ACTIVE/LOCKED`; last number không âm | chỉ update trong ScriptLock + operation journal; không lấy `count()+1` |
| `GENERATED_DOCUMENTS` (A; artifact bất biến sau generate) | operation/document/candidate/employee/contract/template/job refs, contract no/year, schema version, secure snapshot ref/hash, three private file IDs/hashes, lifecycle links/reason/error | PK; FKs operation/domain/template/self; unique operation-issued document; unique contract no+year theo type | `PROCESSING/PREVIEW/GENERATED/SUPERSEDED/VOIDED/FAILED` | idempotency ngăn file trùng; reissue tạo row mới; không overwrite artifact/hash |
| `DOCUMENT_RENDER_EVENTS` (L) | `render_event_id:UUID*`, `operation_id:UUID*`, `event_sequence:number*`, `generated_document_id:UUID?`, `event_type:ENUM*`, `actor_id:UUID*`, `result:ENUM*`, sanitized error, occurred_at | PK; FKs operation/document/user; unique operation+event+sequence | event allowlist; không payload PII | append-only; retry duplicate event bị composite key chặn |
| `ATTACHMENTS` (A; file content bất biến) | `attachment_id:UUID*`, nullable employee/candidate/contract owner IDs, type, private Drive ID, safe filename/MIME/size/SHA | PK; owner FKs; ít nhất một owner required; unique owner+type+SHA | `ACTIVE/ARCHIVED/VOIDED` | cùng owner/type/hash skip; thay file tạo attachment mới |

#### Identity, permission, audit, config và migration

| Sheet | Cột typed lõi ngoài A/L | PK, FK và unique | Status/required | Chống trùng và sửa sai |
|---|---|---|---|---|
| `USERS` (A) | `user_id:UUID*`, `email:text*`, display name, org unit | PK; normalized email unique | `ACTIVE/INACTIVE` | không lưu password; identity phải qua deployment gate |
| `ROLES` (A) | `role_id:UUID*`, `role_code:CODE*`, `name:text*` | PK; code unique | `ACTIVE/INACTIVE` | code bất biến; không suy role từ tên hiển thị |
| `USER_ROLES` (A) | `user_role_id:UUID*`, `user_id:UUID*`, `role_id:UUID*`, `scope_json:JSON?`, effective dates | PK; FKs user/role; unique user+role+canonical scope | `ACTIVE/INACTIVE/EXPIRED` | upsert theo composite key; revoke bằng status/audit |
| `ROLE_PERMISSIONS` (A) | `role_permission_id:UUID*`, `role_id:UUID*`, `permission_code:CODE*`, `scope_json:JSON?` | PK; FK role; unique role+permission+canonical scope | `ACTIVE/INACTIVE` | server authorization đọc bảng này; UI visibility không thay thế |
| `AUDIT_LOGS` (L) | `audit_id:UUID*`, actor snapshot, action, entity type/id, request ID, changed fields, before/after hashes, sanitized metadata, result, occurred_at | PK; FK actor nếu còn; unique request+action+entity+sequence | `SUCCESS/DENIED/FAILED`; append-only | không ghi raw PII; correction là event mới |
| `OPERATION_JOURNAL` (A) | `operation_id:UUID*`, `idempotency_key:text*`, action, aggregate type/id, request ID, `technical_status:ENUM*`, checkpoint, sanitized error, started/completed times, actor | PK; FK actor; unique action+scope+idempotency key | `PENDING/APPLIED/FAILED` | retry tiếp tục/trả operation cũ; reconciler xử lý PENDING treo |
| `SYSTEM_CONFIG` (A) | `config_id:UUID*`, `config_key:CODE*`, `config_value:text*`, `value_type:ENUM*`, `environment:CODE*` | PK; unique key+environment | `ACTIVE/INACTIVE`; chỉ non-secret | ID môi trường và config runtime nằm ở Script Properties; secret giá trị cao phải dùng secret manager/dịch vụ hybrid được duyệt, không nằm ở Sheet/Script Properties/source |
| `SCHEMA_MIGRATIONS` (A; immutable khi applied) | `schema_migration_id:UUID*`, version/name/checksum, lifecycle timestamps/actor | PK; version unique | `PENDING/APPLIED/FAILED/ROLLED_BACK` | cùng version khác checksum là blocker; applied không sửa |
| `MIGRATION_RUNS` (A) | `run_id:UUID*`, source, schema version, manifest SHA, counts/watermark, started/completed fields | PK; manifest+source+watermark unique theo policy | `CREATED/STAGED/VALIDATED/APPLYING/VERIFIED/FAILED/ROLLED_BACK` | rerun tham chiếu run cũ; không coi partial là verified |
| `ID_MAPPINGS` (A) | `mapping_id:UUID*`, source system/type/id, target UUID, source timestamp/hash, run ID, verify times/error | PK; FK run; unique source system+type+ID; target unique trong entity | `STAGED/IMPORTED/VERIFIED/FAILED/ROLLED_BACK` | target UUID không đổi qua rerun; hash conflict vào review |
| `MIGRATION_ROWS` (A) | `migration_row_id:UUID*`, run/entity/source ID, `raw_payload_ref:text?`, source hash, issue codes | PK; FK run; unique run+entity+source ID | `STAGED/VALID/INVALID/APPLIED/SKIPPED/FAILED` | raw PII chỉ ở restricted ref; cùng hash skip idempotent |
| `DATA_QUALITY_ISSUES` (A) | `issue_id:UUID*`, run/entity/source refs, issue code/severity, masked detail, resolution/reason/actor/time | PK; optional FK run/mapping; unique open issue fingerprint | `OPEN/ACCEPTED/FIXED/IGNORED` | reopen bằng event/version; không tạo hàng lặp mỗi scan |

Tên trong yêu cầu nghiệp vụ được map rõ: `CONTRACTS` là `EMPLOYMENT_CONTRACTS` (còn hợp đồng thử việc đã sinh nằm ở `GENERATED_DOCUMENTS`); `PERMISSIONS` là `ROLE_PERMISSIONS` cộng `USER_ROLES`; `MIGRATION_LOGS` được tách thành `MIGRATION_RUNS`, `MIGRATION_ROWS`, `ID_MAPPINGS` và `DATA_QUALITY_ISSUES`. Không tạo thêm sheet alias chứa dữ liệu trùng.

## 6. Mapping MySQL -> Sheets

| MySQL | Sheet | Ghi chú |
|---|---|---|
| `hr_employees` | `EMPLOYEES` | giữ UUID nếu hợp lệ hoặc mapping ổn định |
| bốn bảng `hr_employee_*` detail | bốn sheet detail | 1:1 theo employee UUID |
| `hr_departments` | `DEPARTMENTS` | resolve parent sau pass đầu |
| `hr_positions` | `POSITIONS` | code/name canonical |
| `hr_working_conditions` | `WORKING_CONDITIONS` |  |
| `hr_employee_movements` | `WORKFORCE_MOVEMENTS` | giữ correction link và idempotency |
| `hr_monthly_rosters/items` | `MONTHLY_ROSTERS/ITEMS` | phân biệt baseline với live projection |
| `hr_probation_job_templates` | `PROBATION_JOB_TEMPLATES` | 9 job preset hiện tại |
| `hr_probation_candidates` | `PROBATION_CANDIDATES` | giữ converted employee link |
| `hr_probation_contracts` | `GENERATED_DOCUMENTS` | BLOB cũ giữ ở backend; copy Drive có SHA/map |
| `hr_audit_events` | `AUDIT_LOGS` | metadata đã lọc, không mở rộng PII |
| import/template tables | migration/template sheets | không trộn Excel template với Docs template |

## 7. Chống trùng và consistency

- Employee: `employee_code`; CCCD/BHXH/BHYT là duplicate-warning, không auto merge.
- Candidate: `candidate_code`; email/phone/CCCD chỉ candidate-match suggestion.
- Catalog: code unique; name normalized unique theo business confirmation.
- Movement: idempotency key unique; confirmed immutable.
- Contract/document number: unique theo type/year dưới lock + retry.
- File: SHA-256 + owner/type; không dựa vào filename.
- Migration: source tuple + source hash.
- Audit: request ID + action/entity có thể dùng chống ghi lặp, nhưng không bỏ sự kiện hợp lệ.

Mỗi write dùng read-version-check -> validate FK/business -> short lock -> re-read version/index -> batch write -> audit/operation journal -> cache invalidation.

## 8. Capacity cho khoảng 336 nhân sự

336 employee master không gần hard limit Google Sheets. Tải thực tế chủ yếu đến từ movement/document/audit tăng theo thời gian, số người dùng đồng thời và số lần gọi dịch vụ, không phải số employee.

Không ước đoán một con số lịch sử không có bằng chứng. Capacity test dùng tham số:

```text
annual_rows = movements + contracts + attachments + generated_documents + audit_events
used_cells = sum(rows_per_sheet * columns_per_sheet)
```

Test tối thiểu ba profile: dữ liệu hiện tại, 3 năm và 5 năm; đo p50/p95 list/search/write, lock wait, Apps Script execution, số service call và workbook cell count. Ngưỡng vận hành/go-no-go nằm tại `HR_RISK_ASSESSMENT.md`, không nhầm với hard limit chính thức.

## 9. Projection dashboard và tăng/giảm

Không lưu/chỉnh trực tiếp tổng quân số.

```text
headcount(period_end)
  = baseline employees
  + confirmed INCREASE/REHIRE effective <= period_end
  - confirmed DECREASE effective <= period_end
  - movement bị supersede bởi correction
```

Dashboard tăng/giảm theo tháng lấy từ ledger confirmed; thử việc lấy candidate status; official/active lấy employee projection. Cần cache summary ngắn hạn nhưng source vẫn là sheet ledger.

Transfer/position/salary/temporary-leave chỉ ảnh hưởng headcount khi business rule nói rõ; không suy diễn từ label.

## 10. Migrations của chính schema Sheets

- Mỗi thay đổi header/schema có version và checksum trong `SCHEMA_MIGRATIONS`.
- Migration chạy forward, idempotent; backup trước migration.
- Repository truy cập bằng header key đã validate, không bằng magic index.
- Không rename/delete cột đang dùng trong cùng release; dùng expand -> backfill -> switch -> retire.
- Old columns/archive giữ cho đến khi rollback window đóng.

## 11. Điểm cần BA xác nhận

1. `336` là quân số hiện tại hay baseline; tài liệu backend trước đó ghi baseline 339.
2. Quy tắc employee code khi tái tuyển.
3. Danh sách loại hợp đồng và lifecycle hợp đồng lao động.
4. Điều chuyển/chức vụ/lương/phụ cấp/tạm nghỉ có approval hay confirm một bước.
5. Retention cho PII, audit, candidate thất bại và generated documents.
6. Fine-grained visibility: ai được xem lương, CCCD, bảo hiểm, file.
7. Shared Drive/folder ownership và DLP policy.
8. Có cần giữ true PWA/offline/push hay chỉ responsive web app.

Các mục chưa được xác nhận phải để `CHƯA XÁC ĐỊNH`, không seed default vào dữ liệu thật.
