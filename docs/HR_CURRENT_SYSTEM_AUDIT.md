# Audit hệ thống HR hiện tại

Cập nhật: 2026-07-28

Phạm vi: `backend/`, `frontend/`, `QuanLyNhanSu_AppScripts/`, `docs/hr-design-concepts/` và template thử việc.
Trạng thái: static audit từ source hiện tại; chưa ghi dữ liệu, chưa chạy migration, chưa deploy/restart.

## 1. Tóm tắt điều hành

Hệ thống Spring Boot + React cũ không phải một bản thử nghiệm đơn giản. Source hiện có:

- 18 bảng `hr_*`, 50 REST endpoint HR và security `ROLE_MANAGER`;
- employee/catalog, import baseline, movement tăng/giảm, correction, roster projection, reconciliation và export Excel;
- candidate/job preset thử việc, sinh/lưu/tải DOCX và chuyển candidate đạt thành employee draft;
- 16 route React HR với app shell desktop/mobile, list/form/detail và phần lớn API client tương ứng.

Ngược lại, `QuanLyNhanSu_AppScripts` hiện là prototype bốn tab, bốn service/file chính và một `Index.html` 582 dòng. Không có hạng mục nào đủ bằng chứng để xếp “đã hoàn chỉnh”. Có lỗi blocking về quyền, mapping dữ liệu, UI Tăng/Giảm và tài liệu chia sẻ công khai theo link.

Do đó không tiếp tục vá prototype theo kiểu thêm tab. Hướng đúng là:

1. giữ hệ thống cũ chạy và làm Source of Truth;
2. khóa security/deployment identity và data contract Apps Script;
3. tạo data model có UUID, repository/service/permission/audit/lock;
4. chạy Apps Script ở shadow/read-only trước;
5. port business flow đã chứng minh và triển khai UI theo concept;
6. chỉ cutover sau đối soát, parallel UAT và rollback drill.

## 2. Phương pháp và nguồn

- Dùng CodeGraph trước để đọc symbol/call path hiện tại; với file untracked Apps Script chưa được index đủ thì đọc source trực tiếp.
- Đối chiếu Flyway thay vì chỉ dựa tài liệu roadmap.
- Mở XML metadata của workbook/DOCX ở chế độ read-only; không in nội dung PII.
- Xem 10 ảnh concept bằng kích thước gốc.
- Đối chiếu giới hạn Google bằng tài liệu chính thức; chi tiết tại `HR_RISK_ASSESSMENT.md`.
- Không query production database/runtime; mọi số liệu runtime được đánh dấu chưa xác định.

Nguồn chính:

- Backend schema: `backend/src/main/resources/db/migration/V1__create_hr_phase_1_schema.sql` đến V4.
- Backend API/service: package `com.booking.system.hr`.
- Frontend route: `frontend/src/App.jsx:25-37,172-188`.
- Apps Script: `QuanLyNhanSu_AppScripts/Code.js`, `EmployeeService.js`, `ContractService.js`, `ChangeLogService.js`, `Index.html`.
- Visual spec: `docs/hr-design-concepts/HR_UI_REDESIGN_CONCEPT.md:43-105` và 10 PNG.
- DOCX: `backend/src/main/resources/hr/templates/probation-contract-template.docx`.

## 3. Kiến trúc hệ thống Spring Boot + React

```text
React 19 / Vite
  -> Axios /api/v1/hr/**
  -> Spring Security JWT, active MANAGER only
  -> Controller + DTO validation
  -> transactional service + domain guard + audit
  -> Spring Data repository
  -> MySQL hr_* managed by Flyway
```

Frontend dùng chung Auth/Notification/PWA/app shell của BookingBase, nhưng domain `HrEmployee` độc lập với `User` đăng nhập.

### 3.1. Backend module inventory

| Module | Thành phần chính | Trạng thái nguồn |
|---|---|---|
| Security/actor | `SecurityConfig`, `HrActorResolver` | `/api/v1/hr/**` chỉ active `MANAGER`; actor từ principal |
| Employee/catalog | `HrManagementController`, `HrManagementService` | list/detail/filter/page; CRUD draft; 3 catalog |
| Import | `HrImportController`, parser/contract/persistence | upload/preview/validate/confirm/rollback cho artifact khóa |
| Workforce | `HrWorkforceController`, `HrWorkforceService` | Increase/Decrease, preview, confirm/cancel/delete draft, correction |
| Roster/activity | `HrActivityController`, query/projection service | list/detail/item, live projection, reconciliation, audit paging |
| Excel export | `HrExcelExportController`, `HrExcelExportService` | month/year XLSX từ resource template |
| Probation | `HrProbationController`, `HrProbationService` | candidates, job presets, DOCX, state actions, conversion |
| Audit | `HrAuditEvent` + service audit methods | append-oriented; metadata đã lọc nhưng chưa before/after đầy đủ |

