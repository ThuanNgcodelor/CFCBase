# Kế hoạch migration, chạy song song và rollback HR

Cập nhật: 2026-07-28
Trạng thái: bản kế hoạch, chưa thực thi migration, chưa thay đổi database/Google Drive/Google Sheets.

## 1. Kết luận kiến trúc migration

Không thực hiện đồng bộ hai chiều tự động trong lần chuyển đổi đầu tiên. Mỗi miền dữ liệu chỉ có **một hệ thống được phép ghi tại một thời điểm**.

- Spring Boot + MySQL tiếp tục là Source of Truth cho đến khi từng gate đối soát được ký xác nhận.
- Apps Script ban đầu là môi trường shadow/read-only, nhận snapshot có version từ hệ thống cũ.
- Việc chuyển quyền ghi được thực hiện theo một cửa sổ cutover có freeze, final delta, backup và biên bản đối soát.
- Sau cutover, backend cũ chuyển read-only; không xóa code, schema, BLOB hợp đồng hoặc lịch sử.
- Rollback không phải “copy ngược sheet bằng tay”. Apps Script phải xuất một gói rollback có schema version, ID mapping, checksum và delta ledger để importer backend preview/validate trước khi ghi.

Lý do: backend hiện có transaction, optimistic/pessimistic locking, idempotency và lịch sử append-only trong `HrWorkforceService`; prototype Apps Script hiện chỉ append một hàng vào `Changes_Log` và chưa có lock/idempotency (`QuanLyNhanSu_AppScripts/ChangeLogService.js:addChangeLog`).

## 2. Phạm vi dữ liệu

### 2.1. Phải chuyển và đối soát

| Nhóm | Nguồn hiện tại | Đích đề xuất | Bằng chứng nguồn |
|---|---|---|---|
| Hồ sơ nhân sự | `hr_employees` và bốn bảng hồ sơ con | `EMPLOYEES`, `EMPLOYEE_EMPLOYMENT`, `EMPLOYEE_IDENTITY`, `EMPLOYEE_INSURANCE`, `EMPLOYEE_CONTACTS` | `V1__create_hr_phase_1_schema.sql:148-260` |
| Danh mục | phòng ban, chức vụ, điều kiện lao động | ba sheet catalog có UUID | `V1__create_hr_phase_1_schema.sql:85-146` |
| Biến động | `hr_employee_movements` | `WORKFORCE_MOVEMENTS` append-only | `V1__create_hr_phase_1_schema.sql:262-318`, `V4__add_hr_movement_adjustments.sql` |
| Baseline/danh sách tháng | roster + item + projection sống | baseline bất biến + projection + snapshot export | `HrRosterProjectionService`, `hr_monthly_rosters`, `hr_monthly_roster_items` |
| Import | template version, batch, row, issue và retention | migration run, staging row, issue và purge metadata | `V1__create_hr_phase_1_schema.sql:5-83,398-420`; V2 |
| Ứng viên thử việc | candidate + job preset | `PROBATION_CANDIDATES`, `PROBATION_JOB_TEMPLATES` | `V3__add_hr_probation_candidates.sql:5-90` |
| Hợp đồng đã sinh | DOCX BLOB + snapshot placeholder + SHA | Drive file IDs + metadata/checksum; giữ BLOB cũ | `V3__add_hr_probation_candidates.sql:92-117`, `HrProbationService.generateContract` |
| Audit | `hr_audit_events` | `AUDIT_LOGS` append-only | `V1__create_hr_phase_1_schema.sql:422-435` |
| Quyền | tài khoản `User`/role `MANAGER` | email Workspace + role/permission mapping, không chuyển password | `SecurityConfig`, `HrActorResolver` |

### 2.2. Không được suy diễn thành dữ liệu thật

- Không biến số dòng Sheet thành ID.
- Không dùng họ tên làm khóa.
- Không tự sửa `#N/A`, CCCD/BHXH trùng hoặc giá trị legacy chưa chuẩn.
- Không suy ra loại hợp đồng thành trạng thái làm việc. Prototype hiện đang mắc lỗi này tại `EmployeeService.js:79-88`.
- Không tự tạo movement Tăng/Giảm từ chênh lệch tổng quân số.
- Không chuyển dữ liệu minh họa trong ảnh concept.
- Không tạo lịch sử hợp đồng lao động, nâng lương, nghỉ phép hoặc điều chuyển nếu code/dữ liệu nguồn chưa có bằng chứng.

## 3. Mô hình ID và tính idempotent

Mọi bản ghi đích dùng UUID ổn định. Mã nghiệp vụ như mã nhân sự và số hợp đồng là alternate key, không phải row number.

Sheet `ID_MAPPINGS` tối thiểu:

