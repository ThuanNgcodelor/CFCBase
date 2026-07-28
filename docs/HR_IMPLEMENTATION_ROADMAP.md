# Lộ Trình Chuyển Đổi Phân Hệ HR Sang Google Apps Script

Cập nhật: 2026-07-28

Trạng thái: Kế hoạch phân tích và triển khai có kiểm soát; chưa cho phép viết code chuyển đổi

Phạm vi: Chỉ phân hệ Quản lý nhân sự; Booking là legacy/frozen

## 1. Kết luận kiến trúc và các quyết định khóa

Roadmap này là lộ trình chuyển đổi từ Spring Boot + React sang Google Apps Script, không phải phần tiếp theo của cách đánh số Phase 0–10 trong docs/HR_MANAGEMENT_IMPLEMENTATION_PLAN.md.

Các quyết định bắt buộc:

- Backend, frontend, schema, dữ liệu và tài liệu cũ phải được giữ nguyên trong toàn bộ thời gian chuyển đổi.
- Spring Boot + MySQL là system of record cho đến khi Phase 8 kết thúc và có phê duyệt chuyển nguồn ở Phase 9; React hiện tại là UI/oracle để đối chiếu hành vi.
- Không thiết kế đồng bộ hai chiều tự động ngay từ đầu. Tại mọi thời điểm phải có đúng một hệ thống được phép ghi cho từng miền dữ liệu.
- Apps Script hiện tại là bằng chứng/prototype để audit, không phải nền móng mặc định để mở rộng.
- Con số 336 trên giao diện hiện tại là ảnh chụp trạng thái vận hành; baseline lịch sử đã được code/tài liệu khóa là T6-26 = 339 trước khi áp dụng movement. Không dùng 336 hoặc 339 làm hằng số nghiệp vụ. Phase 3 phải đối soát dữ liệu thật.
- Employee HR tiếp tục độc lập với tài khoản User đăng nhập.
- Danh sách nhân sự tháng tiếp tục là projection sống từ baseline và movement đã CONFIRMED theo ngày hiệu lực. Không đưa lại luồng tạo/mở/chốt tháng thủ công chỉ để giống prototype Apps Script.
- Movement là lịch sử độc lập; không sửa trực tiếp số tổng trên dashboard.
- Luồng thử việc phải giữ: Ứng viên → hợp đồng thử việc → đạt → Employee DRAFT → Manager xác nhận Tăng → ACTIVE/roster chính thức.
- Các form dài có nguy cơ mất dữ liệu, đặc biệt ứng viên và mẫu công việc thử việc, phải dùng route/trang chuyên biệt; không đặt toàn bộ trong drawer/modal có thể đóng ngoài ý muốn.
- 10 ảnh trong docs/hr-design-concepts là mục tiêu thiết kế. Ảnh giao diện Google Apps Script hiện tại chỉ là bằng chứng current-state, không phải visual target.
- Nhãn mobile/PWA trong concept chỉ khóa trải nghiệm responsive, safe-area và browser viewport. Roadmap không cam kết HTMLService sẽ là PWA cài đặt được, chạy offline hoặc giữ toàn bộ năng lực PWA của React; capability này phải qua POC riêng hoặc dùng hybrid.
- Nếu POC chứng minh Apps Script không đáp ứng danh tính, phân quyền, quota, đồng thời, bảo mật PII hoặc độ trung thực tài liệu, kiến trúc phải chuyển sang hybrid thay vì ép thay thế hoàn toàn backend.
- Roadmap không gán người phụ trách và không bịa lịch theo ngày/tuần. Thứ tự được điều khiển bằng dependency, priority, complexity và gate nghiệm thu.

### 1.1 Hard gate trước khi viết code

> **KHÔNG TRIỂN KHAI CODE TRƯỚC KHI 8 TÀI LIỆU ĐƯỢC DUYỆT.**

Tám tài liệu phải được hoàn thành, đối chiếu chéo và phê duyệt:

| # | Tài liệu | Vai trò trong gate |
| --- | --- | --- |
| 1 | [HR_CURRENT_SYSTEM_AUDIT.md](HR_CURRENT_SYSTEM_AUDIT.md) | Khóa inventory, luồng dữ liệu và trạng thái thực tế |
| 2 | [HR_FEATURE_MATRIX.md](HR_FEATURE_MATRIX.md) | Khóa parity, gap và quyết định chuyển/không chuyển từng chức năng |
| 3 | [HR_DATA_MODEL.md](HR_DATA_MODEL.md) | Khóa schema Sheets, ID, quan hệ, PII và mapping cũ-mới |
| 4 | [HR_APPS_SCRIPT_ARCHITECTURE.md](HR_APPS_SCRIPT_ARCHITECTURE.md) | Khóa module, permission, repository, service, cache, lock và logging |
| 5 | [HR_TEMPLATE_MIGRATION.md](HR_TEMPLATE_MIGRATION.md) | Khóa template, placeholder, Drive, version và định dạng xuất |
| 6 | [HR_MIGRATION_AND_ROLLBACK_PLAN.md](HR_MIGRATION_AND_ROLLBACK_PLAN.md) | Khóa import lặp lại an toàn, parallel run, reverse export và rollback |
| 7 | [HR_IMPLEMENTATION_ROADMAP.md](HR_IMPLEMENTATION_ROADMAP.md) | Khóa phase, dependency, gate, DoD và test |
| 8 | [HR_RISK_ASSESSMENT.md](HR_RISK_ASSESSMENT.md) | Khóa rủi ro Apps Script/Sheets/Drive/Docs, bảo mật và ngưỡng hybrid |

Gate không đạt nếu một tài liệu còn mâu thuẫn với code/schema, còn dùng giả định chưa đánh dấu, hoặc chưa chỉ rõ người có thẩm quyền nghiệp vụ cần xác nhận. Mọi điểm chưa có bằng chứng phải ghi đúng trạng thái: **CHƯA XÁC ĐỊNH – cần kiểm tra thêm**.

### 1.2 Bằng chứng hiện tại làm đầu vào