### 3.2. Database inventory

Flyway V1 tạo 15 bảng; V3 thêm 3 bảng probation; V2/V4 mở rộng retention/correction.

- Employee: `hr_employees` và bốn bảng 1:1 employment/identity/insurance/contact.
- Catalog: department/position/working condition.
- Ledger: movement, monthly roster và item.
- Import: Excel template version, batch, row.
- Probation: candidate, job preset, generated contract.
- Governance: HR audit event.

Chi tiết cột/mapping nằm tại `HR_DATA_MODEL.md`.

### 3.3. Luồng hồ sơ

```text
HrEmployees/HrEmployeeForm
  -> hrEmployeeApi
  -> HrManagementController
  -> HrManagementService
  -> HrEmployee + employment/identity/insurance/contact
  -> HrAuditEvent
```

- Tạo mới luôn là `DRAFT`.
- Chỉ draft được sửa trực tiếp; active employee cần business command.
- List có page/filter/sort và không cần tải toàn bộ.
- Detail trả PII/compensation cho `MANAGER`; list không nên trả các field này.

Nguồn: `HrManagementController`, `HrManagementService.createEmployee/updateEmployee`, `frontend/src/api/hrEmployeeApi.js`.

### 3.4. Luồng import

```text
XLSX
 -> safe package parser
 -> batch + staging rows
 -> preview / validate
 -> confirm transaction
 -> employees + INITIAL_LOAD movement + baseline roster
 -> audit / optional guarded rollback
```

Đây là importer dataset-specific, checksum/schema/period-locked; không phải migration framework tổng quát và không round-trip probation/document/audit.

Nguồn: `HrBaselineWorkbookParser`, `HrBaselineImportPersistence`, `HrWorkforceSnapshotImportService`.

### 3.5. Luồng Tăng/Giảm và roster

```text
create DRAFT movement
 -> impact preview
 -> confirm under version/lock guard
 -> Employee DRAFT/ACTIVE/INACTIVE transition
 -> live roster projection from baseline + confirmed timeline
 -> reconciliation / XLSX export
```

- Command mới chỉ hỗ trợ `INCREASE` và `DECREASE`.
- `REHIRE` là loại bù trong correction.
- Các enum transfer/position/working-condition có schema nhưng service chặn; không được ghi là đã triển khai.
- Confirmed movement không bị hard-delete; correction link ở V4.

Nguồn: `HrWorkforceService.requireSupportedMovementType`, `HrRosterProjectionService`.

### 3.6. Luồng thử việc/tài liệu

```text
Candidate
 -> optional job preset copied by client into candidate payload
 -> generate contract
 -> fill 22 placeholders in DOCX
 -> save DOCX BLOB + template/output SHA + input snapshot
 -> start / pass / fail
 -> convert to HrEmployee DRAFT
 -> separate Increase confirm to become ACTIVE
```

Backend có 1 DOCX layout và 9 unique job presets. File Word nguồn có 10 contract record, trong đó hai record cùng reusable profile QLCLSP.

Nguồn: `HrProbationJobTemplateSeeder.DEFAULT_TEMPLATES`, `HrProbationService.generateContract/fillDocxTemplate`, Flyway V3.

## 4. Frontend React hiện tại

### 4.1. Route

16 route dưới `/manager/hr/**`:

- overview;
- employee list/new/detail/edit;
- probation list, candidate new/edit, template new/edit;
- catalogs, imports, movements, rosters, roster detail và audit.

Nguồn: `frontend/src/App.jsx:172-188`.

### 4.2. Coverage

| Khu vực | Đã có | Khoảng trống |
|---|---|---|
| Shell | sidebar, top bar, mobile bottom nav/More, safe area | Imports/Audit thiếu trong nav; visual fidelity chưa đủ |
| Overview | 4 employee count, retry, quick links | chưa có movement/probation/net/department/report metrics |
| Employee | URL query, 5 filter, sort/page, stale guard, detail/form | activity timeline/attachment/history chưa có |
| Probation | candidate/template CRUD và actions, DOCX | preview, PDF, Drive, version/history UI chưa có |
| Movement | draft/preview/confirm/cancel/delete/correction | chưa filter; chưa transfer/salary/temporary leave |
| Roster | live projection, reconciliation, detail, month/year export | API lifecycle roster cũ còn nhưng UI không dùng |
| Catalog | 3 catalog CRUD/inactivate | chưa có contract/location catalogs |
| Import | full locked-baseline flow | hard-code dataset; chưa generic migration |
| Audit | direct route + paging | chưa filter/search/export, không có nav |