| Cột | Ý nghĩa |
|---|---|
| `mapping_id` | UUID của mapping |
| `entity_type` | `EMPLOYEE`, `DEPARTMENT`, `MOVEMENT`, `CANDIDATE`, `DOCUMENT`, ... |
| `source_system` | `BOOKINGBASE_MYSQL` |
| `source_id` | khóa chính cũ |
| `target_id` | UUID ở Apps Script |
| `source_updated_at` | mốc cập nhật nguồn |
| `source_hash` | SHA-256 của payload canonical đã loại bỏ thứ tự JSON |
| `migration_run_id` | FK tới `MIGRATION_RUNS` |
| `status` | `STAGED`, `IMPORTED`, `VERIFIED`, `FAILED`, `ROLLED_BACK` |
| `migrated_at`, `verified_at` | thời điểm UTC/ISO-8601 |
| `error_code`, `note` | lỗi đã lọc, không chứa PII |

Quy tắc upsert:

1. Tìm mapping theo `(source_system, entity_type, source_id)`.
2. Chưa có mapping: tạo `target_id` mới, stage rồi insert.
3. Đã có và `source_hash` giống: skip idempotent.
4. Đã có nhưng hash khác: tạo delta có before/after và yêu cầu policy của entity.
5. Không đổi `target_id` qua các lần chạy lại.
6. Mọi batch có `run_id`, request ID và manifest checksum.

Với ledger bất biến (movement, audit, generated document), không update row đã verify; ghi correction/superseding row theo nghiệp vụ.

## 4. Gói export chuẩn từ backend

Không đọc trực tiếp production DB bằng Apps Script. Backend tạo gói export có kiểm soát:

```text
hr-export-<run-id>/
├── manifest.json
├── catalogs.jsonl
├── employees.jsonl
├── employee-employment.jsonl
├── employee-identity.jsonl.enc
├── employee-insurance.jsonl.enc
├── employee-contacts.jsonl.enc
├── movements.jsonl
├── rosters.jsonl
├── roster-items.jsonl
├── probation-job-templates.jsonl
├── probation-candidates.jsonl.enc
├── generated-documents.jsonl
├── audit-events.jsonl
└── checksums.sha256
```

`manifest.json` chứa:

- `schemaVersion`, `exportedAt`, `sourceSystem`, `sourceDatabaseSnapshotId`.
- Khoảng thời gian/delta watermark.
- Row count theo entity và status.
- Danh sách file, checksum, thuật toán canonicalization.
- Phiên bản code exporter và timezone nghiệp vụ.

File chứa PII phải được mã hóa khi lưu/chuyển, đặt trong khu vực hạn chế và xóa theo retention đã phê duyệt. Không ghi payload vào console/log.

## 5. Pipeline migration chạy lại được

```text
Export backend
  -> verify manifest/checksum
  -> STAGING_LEGACY_* bất biến
  -> normalize/validate
  -> resolve ID mapping
  -> preview sai lệch
  -> confirm dưới ScriptLock theo từng chunk
  -> verify count/hash/FK
  -> publish reconciliation report
```

### Bước 1 — Preflight

- Chụp backup MySQL và inventory Drive/DB BLOB.
- Ghi version source, migration Flyway, checksum template và workbook.
- Xác nhận timezone `Asia/Ho_Chi_Minh` ở script, spreadsheet và dữ liệu ngày.
- Xác nhận deployment identity và permission gate; nếu không lấy được actor ổn định, dừng migration write.
- Xác nhận Apps Script dev/staging không trỏ nhầm spreadsheet production.

### Bước 2 — Stage

- Import JSONL/CSV vào staging hoặc xử lý theo chunk, không ghi thẳng sheet nghiệp vụ.
- Giữ nguyên `source_id`, raw value và source hash.
- Chặn file sai schema version/checksum.
- Không gọi Sheets từng ô; mỗi chunk dùng `getValues`/`setValues`.

### Bước 3 — Validate

- Khóa chính trùng/thiếu.
- Mã nhân sự trùng.
- FK mồ côi giữa employee, catalog, candidate, movement, roster và document.
- Ngày kết thúc trước ngày bắt đầu.
- Status/enum không nằm trong allowlist.
- Số tiền âm hoặc parse sai.
- PII thiếu/trùng được cảnh báo, không tự sửa.
- Placeholder snapshot không khớp template version.

### Bước 4 — Preview

Báo cáo trước confirm phải có:

- insert/update/skip/conflict theo entity;
- số row hợp lệ/cảnh báo/lỗi;
- duplicate và orphan chi tiết bằng ID đã mask;
- phân bố employee status, movement type/status, candidate status;
- headcount baseline và headcount projection theo từng tháng;
- danh sách document thiếu file/checksum/permission.