| Phát hiện | Nguồn chính | Ý nghĩa với roadmap |
| --- | --- | --- |
| HR cũ đã có hồ sơ, danh mục, import, movement, projection tháng, export, audit và thử việc | backend/src/main/java/com/booking/system/hr/, frontend/src/pages/hr/, frontend/src/api/ | Không được giản lược chỉ còn bốn màn prototype |
| Chỉ MANAGER đang ACTIVE có quyền HR trong hệ thống cũ | SecurityConfig, Hr API security tests, frontend/src/App.jsx | Nhóm quyền mở rộng do yêu cầu mới phải được BA duyệt; không tự suy ra từ tên role |
| Projection tháng dùng baseline + confirmed movement | HrRosterProjectionService, HrWorkforceService, roster APIs/UI | Giữ projection sống; backend cũ còn API mở/chốt để tương thích không có nghĩa UI mới phải dùng |
| Movement có draft, preview, confirm, cancel và điều chỉnh có audit | HrWorkforceService, HrEmployeeMovement, màn Tăng/Giảm | Apps Script append một dòng trực tiếp chưa đạt parity |
| Thử việc chưa vào roster; đạt chỉ tạo Employee DRAFT | HrProbationService, HrProbationController, các trang probation | Không tự động kích hoạt nhân sự khi đánh dấu đạt |
| Template runtime có 22 placeholder; seeder hiện tạo 9 mẫu công việc an toàn | probation-contract-template.docx, HrProbationJobTemplateSeeder | Cần đối soát lại yêu cầu “khoảng 10 template”; không hard-code một file lớn |
| Form ứng viên và mẫu công việc đã chuyển sang route riêng | frontend/src/App.jsx và các form probation | Giữ cách chống mất dữ liệu này khi làm Apps Script |
| Prototype hard-code Spreadsheet ID, đọc toàn bộ sheet, dùng ID theo số dòng | QuanLyNhanSu_AppScripts/Code.js, EmployeeService.js | Phải thay bằng config tập trung, UUID và repository có paging/batch |
| Prototype ghi movement bằng appendRow, chưa lock/validate/idempotency/audit actor | QuanLyNhanSu_AppScripts/ChangeLogService.js | Không dùng làm write path production |
| Prototype nhận trực tiếp template/folder ID và bật ANYONE_WITH_LINK | QuanLyNhanSu_AppScripts/ContractService.js | Vi phạm nguyên tắc least privilege; phải thay bằng catalog template và ACL nội bộ |
| Web app hiện access ANYONE, execute as USER_DEPLOYING | QuanLyNhanSu_AppScripts/appsscript.json | Bắt buộc có POC danh tính/deployment trước kiến trúc |
| UI concept gồm 7 desktop và 3 mobile/PWA | docs/hr-design-concepts/01…10 và HR_UI_REDESIGN_CONCEPT.md | Phải có lane fidelity độc lập F0–F6 |

Code/config hiện tại luôn cao hơn docs. Khi tài liệu lịch sử còn số 329 hoặc mô tả roster thủ công, Phase 0 phải ghi đó là lịch sử, không dùng làm rule active.

### 1.3 Quy ước priority, complexity và gate

| Thuộc tính | Giá trị | Cách hiểu |
| --- | --- | --- |
| Priority | P0 | Blocker về an toàn, dữ liệu hoặc quyết định kiến trúc |
| Priority | P1 | Parity bắt buộc trước parallel run |
| Priority | P2 | Nghiệp vụ mở rộng chỉ làm khi có bằng chứng/rule được duyệt |
| Complexity | Thấp | Phạm vi hẹp, ít tích hợp, rollback đơn giản |
| Complexity | Trung bình | Nhiều module hoặc cần kiểm thử tích hợp |
| Complexity | Cao | Dữ liệu nhạy cảm, migration, đồng thời, tài liệu hoặc cutover |

Luồng dependency chính:

    Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
                                             ├→ Phase 5
                                             └→ Phase 6
    Phase 5 + Phase 6 → Phase 7 → Phase 8 → Phase 9

Lane fidelity F0–F6 chạy song song từ sau Phase 0, nhưng không được vượt qua dependency nghiệp vụ của màn hình tương ứng.

| Phase | Kết quả cần khóa | Priority | Complexity | Gate vào |
| --- | --- | --- | --- | --- |
| 0 | Audit và tám tài liệu được duyệt | P0 | Cao | Không |
| 1 | Identity/deployment/quota POC; quyết định full hoặc hybrid | P0 | Cao | G0 |
| 2 | Architecture foundation có permission/audit/lock/test | P0 | Trung bình | G1 |
| 3 | Data model, shadow migration, reconciliation và reverse export | P0 | Cao | G2 |
| 4 | Employee/catalog parity | P1 | Cao | G3 |
| 5 | Movement, live projection, dashboard/report có bằng chứng | P0/P1 | Cao | G3 + Phase 4 |
| 6 | Probation, template versioning và document history | P1 | Cao | G3 + Phase 4 |
| 7 | Nghiệp vụ còn lại đã được BA chứng minh | P2 hoặc theo matrix | Cao | Phase 4–6 |
| 8 | Parallel run, UAT, fidelity, recovery evidence | P0 | Cao | G4 + G5 |
| 9 | Cutover readiness và rollback có phê duyệt vận hành | P0 | Cao | G6 |

## 2. Phase 0 — Audit hệ thống và duyệt bộ tài liệu

### Mục tiêu

Tạo một baseline có bằng chứng về hệ thống Spring/React, schema, dữ liệu, Apps Script prototype, template và UI trước khi quyết định bất kỳ thay đổi source nào.

### Công việc

- Trace từng luồng từ entity/schema → repository → service → controller/API → API client → component/page.
- Kiểm kê employee, catalog, import/export, movement, roster projection, probation, contract document, audit, dashboard/report và security.
- Phân biệt rõ: đã hoàn chỉnh, có nhưng thiếu, chỉ backend, chỉ frontend, prototype Apps Script, chưa có, không nên chuyển, cần thiết kế lại.
- Kiểm kê dữ liệu và quan hệ; xác định PII, tài liệu nhạy cảm, khóa cũ, checksum và retention.
- Đọc toàn bộ QuanLyNhanSu_AppScripts; ghi rõ hành vi thật thay vì tin tuyên bố “clone 100%” trong README.
- Đối chiếu 10 ảnh concept, giao diện React hiện tại và ảnh Apps Script do người dùng cung cấp.
- Đối soát 9 mẫu seeder hiện tại với yêu cầu “khoảng 10”; liệt kê placeholder thật từ template/backend.
- Xác định chức năng nào đang được dùng thực tế và chức năng legacy chỉ còn để tương thích.
- Chốt danh sách câu hỏi BA cho điều chuyển, chức vụ, lương/phụ cấp, tạm nghỉ/quay lại, hợp đồng, nghỉ phép, file đính kèm, báo cáo và cảnh báo.
- Hoàn thành và duyệt đủ tám tài liệu ở mục 1.1.

### File/module liên quan