Nguồn: `frontend/src/api/hr*.js` và các page `frontend/src/pages/hr/Hr*.jsx`.

### 4.3. Visual fidelity

`HR_UI_REDESIGN_CONCEPT.md` ghi “đã áp dụng”, nhưng source/render chỉ áp một phần:

- token navy/emerald/cobalt và responsive table/card đã có;
- overview vẫn là card grid thay vì summary band + operational ledger;
- mobile employee filter vẫn inline thay vì bottom sheet;
- employee detail là nhiều card, chưa là dossier + true timeline;
- candidate mobile chưa có accordion/progress đúng concept;
- concept chọn `Be Vietnam Pro` nhưng trang hiện tải Inter;
- generic empty/loading/dialog còn lệch.

Ảnh concept là visual specification; dữ liệu/copy minh họa không phải nghiệp vụ. `docs/hr-design-concepts/HR_UI_REDESIGN_CONCEPT.md:56` xác nhận điều này.

## 5. Kiến trúc Apps Script hiện tại

```text
HtmlService doGet -> một Index.html
  -> google.script.run RPC wrappers
  -> EmployeeService / ContractService / ChangeLogService
  -> một Sheet T6-26 + Changes_Log
  -> Google Docs/Drive
```

| File | Vai trò thực tế |
|---|---|
| `Code.js` | hard-code Spreadsheet ID, `doGet`, sáu RPC wrapper |
| `EmployeeService.js` | dò sheet/header, đọc all rows, map guessed columns |
| `ContractService.js` | copy Docs, replace 22 placeholder body, tạo PDF |
| `ChangeLogService.js` | append/read `Changes_Log` |
| `Index.html` | toàn bộ markup/style/client logic, 582 dòng |
| `appsscript.json` | `USER_DEPLOYING` + `ANYONE` |
| `Quan_Ly_Nhan_Su.xlsx` | một tab `T6-26`, 336 employee code trong artifact audit |

Không có repository abstraction, stable schema, UUID, CRUD, role/permission, audit, cache, lock, operation journal, migration, template registry, document history, test hoặc build pipeline.

### 5.1. Employee read

`window.onload -> fetchEmployees -> apiGetEmployees -> getAllEmployees -> getDataRange -> trả toàn bộ browser -> client filter`.

RPC `apiSearchEmployees` tồn tại nhưng UI không gọi. List trả cả BHXH/BHYT/lương/CCCD/địa chỉ dù màn hình không cần.

### 5.2. Mapping sai

Sau cột P, service đang đọc:

- Q thành status, nhưng Q là loại hợp đồng;
- R thành CCCD, nhưng R là số hợp đồng;
- S thành địa chỉ, nhưng S là năm công tác;
- CCCD thật và địa chỉ thật nằm ở cột khác.

Nguồn: `EmployeeService.js:67-89` và header workbook audit.

### 5.3. Contract

UI yêu cầu HR operator nhập trực tiếp template ID và folder ID. Server chạy dưới quyền người deploy, copy file bất kỳ mà principal đó truy cập được, tạo Google Doc/PDF rồi đặt cả hai `ANYONE_WITH_LINK`.

Không lưu candidate, document metadata/history/version; không có preview/DOCX; không cleanup file mồ côi.

Nguồn: `Index.html:211-320,532-570`, `ContractService.js:17-85`.

### 5.4. Tăng/Giảm

Form gọi `handleLogChange(event)` nhưng không có function này trong project, nên submit lỗi `ReferenceError`. Server append log đơn giản không cập nhật employee/projection; hàm read bỏ qua month/year.

Nguồn: `Index.html:333`, `ChangeLogService.js:6-59`.

## 6. Khoảng cách chức năng

Các gap lớn nhất giữa hệ thống cũ và Apps Script:

1. Security/identity/fine-grained permission.
2. Data model/FK/UUID/version/idempotency.
3. Employee CRUD và current-state correctness.
4. Movement lifecycle/correction/projection/reconciliation.
5. Candidate/job preset state machine.
6. Document template registry/version/history/private Drive.
7. Generic migration, reverse export và rollback.
8. Audit, error contract, tests và observability.
9. Full route/app shell/mobile behavior.
10. Import/export/reporting đúng kỳ thay vì export toàn workbook.

Ma trận chi tiết nằm tại `HR_FEATURE_MATRIX.md`.

## 7. Các vấn đề kỹ thuật ưu tiên

### P0 — dừng trước khi pilot có dữ liệu thật