### Bước 5 — Confirm

- Confirm yêu cầu `migration_run_id`, manifest SHA và số lượng dự kiến.
- Dùng `ScriptLock` cho vùng ghi chung; lock scope ngắn, không giữ lock khi gọi Docs/Drive lâu.
- Ghi theo dependency: catalogs -> employees -> child profiles -> movements -> roster -> probation -> documents -> audit mapping.
- Có operation journal `PENDING -> APPLIED/FAILED`; lỗi giữa batch không bị hiểu là hoàn tất.
- Sau mỗi chunk ghi watermark và checksum để resume.

### Bước 6 — Reconcile

Chỉ đánh dấu `VERIFIED` khi tất cả check bắt buộc đạt.

## 6. Bộ đối soát bắt buộc

| Kiểm tra | Cách so | Điều kiện đạt |
|---|---|---|
| Số lượng | count theo entity/status | bằng nguồn, trừ exclusion đã ký |
| Employee code | set + duplicate report | 0 duplicate ngoài exception đã duyệt |
| Quan hệ | orphan scan theo FK logic | 0 orphan blocking |
| Field | canonical hash theo record | 100% field bắt buộc; sai lệch có danh sách |
| PII | masked comparison/checksum | không in raw value; mismatch được xử lý kín |
| Movement | timeline và correction link | thứ tự hiệu lực, status và link khớp |
| Headcount | baseline + confirmed movement | cùng kết quả theo tháng với backend projection |
| Candidate | status distribution + converted link | không mất liên kết employee draft |
| Document | metadata, file existence, SHA, permission | file tồn tại, private, tải thử đạt |
| Audit | count/window/action distribution | không thiếu sự kiện trong phạm vi cam kết |

Baseline `339` trong tài liệu cũ và số `336` trong workbook/prototype hiện tại không được chọn theo cảm tính. Báo cáo phải tách rõ:

- baseline lịch sử tại một mốc;
- quân số hiện tại theo ngày hiệu lực;
- ứng viên thử việc không thuộc roster chính thức;
- employee `DRAFT` không thuộc active headcount.

Sai lệch chỉ được TCHC xác nhận; migration không tự “cân” số tổng.

## 7. Chạy song song với single-writer

| Giai đoạn | Backend/MySQL | Apps Script/Sheets | Quyền ghi |
|---|---|---|---|
| Shadow 1 | vận hành bình thường | snapshot read-only | backend |
| Shadow 2 | vận hành bình thường | đối soát định kỳ, UI pilot read-only | backend |
| Pilot tài liệu | master HR vẫn ở backend | có thể sinh bản tài liệu thử trong folder staging | backend cho data; Apps Script chỉ artifact pilot |
| Rehearsal | vận hành bình thường | full dry-run từ snapshot | backend |
| Cutover freeze | khóa ghi HR trong cửa sổ đã duyệt | final delta chưa mở người dùng | không hệ thống nào ghi business data |
| New primary | backend read-only | ghi chính thức | Apps Script theo module đã ký |
| Rollback window | sẵn sàng importer delta | ghi chính thức có audit/outbox | Apps Script cho đến khi kích hoạt rollback |

Không cho người dùng sửa cùng một employee ở cả hai nơi. Nếu cần thử nghiệm ghi, dùng hồ sơ test riêng và folder/sheet staging riêng.

## 8. Đối soát định kỳ trong parallel run

- Cuối ngày: count/hash các bản ghi thay đổi, movement mới, candidate status và generated documents.
- Hàng tuần: full referential check, headcount projection từng tháng, permission scan Drive và quota/error summary.
- Trước cutover: full export lại từ source, không tái sử dụng snapshot cũ.
- Mọi discrepancy có `owner`, `severity`, `source_id`, `target_id`, quyết định và bằng chứng đóng lỗi.

Tần suất chính thức và người ký là **CHƯA XÁC ĐỊNH — cần TCHC và vận hành xác nhận**.

## 9. Cutover runbook

1. Phê duyệt Go/No-Go; thông báo cửa sổ freeze.
2. Xác nhận backup MySQL restore-tested và backup Sheets/Drive inventory.
3. Chặn thao tác ghi HR ở backend; không tắt Auth/hạ tầng dùng chung.
4. Export final delta từ watermark đã verify.
5. Verify checksum, stage, preview và confirm final delta.
6. Chạy toàn bộ reconciliation bắt buộc.
7. Smoke test bằng tài khoản/role thật: employee list/detail, movement draft/confirm, candidate, template, DOCX/PDF, audit, export.
8. Xác nhận desktop/mobile và permission negative tests.
9. Chuyển link/entry point chính thức; giữ backend HR read-only.
10. Ghi cutover manifest, thời điểm, version/deployment ID và người phê duyệt.