- backend/src/main/java/com/booking/system/hr/**
- backend/src/main/resources/db/migration/V*.sql
- backend/src/main/resources/hr/templates/**
- frontend/src/App.jsx, frontend/src/api/hr*.js, frontend/src/pages/hr/**, frontend/src/layouts/**
- QuanLyNhanSu_AppScripts/**
- docs/hr-design-concepts/**
- Sáu tài liệu source-of-truth được liệt kê trong AGENTS.md

### Đầu ra

- Bộ tám tài liệu nhất quán.
- Feature inventory có nguồn tham chiếu đến class/function/API/component.
- Data-flow và CRUD/state-transition map cho từng miền.
- Danh sách quyết định đã chốt, câu hỏi mở và chức năng loại khỏi scope.
- Baseline ảnh của React, Apps Script và 10 concept tại viewport đã khóa.

### Definition of Done

- Mọi hàng Feature Matrix có bằng chứng và quyết định chuyển đổi.
- Mọi entity/sheet/document quan trọng có owner dữ liệu, ID, vòng đời và chính sách xóa/lưu trữ.
- Không còn tuyên bố parity dựa trên README hoặc ảnh chụp.
- Sai khác 336 hiện tại so với baseline 339 được mô tả đúng là vấn đề đối soát, không bị “sửa” bằng hard-code.
- Tám tài liệu được duyệt; hard gate được mở bằng quyết định rõ ràng.

### Kiểm thử/xác minh

- Review chéo source → matrix → data model → roadmap.
- Kiểm tra route/API bằng CodeGraph và đọc source trực tiếp.
- Mở template DOCX/ảnh concept để xác minh nội dung, placeholder và fidelity.
- Chạy read-only inventory; không ghi database, Sheets hoặc Drive production.

### Rủi ro và giảm thiểu

- Docs cũ mâu thuẫn code: ưu tiên code/schema và ghi rõ lịch sử.
- Ảnh runtime không phản ánh dữ liệu đầy đủ: không suy ra rule từ ảnh.
- Bỏ sót chức năng ít dùng: trace bằng API, route, repository và test thay vì chỉ navigation.

### Dependency, priority, complexity

- Dependency: Không.
- Priority: P0.
- Complexity: Cao.

## 3. Phase 1 — POC bảo mật, danh tính triển khai và giới hạn nền tảng

### Mục tiêu

Chứng minh Apps Script có thể xác định đúng actor, kiểm tra quyền phía server và hoạt động trong quota/concurrency thực tế trước khi chọn full Apps Script hay hybrid.

### Công việc

- Lập ma trận deployment: execute as người triển khai/người truy cập, phạm vi truy cập nội bộ, tài khoản Workspace, web/desktop/mobile/PWA.
- POC Session.getActiveUser và Session.getEffectiveUser trong đúng domain/tài khoản mục tiêu; không chấp nhận email rỗng hoặc actor dùng chung cho thao tác ghi.
- POC allowlist/role mapping server-side; kiểm tra user không active, ngoài domain, không có quyền và request giả mạo.
- Chốt nguồn role/permission. Role mở rộng như Nhân viên, Trưởng phòng, TCHC, Quản lý, Quản trị chỉ được tạo sau khi Phase 0 có ma trận nghiệp vụ được duyệt.
- Chốt OAuth scopes tối thiểu cho Sheets, Drive và Docs; không dùng quyền rộng hơn nhu cầu.
- Thay mô hình nhập raw Spreadsheet/Folder/Template ID trên form bằng config/catalog được bảo vệ trong thiết kế.
- Threat model cho PII, link Drive, export, audit, XFrame, log, lỗi trả về client và quyền chủ sở hữu script.
- Benchmark POC với batch read/write, CacheService, LockService, đồng thời ghi movement và tạo tài liệu.
- Đo quota Apps Script, Sheets, Drive, Docs theo kịch bản thực tế; ghi ngưỡng cảnh báo và điều kiện fallback/hybrid.
- POC audit actor bất biến, request/correlation ID và log đã redact.

### File/module liên quan

- QuanLyNhanSu_AppScripts/appsscript.json
- QuanLyNhanSu_AppScripts/Code.js
- QuanLyNhanSu_AppScripts/EmployeeService.js
- QuanLyNhanSu_AppScripts/ChangeLogService.js
- QuanLyNhanSu_AppScripts/ContractService.js
- Tài liệu đề xuất: HR_APPS_SCRIPT_ARCHITECTURE.md, HR_RISK_ASSESSMENT.md
- Sandbox Spreadsheet/Drive folder riêng cho POC; không dùng dữ liệu production

### Đầu ra

- Báo cáo POC identity/deployment/quota/concurrency.
- Ma trận permission được server thực thi.
- Quyết định kiến trúc: full Apps Script, hybrid, hoặc dừng chuyển đổi.
- Danh sách OAuth scopes và cấu hình bảo mật được duyệt.
- Ngưỡng stop/fallback có số đo, không dựa vào cảm tính “336 là ít”.

### Definition of Done

- Actor thật được xác định ổn định cho mọi thao tác ghi ở môi trường mục tiêu.
- Request trái quyền bị từ chối ở server ngay cả khi gọi trực tiếp function.
- Không chia sẻ tài liệu HR bằng ANYONE_WITH_LINK.
- Không có ID/secret thật hard-code trong source hoặc lỗi/log.
- Lock/concurrency test không tạo duplicate, lost update hoặc partial write.
- Nếu một tiêu chí trên không đạt, phương án hybrid được chốt trước Phase 2.

### Kiểm thử/xác minh

- Test nhiều tài khoản/role, tài khoản ngoài domain, user inactive, không đăng nhập và request sửa payload.
- Test đồng thời tạo movement, cùng sửa một employee và cùng sinh document.
- Test quota/failure injection: timeout, Drive/Docs lỗi, lock timeout, cache miss.
- Kiểm tra audit actor và log không chứa CCCD/BHXH/BHYT/lương/token.

### Rủi ro và giảm thiểu

- Web app execute-as-owner che mất actor: đổi deployment phù hợp hoặc giữ backend identity service.
- Quota/concurrency không đủ: batch, cache, queue có kiểm soát hoặc chuyển write/document workload sang backend.
- Scope Drive quá rộng: dùng folder chuyên biệt, ACL nhóm nội bộ và principle of least privilege.

### Dependency, priority, complexity

- Dependency: Phase 0 và đủ tám tài liệu được duyệt.
- Priority: P0.
- Complexity: Cao.

## 4. Phase 2 — Nền tảng kiến trúc Apps Script

### Mục tiêu

Tạo nền móng module hóa, kiểm thử được và có contract ổn định; không để UI gọi trực tiếp Sheets/Drive/Docs.

### Công việc

- Chốt cấu trúc build/clasp và quy tắc thứ tự load file Apps Script.
- Tách App/Router/Config/Constants khỏi module nghiệp vụ.
- Tạo response envelope chuẩn gồm success, data, error code, user message và correlation ID.
- Tách Handler/Controller → Validator → Service → Repository.
- Tạo PermissionService, AuditService, LockService wrapper, CacheService wrapper, DriveService và DocumentService.
- Dùng Script Properties/config tập trung; cấm fallback im lặng sang active spreadsheet.
- Repository chỉ dùng batch getValues/setValues; cấm get/set từng ô trong vòng lặp và appendRow cho transaction quan trọng.
- Tạo optimistic version và lock key convention cho aggregate ghi đồng thời.
- Chuẩn hóa validation, domain errors, lỗi retryable/permanent và thông báo tiếng Việt.
- Chuẩn hóa log có structured context nhưng redact PII/secret.
- Tạo test harness với spreadsheet/Drive sandbox và fixture không chứa dữ liệu thật.
- Giữ các file prototype trong giai đoạn chuyển tiếp để đối chiếu; chỉ loại khỏi deployment sau khi có parity và rollback.

### File/module liên quan

Tên cuối cùng phải theo `HR_APPS_SCRIPT_ARCHITECTURE.md`. Nhóm dự kiến:

- `QuanLyNhanSu_AppScripts/src/server/entrypoints/`: `App`, `RpcEntrypoints`.
- `QuanLyNhanSu_AppScripts/src/server/common/`: `ApiResult`, `DomainError`, `RequestContext`, `Idempotency`, `Clock`.
- `QuanLyNhanSu_AppScripts/src/server/modules/**`: handler, validator, service và repository interface theo từng miền.
- `QuanLyNhanSu_AppScripts/src/server/infrastructure/**`: config, Sheets, Drive, Docs, cache, locks và logging adapter.
- `QuanLyNhanSu_AppScripts/src/server/migrations/**`: adapter, normalize, upsert, reconcile và rollback.
- `QuanLyNhanSu_AppScripts/src/client/**`: app, pages, components, API client, validation và styles.
- `QuanLyNhanSu_AppScripts/tests/**` và artifact build-only trong `dist/**`.

### Đầu ra

- Skeleton module hóa có test.
- Contract server-client và error catalog.
- Config/permission/audit/cache/lock dùng chung.
- Repository base có batch access và concurrency guard.
- Hướng dẫn local build, push sandbox và rollback deployment.

### Definition of Done

- Không handler UI nào truy cập SpreadsheetApp/DriveApp/DocumentApp trực tiếp.
- Không ID môi trường nằm rải rác trong source.
- Mọi write path bắt buộc qua permission, validation, lock/version và audit.
- Test unit cho pure business logic và integration test sandbox chạy lặp lại được.
- Prototype cũ chưa bị xóa; có mapping đường chuyển sang module mới.

### Kiểm thử/xác minh

- Contract tests cho success/error/permission.
- Repository tests cho batch read/write, paging, optimistic conflict và rollback logic.
- Static review cấm hard-coded ID, public sharing và log PII.
- Deploy smoke test chỉ trên sandbox.

### Rủi ro và giảm thiểu

- Apps Script global namespace gây va chạm: namespace convention và build validation.
- “Service” mới vẫn trộn I/O với rule: review dependency direction và test pure functions.
- Cache trả dữ liệu cũ sau write: versioned cache key và invalidation trong cùng service.

### Dependency, priority, complexity

- Dependency: Phase 1 đạt quyết định tiếp tục.
- Priority: P0.
- Complexity: Trung bình.

## 5. Phase 3 — Data model, migration shadow và reverse export

### Mục tiêu

Thiết kế dữ liệu Sheets có ID ổn định, chuyển dữ liệu cũ lặp lại an toàn, đối soát được và xuất ngược về contract mà Spring Boot có thể phục hồi.

### Công việc

- Khóa schema từng sheet trong HR_DATA_MODEL.md: cột, type, primary ID, reference ID, status, version, created/updated actor/time và uniqueness rule.
- Dùng UUID hoặc business ID ổn định; cấm số dòng làm ID.
- Giữ old system ID và migration mapping riêng; không dùng họ tên làm khóa.
- Tách dữ liệu hiện tại với lịch sử append-only: employee, employment history, movements, probation, contracts, generated documents, audit và migration log.
- Xác định PII nào nằm trong Sheets, tài liệu nào chỉ lưu metadata/Drive ID và ai được đọc.
- Xây read-only export từ MySQL/API cũ; staging → normalize → validate → preview → confirm.
- Mapping catalog trước employee; employee trước movement/probation/document reference.
- Import idempotent theo source type, old ID, checksum, version và migration run ID.
- Tạo báo cáo count, duplicate, required-null, orphan reference, checksum và field-level discrepancy.
- Xây shadow import không cho Apps Script ghi nghiệp vụ.
- Xây reverse export Apps Script → canonical package có schema/version/checksum để backend cũ có thể import hoặc phục hồi.
- Backup Spreadsheet/Drive metadata trước mỗi migration; ghi retention và restore procedure.
- Không đưa workbook/PII thật vào Git hoặc fixture test.

### File/module liên quan

- docs/HR_DATA_MODEL.md
- docs/HR_MIGRATION_AND_ROLLBACK_PLAN.md
- Backend HR entities/repositories/controllers/services và db/migration/V*.sql
- Apps Script modules: migrations, repositories, reconciliation, exports
- Các sheet dự kiến: EMPLOYEES, catalogs, histories, movements, probation, contracts, templates, generated documents, audit, migration mappings/logs, system config
- Drive sandbox và thư mục backup được phân quyền

### Đầu ra

- Schema Sheets và data dictionary đã duyệt.
- Canonical export contract có version.
- Mapping old ID ↔ Apps Script ID.
- Import preview/confirm chạy lặp lại không trùng.
- Reconciliation report và reverse-export package.
- Backup/restore runbook.

### Definition of Done

- Import cùng package nhiều lần không tạo thêm record.
- Count và quan hệ khớp; mọi sai khác đều có mã lỗi, nguồn và quyết định xử lý được duyệt.
- Không có orphan reference, row-number ID hoặc hard-delete lịch sử.
- Reverse export được backend/sandbox validator đọc lại thành công.
- 336 hiện tại, baseline 339 và movement dẫn tới chênh lệch được giải thích bằng dữ liệu thật, không bằng hằng số.
- Source of truth và write lock cho parallel run được ghi rõ.

### Kiểm thử/xác minh

- Unit test normalize/map/duplicate/checksum.
- Integration test import sạch, retry, partial failure, rollback và restore.
- Round-trip test: old export → Apps shadow → reverse export → backend sandbox.
- Reconciliation theo employee, catalog, movement, roster projection, probation và document metadata.
- Test PII không rò vào log/report Git.

### Rủi ro và giảm thiểu

- Sheets thiếu constraint/FK: repository validation, index cache, reconciliation và lock.
- Dữ liệu nguồn trùng/thiếu: staging giữ raw có retention, không tự sửa âm thầm.
- Reverse export chỉ “có file” nhưng không khôi phục được: bắt buộc round-trip sandbox trước Phase 4.

### Dependency, priority, complexity

- Dependency: Phase 2.
- Priority: P0.
- Complexity: Cao.

## 6. Phase 4 — Employee và danh mục HR

### Mục tiêu

Đạt parity an toàn cho hồ sơ nhân sự và danh mục, dùng data model mới nhưng giữ nguyên vòng đời nghiệp vụ đã chứng minh.

### Công việc

- List employee có search, filter, sort, paging phía server; không tải toàn bộ dữ liệu mỗi lần.
- Detail phân khu thông tin chung, công việc, định danh, bảo hiểm, liên hệ, lịch sử và audit theo permission.
- Tạo Employee DRAFT; edit theo version; giữ giá trị legacy/unknown khi field mới bị giới hạn.
- Chỉ archive/inactivate theo lifecycle; hard-delete chỉ khi rule hiện tại cho phép draft chưa có reference.
- Chống trùng bằng stable ID và rule đã duyệt; duplicate giấy tờ nguồn phải được cảnh báo, không tự merge.
- CRUD/archive cho phòng ban, chức vụ và điều kiện làm việc; không tái dùng catalog Booking.
- Mask PII ở list; audit view/export chi tiết theo permission.
- Dùng route chuyên biệt cho form dài và dirty-form guard trước khi rời trang.
- Tạo UI states chuẩn: loading, skeleton, empty, error, conflict, success và confirmation.
- Giữ React cũ làm oracle so sánh trong parallel run.

### File/module liên quan

- Apps Script modules employees, departments, positions, workingConditions
- Apps Script employee/catalog repositories, validators, permission và audit
- Views: employee list, detail, create/edit; catalog ledger/forms
- Đối chiếu: HrManagementController, HrManagementService, HrEmployee*, frontend/src/pages/hr/**

### Đầu ra

- Employee/catalog read-write theo permission.
- UI desktop/mobile đạt lane fidelity tương ứng.
- Audit và history cho mọi thay đổi quan trọng.
- Reconciliation employee/catalog với hệ thống cũ.

### Definition of Done

- Paging/filter/sort trả kết quả nhất quán và không full-scan từ UI.
- Conflict hai người sửa không làm mất dữ liệu.
- Field nhạy cảm chỉ hiện cho quyền được duyệt; list không lộ PII/lương ngoài scope.
- DRAFT/ACTIVE/INACTIVE và delete guard khớp rule nguồn.
- Employee không bị đồng nhất với tài khoản đăng nhập.
- Dữ liệu shadow so với nguồn cũ không còn sai khác chưa giải thích.

### Kiểm thử/xác minh

- CRUD/lifecycle/duplicate/optimistic conflict/permission tests.
- Search tiếng Việt, filter kết hợp, sort và paging boundary.
- Test legacy unknown value, masked field round-trip và audit diff.
- Browser test desktop/mobile, dirty form, deep link và no-horizontal-overflow.

### Rủi ro và giảm thiểu

- Full scan tăng dần theo audit/history: index sheet/cache và paging repository.
- PII lộ qua response/UI: DTO/view model theo quyền và security review.
- Catalog archive làm hỏng reference: kiểm tra dependency trước archive, giữ snapshot lịch sử.

### Dependency, priority, complexity

- Dependency: Phase 3 và Gate F2 của fidelity.
- Priority: P1.
- Complexity: Cao.

## 7. Phase 5 — Movement, projection tháng, dashboard và báo cáo

### Mục tiêu

Đạt parity cho tăng/giảm và danh sách tháng; mọi thống kê được dẫn xuất từ lịch sử, không sửa số tổng.

### Công việc

- Triển khai trước các movement có service flow được chứng minh: INCREASE, DECREASE và adjustment/reversal.
- Giữ lifecycle DRAFT → CONFIRMED/CANCELLED, idempotency key, version, lock, principal-derived actor và immutable confirmed history.
- Preview trước confirm: kỳ ảnh hưởng, quân số trước/sau và chênh lệch.
- Confirm INCREASE chuyển Employee DRAFT → ACTIVE; DECREASE chuyển ACTIVE → INACTIVE và bắt buộc lý do.
- Sửa movement confirmed bằng bản ghi điều chỉnh có liên kết, không update/delete lịch sử gốc.
- Projection tháng lấy baseline T6 + confirmed movements theo effective date; tháng hiện tại tự xuất hiện.
- Dashboard/report đọc cùng projection/service, không có bộ đếm riêng để người dùng chỉnh.
- Cung cấp headcount, tăng, giảm, net change, danh sách vào/nghỉ và breakdown phòng ban khi định nghĩa dữ liệu đã được Feature Matrix/BA duyệt.
- Filter theo tháng/quý/năm/phòng ban/type/status phải xử lý ở service/repository, không tải tất cả về browser.
- Export report có schema/version và permission/audit.
- Điều chuyển, đổi chức vụ, tăng lương, tạm nghỉ/quay lại chỉ chuyển vào Phase 7 nếu có rule/source chứng minh; enum hoặc nhãn prototype không đủ bằng chứng.

### File/module liên quan

- Apps Script modules workforceMovements, rosters/projections, dashboards, reports
- Movement/employee repositories, lock, audit, reconciliation
- Đối chiếu: HrWorkforceService, HrRosterProjectionService, HrExcelExportService, HrWorkforceController
- Đối chiếu UI: các trang movements, rosters, overview và reconciliation

### Đầu ra

- Movement workflow có preview/confirm/adjustment.
- Projection sống và report/export dùng một nguồn tính toán.
- Dashboard có metric được định nghĩa và truy vết.
- Reconciliation theo kỳ với Spring service.

### Definition of Done

- Không có code/path nào sửa trực tiếp “tổng nhân sự”.
- Cùng baseline + movement tạo cùng kết quả ở Apps Script và Spring cho các kỳ test.
- Confirm đồng thời không duplicate hoặc làm sai trạng thái employee.
- Confirmed history không thể hard-delete; adjustment luôn truy về bản gốc.
- Không tái xuất hiện nút mở/chốt roster thủ công trên UI mới.
- Sai khác report đều drill-down được đến movement/employee.

### Kiểm thử/xác minh

- Case tăng/giảm cùng tháng, effective date boundary, báo trễ, adjustment cùng/ngược loại, retry và concurrent confirm.
- Projection T6 và các tháng sau; current synthetic month; filter quý/năm.
- Permission/PII/export audit.
- Reconciliation headcount và movement details với backend cũ.
- Browser fidelity cho dashboard, movement drawer và roster ledger.

### Rủi ro và giảm thiểu

- Sai effective date lan sang nhiều kỳ: preview, deterministic projection và reconciliation theo kỳ.
- Apps Script lock timeout: lock theo aggregate, bounded retry và hybrid write service nếu benchmark không đạt.
- Dashboard định nghĩa mơ hồ: không triển khai metric trước khi data contract được duyệt.

### Dependency, priority, complexity

- Dependency: Phase 4; có thể chạy song song một phần với Phase 6 sau khi Phase 3 ổn định.
- Priority: P0 cho movement/projection; P1 cho dashboard/report đã duyệt.
- Complexity: Cao.

## 8. Phase 6 — Thử việc, kho template và tài liệu

### Mục tiêu

Giữ đúng flow thử việc hiện tại, chuyển template sang kho quản trị được và sinh tài liệu Drive/DOCX/PDF có version, lịch sử, permission và khả năng tái tạo.

### Công việc

- Đối soát HrProbationJobTemplateSeeder: source hiện có 9 mẫu; yêu cầu “khoảng 10” phải được giải quyết bằng danh sách có bằng chứng.
- Chuyển job template và document template thành catalog, không hard-code trong một file Apps Script.
- Lưu metadata template: code, name, type, Drive file ID, placeholders, version, checksum, status, updated actor/time.
- Chuyển probation-contract-template.docx thành Google Docs template có kiểm tra fidelity và đủ 22 placeholder thực tế.
- Form chọn template từ catalog; không cho người dùng nghiệp vụ nhập raw template/folder ID.
- Preview dữ liệu đã merge trước khi phát hành.
- Tạo Google Docs trong folder nội bộ, export DOCX/PDF, lưu generated-document record và snapshot dữ liệu/placeholder/template version/checksum.
- Không bật public link; kiểm tra quyền xem/tải/tạo/quản lý template phía server.
- Cho phép phát hành lại thành version mới, không ghi đè/xóa lịch sử cũ.
- Giữ flow candidate → contract → start probation → pass/fail → Employee DRAFT; không tự tạo/confirm INCREASE.
- Candidate form và job-template form tiếp tục ở route chuyên biệt; mobile dùng section/accordion nhưng không làm mất dữ liệu.
- Đặt hybrid fallback nếu Google Docs làm sai layout pháp lý hoặc quota không đáp ứng.

### File/module liên quan

- Apps Script modules probation, contracts, documentTemplates, documents, drive
- Template/document repositories, permission, audit và generated-document history
- Views: probation ledger, candidate create/edit route, template create/edit route, preview
- Đối chiếu: HrProbationJobTemplateSeeder, HrProbationService, HrProbationController
- backend/src/main/resources/hr/templates/probation-contract-template.docx
- docs/HR_TEMPLATE_MIGRATION.md

### Đầu ra

- Kho template có version và placeholder contract.
- Flow candidate/probation đạt parity.
- Preview, Docs, DOCX, PDF và lịch sử phát hành.
- ACL/permission/audit và checksum tài liệu.
- Báo cáo fidelity template gốc ↔ Google Docs ↔ DOCX/PDF.

### Definition of Done

- Tất cả placeholder bắt buộc được phát hiện trước khi phát hành; placeholder thừa/thiếu gây lỗi rõ ràng.
- Generated document truy được candidate, data snapshot, template version, actor và checksum.
- Re-issue tạo version mới, không xóa lịch sử.
- Candidate chưa pass hoặc chỉ pass chưa được tính ACTIVE/roster.
- Không có raw Drive/Template ID trên form nghiệp vụ và không có public-link sharing.
- DOCX/PDF đạt tiêu chí pháp lý/visual được người phụ trách nghiệp vụ duyệt; nếu không, hybrid path được dùng.

### Kiểm thử/xác minh

- Placeholder contract tests, ký tự tiếng Việt, số tiền, ngày, dữ liệu thiếu và template version cũ.
- Permission tests cho xem/tạo/tải/quản lý template.
- Drive/Docs failure, retry, duplicate generation và quota.
- So sánh trực quan bằng render PDF/DOCX; checksum metadata.
- End-to-end candidate → document → pass → Employee DRAFT → confirmed INCREASE.
- Browser fidelity desktop/mobile và dirty-form guard.

### Rủi ro và giảm thiểu

- Google Docs tách placeholder qua nhiều text run: template validator và preflight.
- Layout DOCX/PDF lệch template pháp lý: golden-document comparison và backend document service fallback.
- Link Drive lộ PII: folder ACL, least privilege, không public sharing và audit download.

### Dependency, priority, complexity

- Dependency: Phase 3; Employee DRAFT handoff cần Phase 4; roster handoff cần Phase 5.
- Priority: P1.
- Complexity: Cao.

## 9. Phase 7 — Các nghiệp vụ HR còn lại có bằng chứng

### Mục tiêu

Bổ sung từng vertical slice chỉ khi Feature Matrix, rule nghiệp vụ, data owner và test case được duyệt; không biến danh sách mong muốn thành chức năng “đã có”.

### Công việc

- Triage riêng: hợp đồng lao động, điều chuyển, đổi chức vụ, tăng lương, phụ cấp, nghỉ việc nâng cao, tạm nghỉ/quay lại, thâm niên, attachments/kho hồ sơ, cảnh báo hết hạn, ngày phép và approval HR.
- Với từng mục, phân loại: parity bắt buộc, mở rộng mới, không phù hợp Apps Script, hybrid hoặc defer.
- Chỉ dùng bằng chứng từ entity/service/API/UI/template/dữ liệu thật; enum, field hoặc nút chưa nối backend không đủ chứng minh flow.
- Viết state machine, permission, dữ liệu đầu vào/đầu ra, audit, correction và rollback trước khi code.
- Không tái sử dụng Booking approval cho HR.
- Attachments phải có retention, loại file, malware/size policy, ACL và metadata trước khi đưa vào Drive.
- Ngày phép tiếp tục defer cho đến khi TCHC chốt công thức, đối tượng, làm tròn, carry-over và case test.
- Mỗi nghiệp vụ đi qua cùng gate data, security, fidelity, migration và parallel comparison.

### File/module liên quan

- docs/HR_FEATURE_MATRIX.md và các tài liệu BA được duyệt
- Apps Script modules tương ứng chỉ được tạo sau quyết định scope
- Backend/frontend source liên quan làm oracle
- Google Drive/Docs hoặc backend hybrid service tùy quyết định Phase 1

### Đầu ra

- Backlog được quyết định bằng bằng chứng.
- Với mỗi feature được chọn: business contract, data contract, permission, UI, migration, test và rollback.
- Danh sách defer/không chuyển có lý do.

### Definition of Done

- Không feature nào được triển khai khi còn CHƯA XÁC ĐỊNH ở rule cốt lõi.
- Mỗi feature có trace source → rule → data → permission → test.
- Không làm mất history hoặc thay đổi semantics của feature hiện hữu.
- Apps Script/hybrid decision được ghi rõ cho từng workload.

### Kiểm thử/xác minh

- State-transition, permission, concurrency, audit và correction tests theo feature.
- Reconciliation với hệ thống cũ nếu là parity.
- BA/UAT theo case thật đã ẩn danh.
- Quota/performance và browser fidelity.

### Rủi ro và giảm thiểu

- Scope creep do tên chức năng chung chung: một feature contract/một gate tại một thời điểm.
- Tự suy diễn nghiệp vụ từ Excel: bắt buộc owner/rule/test case phê duyệt.
- Ép workflow phức tạp vào Sheets: hybrid hoặc defer khi risk assessment vượt ngưỡng.

### Dependency, priority, complexity

- Dependency: Phase 4–6 tương ứng.
- Priority: P2, trừ khi Feature Matrix chứng minh là parity bắt buộc.
- Complexity: Cao và được đánh giá lại theo từng vertical slice.

## 10. Phase 8 — Parallel run, UAT và đối soát

### Mục tiêu

Chứng minh hệ thống mới đúng dữ liệu, chức năng, quyền, hiệu năng và fidelity trong khi hệ thống cũ vẫn có thể phục vụ và rollback.

### Công việc

- Giai đoạn đầu: Spring Boot + MySQL là writer; Apps Script chỉ shadow/read-only, còn React hiện tại là UI đối chiếu.
- Chạy migration delta idempotent và reconciliation theo tần suất được duyệt trong HR_MIGRATION_AND_ROLLBACK_PLAN.md.
- So sánh employee/catalog, movement, projection, probation, document metadata, dashboard/report và export.
- Ghi discrepancy theo loại, source ID, mức ảnh hưởng, owner xử lý, quyết định; không tự sửa dữ liệu production.
- UAT desktop/mobile cho toàn bộ feature in-scope, deep link, dirty form, permission, PII và document output.
- Load/concurrency/quota test bằng khối lượng và số user thực tế được xác nhận.
- Sau khi read-only đạt, nếu cần pilot write phải khóa miền dữ liệu ở hệ thống cũ trước; không cho cùng record được sửa ở hai nơi.
- Diễn tập backup, final delta, reverse export và rollback trong sandbox/staging.
- Thu thập xác nhận TCHC cho số liệu và tài liệu.

### File/module liên quan

- Reconciliation/migration modules hai hệ thống
- UAT checklist, discrepancy log và runbook trong docs
- Playwright/browser artifacts; Apps Script execution/audit metrics đã redact
- Backup/restore và reverse-export artifacts ngoài Git nếu chứa PII

### Đầu ra

- Báo cáo parity dữ liệu/chức năng/quyền/fidelity/performance.
- Discrepancy register đã xử lý hoặc được chấp thuận.
- UAT evidence và sign-off nghiệp vụ.
- Kết quả diễn tập rollback/recovery.
- Cutover readiness report.

### Definition of Done

- Mọi feature in-scope đạt DoD và không còn sai khác nghiêm trọng chưa giải thích.
- Báo cáo cùng input cho cùng kết quả hoặc sai khác đã được nghiệp vụ phê duyệt.
- Không có unauthorized access, public document hoặc log PII.
- Pilot không có uncontrolled dual write.
- Backup, reverse export và restore đã diễn tập thành công.
- TCHC xác nhận số liệu; người có quyền vận hành chấp thuận readiness.

### Kiểm thử/xác minh

- Full regression, UAT, security matrix, quota/concurrency và failure injection.
- Reconciliation theo count, ID, field, relationship, checksum và derived report.
- Browser screenshot ở toàn bộ viewport trong mục 12.
- Restore/rollback drill có đo thời điểm bắt đầu/kết thúc bằng event, không bịa SLA.

### Rủi ro và giảm thiểu

- Hai nguồn cùng bị sửa: domain write lock và một authoritative writer.
- Sai khác bị che bởi aggregate: bắt buộc drill-down record-level.
- UAT chỉ kiểm tra happy path: dùng case lỗi, concurrent, permission và recovery.

### Dependency, priority, complexity

- Dependency: Phase 4–7 cho scope được chọn; fidelity F6.
- Priority: P0.
- Complexity: Cao.

## 11. Phase 9 — Cutover, vận hành và rollback

### Mục tiêu

Chuyển nguồn dữ liệu chính có phê duyệt, giữ hệ thống cũ read-only và có đường quay lại đã diễn tập.

### Công việc

- Chỉ bắt đầu khi người dùng/phụ trách vận hành yêu cầu rõ; không tự deploy, restart production hoặc cấu hình Cloudflare.
- Thông báo freeze, chặn write theo miền, chụp backup DB/Sheets/Drive metadata và lưu checksum.
- Chạy final delta, đối soát record-level và lấy sign-off.
- Chuyển authoritative writer sang hệ thống mới; hệ thống cũ ở read-only, không xóa code/table/data/template.
- Theo dõi error rate, execution time, quota, lock conflict, data discrepancy, document failure và security events.
- Khóa trigger rollback: identity/permission lỗi, mất/nhân đôi dữ liệu, projection/report sai, quota kéo dài, tài liệu pháp lý lỗi hoặc không thể reconcile.
- Rollback bằng cách chặn write mới, export delta từ Apps Script, validate package, restore/import vào backend cũ, reconcile và mở writer cũ.
- Ghi incident/cutover audit; không che hoặc tự sửa discrepancy.
- Chỉ xem xét retire hệ thống cũ ở một quyết định riêng sau giai đoạn ổn định; không thuộc roadmap này.

### File/module liên quan

- docs/HR_MIGRATION_AND_ROLLBACK_PLAN.md
- Cutover/read-only config hai hệ thống
- Backup/restore/reverse-export scripts đã được duyệt
- Monitoring/audit/reconciliation modules
- Deploy scripts hiện hữu chỉ dùng khi có lệnh vận hành rõ

### Đầu ra

- Backup cuối và checksum.
- Final reconciliation/sign-off.
- Cutover log và hệ thống cũ read-only.
- Monitoring dashboard/runbook.
- Rollback package và incident procedure.

### Definition of Done

- Không mất/duplicate record, document hoặc history trong final delta.
- Source of truth mới và read-only cũ được kiểm chứng bằng test write.
- Monitoring và rollback trigger hoạt động.
- Reverse export phục hồi được backend cũ trong drill.
- Có xác nhận vận hành rõ ràng; không có hành động deploy/restart ngoài quyền.

### Kiểm thử/xác minh

- Dry-run toàn bộ cutover và rollback trước production.
- Smoke test permission, employee, movement, projection, probation, document và export.
- Reconciliation trước/sau switch.
- Test hệ thống cũ từ chối write nhưng vẫn cho tra cứu theo chính sách.

### Rủi ro và giảm thiểu

- Final delta thay đổi trong lúc chạy: freeze/lock và checksum.
- Rollback package không tương thích: versioned contract và restore drill Phase 8.
- Sự cố quota sau cutover: trigger rollback/hybrid đã định nghĩa, không xử lý bằng xóa lịch sử.

### Dependency, priority, complexity

- Dependency: Phase 8 đạt sign-off và có lệnh vận hành rõ.
- Priority: P0.
- Complexity: Cao.

## 12. Lane fidelity giao diện F0–F6

Lane này độc lập với phase nghiệp vụ để ngăn tình trạng “đủ function nhưng chưa giống concept”. Fidelity không được phép thay đổi business rule hoặc API semantics.

### F0 — Khóa target và fidelity ledger

- Nguồn target: toàn bộ 10 file PNG và docs/hr-design-concepts/HR_UI_REDESIGN_CONCEPT.md.
- Ghi native canvas để so sánh trực tiếp:
  - 01, 02, 04, 05, 06, 07: 1536 × 1024.
  - 03: 1586 × 992.
  - 08, 09, 10: 853 × 1844.
- Chụp current React và current Apps Script cùng trạng thái dữ liệu; ảnh Apps Script chỉ là baseline gap.
- Lập ledger từng màn: hierarchy, shell, navigation, spacing, typography, color, table/ledger, form, states, responsive và interaction.
- Khóa các rule không được đánh đổi: live roster projection, movement preview/confirm/adjustment, dedicated long-form routes, PII permission.

DoD F0: Mỗi concept có màn/route đích, state dữ liệu, viewport và acceptance checklist; không còn ảnh “tham khảo chung chung”.

### F1 — Design tokens và app shell

- Chuẩn hóa Be Vietnam Pro/fallback, color tokens, type scale, spacing, radius, border, shadow và focus state theo concept.
- Desktop shell, sidebar/top bar; mobile safe-area, compact header và bottom nav bốn mục.
- More sheet phải chứa các route quan trọng còn lại như movement, roster, catalog, import và audit theo information architecture đã duyệt.
- Touch target tối thiểu 44 × 44; không horizontal overflow.

DoD F1: Shell/token cùng một nguồn; desktop/mobile không lệch navigation hoặc che nội dung.

### F2 — Component và state primitives

- Summary band, ledger/table, responsive record card, filter toolbar/bottom sheet, tabs, drawer, dialog, form section/accordion, sticky actions, pagination.
- Loading/skeleton, empty, error, retry, success, warning, conflict và disabled states.
- Confirmation cho action quan trọng; dirty-form guard cho route/form dài.
- Component không chứa rule nghiệp vụ hoặc gọi Sheets trực tiếp.

DoD F2: Story/fixture của mọi state được duyệt trước khi ghép dữ liệu thật.

### F3 — Overview, employee ledger và dossier

- Bám 01-overview-desktop, 02-employees-desktop, 06-employee-detail-desktop, 08-overview-mobile-pwa và 09-employees-mobile-pwa.
- Overview dùng summary band và ledger đúng hierarchy; metric chỉ hiển thị khi có định nghĩa dữ liệu.
- Desktop employee dùng ledger rõ; mobile ưu tiên search + filter bottom sheet + record cards/ledger.
- Dossier có section rõ, timeline/history thật; PII theo permission.

DoD F3: Cùng dữ liệu tạo đúng hierarchy desktop/mobile, không lộ PII, không tải toàn bộ record vào browser.

### F4 — Probation, candidate form và document flow

- Bám 03-probation-desktop và 10-candidate-form-mobile-pwa.
- Candidate/job-template form là route riêng; mobile dùng accordion/section và sticky action không bị bottom nav che.
- Template selection, preview, version và generated-document history được thể hiện; không để user nhập raw Drive ID.

DoD F4: Luồng end-to-end đạt nghiệp vụ Phase 6 và visual checklist; form không mất dữ liệu khi back/refresh theo policy đã duyệt.

### F5 — Movement, roster, catalog, import và audit

- Bám 04-movements-drawer-desktop, 05-rosters-desktop và 07-catalogs-desktop.
- Drawer movement phải giữ draft → preview → confirm; không biến thành form append thẳng vào Sheet.
- Roster chỉ hiển thị projection sống; không thêm create/open/close/reopen.
- Catalog/import/audit dùng ledger, filter và state primitives thống nhất.

DoD F5: Các màn phụ không bị hạ chất lượng so với ba màn chính; business guard vẫn đủ.

### F6 — Browser/view_image comparison và responsive acceptance

Quy trình cho từng route/state:

1. Mở concept bằng view_image ở độ chi tiết original.
2. Chụp browser cùng state tại native canvas tương ứng.
3. So sánh side-by-side về hierarchy, geometry, typography, token, density, state và interaction.
4. Ghi mọi sai khác vào fidelity ledger, phân loại intentional/defect/business constraint.
5. Sửa defect rồi chụp lại; intentional difference phải có lý do được duyệt.
6. Chạy thêm device viewport bắt buộc:
   - Android: 360 × 800, 412 × 915.
   - iPhone: 375 × 812, 390 × 844, 430 × 932.
   - Desktop: 1366 × 768, 1440 × 900, 1920 × 1080.
7. Kiểm tra portrait/landscape khi phù hợp, safe-area, keyboard, sticky actions, bottom sheet, no overflow và touch target.

DoD F6:

- Đủ ảnh before/target/after cho cả 10 concept và các viewport bắt buộc.
- Không còn sai khác visual chưa phân loại.
- Không có desktop regression, mobile overflow hoặc bottom nav che hành động.
- Visual match không làm mất live projection, permission, audit, dirty-form guard hoặc dedicated route.

## 13. Danh sách file/module dự kiến tạo mới hoặc chỉnh sửa

Đây là inventory dự kiến, không phải quyền triển khai. Tên cuối phải được khóa trong tám tài liệu và chỉ tạo sau Gate 0.

### Nhóm tài liệu

- Tạo/hoàn thiện đủ tám file ở mục 1.1.
- Có thể bổ sung fidelity ledger, UAT checklist, discrepancy register và cutover runbook trong docs sau khi kiến trúc tài liệu được duyệt.
- Không đưa dữ liệu PII, ID thật, token hoặc backup thật vào Git.

### Nhóm Apps Script core

- Chỉnh `appsscript.json` sau POC identity/scope.
- Tạo `src/server/entrypoints`, `src/server/common` và các adapter trong `src/server/infrastructure`.
- Tạo module permission/audit/document cùng repository/validator/migration/reconciliation trong `src/server/modules` và `src/server/migrations`.
- Tạo React client trong `src/client`, test harness, sandbox config và pipeline build artifact phẳng vào `dist`.
- Giữ `Code.js`, `EmployeeService.js`, `ChangeLogService.js`, `ContractService.js` và `Index.html` trong thời gian chuyển tiếp; chỉ retire sau parity, không xóa ngay.

### Nhóm Apps Script nghiệp vụ

- employees, departments, positions, workingConditions.
- workforceMovements, rosterProjection, dashboards, reports.
- probation, jobTemplates, contracts, documentTemplates, generatedDocuments.
- auditLogs, migrationMappings, migrationLogs, systemConfig.
- Nghiệp vụ Phase 7 chỉ tạo module sau khi Feature Matrix phê duyệt.

### Nhóm giao diện Apps Script

- `src/client/app`: app shell desktop/mobile và routing state.
- `src/client/components`: ledger, cards, filters, bottom sheet, form sections, states và confirmations.
- `src/client/pages`: overview, employees, employee detail/form, movements, rosters, probation, candidate/template forms, catalogs, import và audit.
- UI fidelity fixtures/screenshots không chứa PII thật.

### Nhóm backend Spring cũ

- Mặc định chỉ đọc/đối chiếu, không refactor business.
- Chỉ bổ sung read-only canonical export, reconciliation hoặc reverse-import adapter nếu API hiện tại không đủ và tài liệu migration đã duyệt.
- Nhóm liên quan: HR controllers/services/repositories/DTOs, HrRosterProjectionService, HrWorkforceService, HrProbationService, HrExcelExportService và test.
- Không xóa schema/table/route/template cũ.

### Nhóm frontend React cũ

- Giữ làm oracle và fallback trong parallel run.
- Chỉ sửa khi cần read-only/cutover indicator, migration tooling hoặc bug ngăn đối chiếu và đã được duyệt.
- Nhóm liên quan: frontend/src/App.jsx, frontend/src/api/hr*.js, frontend/src/pages/hr/**, layouts/design-system/responsive CSS và test browser.

### Nhóm dữ liệu/Drive

- Spreadsheet sandbox/production tách biệt; IDs ở Script Properties/config được kiểm soát.
- Sheet schema theo HR_DATA_MODEL.md; không dùng row number ID.
- Drive folder tách template/generated/archive/quarantine theo ACL.
- Canonical migration package, mapping, checksum, backup và reverse export được version hóa; artifact có PII nằm ngoài Git.

## 14. Ma trận gate tổng

| Gate | Điều kiện bắt buộc | Phase được mở |
| --- | --- | --- |
| G0 — Documentation | Đủ tám tài liệu được duyệt, không còn mâu thuẫn chưa xử lý | Phase 1 |
| G1 — Platform safety | Identity server-side, permission, quota, concurrency và full/hybrid decision đạt | Phase 2 |
| G2 — Architecture | Core contract/repository/lock/audit/config chạy trên sandbox | Phase 3 |
| G3 — Data reversibility | Idempotent shadow import, reconciliation và round-trip reverse export đạt | Phase 4–6 |
| G4 — Functional parity | Employee, movement/projection, probation/document in-scope đạt DoD | Phase 7 hoặc Phase 8 |
| G5 — Fidelity | F0–F6 đạt cho toàn bộ màn in-scope | Phase 8 exit |
| G6 — Parallel UAT | Dữ liệu, quyền, report, quota, recovery và TCHC sign-off đạt | Phase 9 readiness |
| G7 — Operational approval | Có lệnh cutover rõ, final backup/reconciliation và rollback sẵn sàng | Production switch |

## 15. Tiêu chí dừng hoặc chuyển hybrid

Không tiếp tục full Apps Script nếu xảy ra một trong các điều kiện sau mà không có biện pháp đã được chứng minh:

- Không xác định được actor thật hoặc không thể enforce quyền server-side.
- Dữ liệu PII/tài liệu phải chia sẻ rộng hơn chính sách cho phép.
- Lock/quota/execution time gây lost update, duplicate hoặc thao tác không hoàn tất.
- Google Docs/DOCX/PDF không giữ được định dạng pháp lý đã duyệt.
- Không thể round-trip dữ liệu về backend cũ.
- Không thể reconcile projection/report ở mức record.
- Scope yêu cầu transaction/query/retention vượt khả năng Sheets được ghi trong HR_RISK_ASSESSMENT.md.

Trong các trường hợp này, giữ Apps Script cho UI/workflow phù hợp và dùng backend/database/document service cho workload rủi ro. Hybrid là một kết quả hợp lệ của Phase 1, không phải thất bại.

## 16. Kết quả cuối cùng mong đợi

Roadmap hoàn thành khi hệ thống mới:

- Có parity được chứng minh cho toàn bộ chức năng in-scope.
- Giữ được business flow, lịch sử, template, document và audit.
- Có permission server-side, PII control, lock và quota evidence.
- Có migration lặp lại an toàn, reconciliation và reverse export.
- Đạt fidelity theo cả 10 concept trên desktop/mobile.
- Chạy song song có một authoritative writer và không tạo xung đột ngầm.
- Cutover/rollback đã diễn tập, còn hệ thống cũ ở read-only và không bị xóa.
- Chỉ được chuyển production khi người dùng/phụ trách vận hành cho phép rõ ràng.