- Web app chạy `USER_DEPLOYING` và access `ANYONE`, không có server permission check (`appsscript.json:6-9`).
- Doc/PDF HR đặt `ANYONE_WITH_LINK` (`ContractService.js:72-78`).
- Client có thể truyền arbitrary template/folder ID trong quyền deployer: confused-deputy risk.
- Spreadsheet/workbook có PII đang untracked; cần ignore/secure trước khi commit.
- Sheet data được ghép vào `innerHTML` và inline `onclick`: DOM XSS và quote-breaking risk (`Index.html:449-485`).
- Mapping employee sai và default giả có thể biến dữ liệu hiển thị thành dữ liệu tưởng là thật.

### P1 — data integrity/business

- Row number ID, không có FK/version/lock/idempotency.
- Submit movement hỏng; dashboard không đọc movement.
- Contract number timestamp không unique; file mồ côi khi flow lỗi.
- Không có reverse export/cutover manifest.
- Backend probation cũng còn defect cần sửa/ghi nhận trước khi lấy làm golden behavior:
  - exception handler bỏ sót `HrProbationController`;
  - không có test V3/probation/DOCX;
  - contract numbering có race giữa candidate;
  - seeder không backfill catalog link;
  - DOCX có lỗi lặp đơn vị lương và delimiter rule note;
  - candidate state transition cần BA xác nhận.

### P2 — performance/UX

- Apps Script tải all rows và lọc client; không page/filter server.
- `getDataRange` đọc cả vùng format thừa.
- Không `withFailureHandler`, retry/error envelope/loading state đầy đủ.
- Tailwind CDN runtime và một file UI monolith.
- Backend candidate page có N+1 latest-contract query tối đa 50 row/page.
- Export/view PII chưa có audit.

## 8. Điểm Apps Script phù hợp và không phù hợp

Phù hợp có điều kiện cho khoảng 336 nhân sự:

- master data quy mô nhỏ;
- catalog, candidate, movement volume thấp;
- batch report;
- Google Docs/Drive workflow;
- một nhóm HR nhỏ, concurrency được đo và permission gate đạt.

Không nên ép pure Apps Script khi:

- không xác định được active user ổn định trong deployment;
- cần row/field-level PII security nhưng user có direct sheet access;
- cần PWA/offline/push parity với app React hiện tại;
- concurrency/transaction/report volume vượt load test;
- cần strong relational constraints, cross-entity atomicity hoặc complex history/reporting.

Khi đó dùng hybrid: Spring Boot/MySQL giữ system of record và security; Apps Script đảm nhiệm Google Docs/Drive/report orchestration hoặc một UI nội bộ giới hạn.

## 9. Chênh lệch số lượng 329/339/336

- Source/docs cũ còn contract importer 329 lịch sử.
- Flow workforce mới khóa baseline 339.
- Workbook Apps Script audit có 336 mã.

Không thể kết luận số nào “sai” chỉ từ count; 339 có thể là baseline và 336 có thể là active headcount sau giảm. Cần runtime read-only reconciliation theo effective date, không sửa trực tiếp dashboard total.

Trạng thái hiện tại: **CHƯA XÁC ĐỊNH — cần đối soát database thật và TCHC xác nhận**.

## 10. Chức năng chưa xác định hoặc chưa có bằng chứng

- Quy tắc hợp đồng lao động chính thức và hết hạn.
- Flow điều chuyển/chức vụ/lương/phụ cấp/tạm nghỉ/quay lại.
- Công thức nghỉ phép.
- Role matrix ngoài MANAGER.
- Retention pháp lý cho PII/tài liệu/audit.
- Số HR user đồng thời và SLA.
- Shared Drive/DLP ownership.
- True PWA có còn là yêu cầu bắt buộc sau chuyển Apps Script.

Các mục này không được tự seed/implement cho đến khi có BA decision và case test.

## 11. Đầu ra audit liên quan

- `HR_FEATURE_MATRIX.md`
- `HR_DATA_MODEL.md`
- `HR_APPS_SCRIPT_ARCHITECTURE.md`
- `HR_TEMPLATE_MIGRATION.md`
- `HR_MIGRATION_AND_ROLLBACK_PLAN.md`
- `HR_IMPLEMENTATION_ROADMAP.md`
- `HR_RISK_ASSESSMENT.md`

## 12. Gate trước khi viết code

1. Duyệt 8 tài liệu audit/plan.
2. Xác nhận Apps Script deployment identity/domain access bằng spike không chứa PII.
3. Đối soát 336/339 trên runtime read-only.
4. Chốt role/PII matrix và Shared Drive policy.
5. Chốt business rules đang `CHƯA XÁC ĐỊNH`.
6. Khóa visual spec/deviation ledger cho 10 concept.
7. Chuẩn bị backup, export contract và rollback acceptance.

Cho đến khi đạt các gate trên: không migration production, không đổi Source of Truth và không xóa hệ thống cũ.