Không dừng/xóa hệ thống cũ tại bước này.

## 10. Gói rollback từ Apps Script

Apps Script phải xuất được:

```text
hr-rollback-<run-id>/
├── manifest.json
├── employee-upserts.jsonl
├── movement-ledger.jsonl
├── probation-upserts.jsonl
├── generated-document-metadata.jsonl
├── file-inventory.jsonl
├── audit-events.jsonl
├── id-mappings.jsonl
└── checksums.sha256
```

Gói chỉ chứa delta sau cutover watermark. File Drive không nhúng public URL; dùng restricted file ID + checksum và export artifact trong kênh bảo mật khi backend cần lưu lại.

Backend rollback importer phải có `upload -> preview -> validate -> confirm`, transaction theo bounded batch, idempotency key và audit. Không import trực tiếp SQL sinh từ Sheet.

## 11. Kích hoạt rollback

Trigger đề xuất:

- mất/ghi sai dữ liệu blocking không khôi phục được bằng correction;
- permission cho phép người không đúng quyền xem PII;
- đối soát headcount/document liên tục không đạt;
- quota/lock contention làm nghiệp vụ chính không vận hành trong ngưỡng đã ký;
- generated contract sai template/placeholder trên diện rộng;
- không thể xác định actor cho thao tác ghi.

Quy trình:

1. Dừng ghi Apps Script, ghi incident watermark.
2. Snapshot/backup Sheets và Drive inventory; không xóa artifact lỗi.
3. Export rollback delta + checksum.
4. Backend importer preview/validate trong môi trường staging.
5. Đối soát delta và xử lý conflict thủ công theo ID mapping.
6. Backup database lần nữa ngay trước confirm.
7. Confirm delta vào backend trong transaction có audit.
8. Chạy reconciliation và smoke test.
9. Chuyển entry point về backend; Apps Script read-only.
10. Lưu incident report và quyết định dữ liệu nào cần correction, không rewrite history.

RTO/RPO cụ thể là **CHƯA XÁC ĐỊNH**; phải được business owner ký trước cutover. Trong cửa sổ freeze, mục tiêu thiết kế là RPO bằng 0 đối với thao tác đã được xác nhận thành công.

## 12. Backup và retention

- MySQL: dùng quy trình backup/restore hiện hữu, nhưng phải diễn tập restore trước Go-Live.
- Sheets: export snapshot XLSX/CSV + manifest schema; không xem version history là backup duy nhất.
- Drive: inventory file ID, parent, owner/shared-drive, permission, MIME, size, created/modified time và checksum artifact export được.
- Template: không overwrite version đang dùng; archive theo version/status.
- Generated document: không hard-delete trong rollback; dùng `VOIDED` hoặc `SUPERSEDED` đúng lý do nghiệp vụ, còn việc chuyển file vào vùng archive không tạo một status lịch sử mơ hồ.
- Staging chứa PII có retention/purge audit tương tự V2 hiện tại.

Thời gian lưu cụ thể cần chính sách pháp lý/nội bộ; tài liệu này không tự đặt hạn.

## 13. Gate hoàn thành

Migration chỉ hoàn thành khi:

- exporter/importer chạy lại không tạo duplicate;
- ID mapping đầy đủ và export ngược được;
- count/hash/FK/headcount/document checks đạt;
- negative permission test đạt;
- backup được restore thử;
- rollback rehearsal ít nhất một lần đạt bằng dữ liệu staging;
- backend cũ ở read-only, chưa bị xóa;
- TCHC ký báo cáo sai lệch bằng 0 hoặc exception list;
- vận hành ký RTO/RPO, retention và owner của incident.

## 14. File/module dự kiến

Backend cũ, chỉ bổ sung sau khi kế hoạch được duyệt:

- `hr/migration/export/*`: canonical export + manifest.
- `hr/migration/rollback/*`: preview/validate/confirm delta từ Apps Script.
- Flyway migration mới chỉ khi thật sự cần staging/import metadata.

Apps Script mới:

- `src/server/migrations/LegacyImportAdapter.*`
- `src/server/migrations/Normalizer.*`
- `src/server/migrations/IdempotentUpsert.*`
- `src/server/migrations/Reconciler.*`
- `src/server/migrations/RollbackExporter.*`
- repository cho `MIGRATION_RUNS`, `MIGRATION_ROWS`, `ID_MAPPINGS`, `DATA_QUALITY_ISSUES`.

Tài liệu/vận hành:

- data dictionary + schema version;
- export/import contract JSON Schema;
- cutover checklist;
- rollback checklist;
- reconciliation report template;
- exception register.
