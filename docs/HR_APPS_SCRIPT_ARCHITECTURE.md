# Kiến trúc mục tiêu cho HR Google Apps Script

Ngày lập: **2026-07-28**

Trạng thái: **Đề xuất kiến trúc — chưa triển khai**

Phạm vi: phân hệ HR trong `QuanLyNhanSu_AppScripts/`; không thay thế hoặc xóa backend/frontend cũ ở giai đoạn này.

## 1. Kết luận kiến trúc

Source Apps Script hiện tại là prototype bốn màn hình, chưa đủ an toàn để làm hệ thống HR chính thức. Hướng mục tiêu là:

1. Giữ Spring Boot + MySQL là nguồn dữ liệu chính trong thời gian audit, migration và chạy song song.
2. Tổ chức Apps Script theo module ở source local, build thành artifact phẳng trong `dist/`, rồi mới push bằng `clasp`.
3. Dùng React/Vite để triển khai giao diện responsive trong **một file HTMLService đã bundle**, nhưng không cam kết PWA/offline/installable vì HTMLService chạy trong iframe sandbox.
4. Chỉ cho phép một tập RPC global nhỏ; mọi RPC phải đi qua request context, xác thực danh tính, phân quyền server, validation, service và repository.
5. Dùng Google Sheets như kho dữ liệu có schema/version rõ ràng, UUID ổn định, movement ledger và operation journal; không dùng số dòng làm ID.
6. Dùng Google Docs/Drive cho template và tài liệu sinh ra, nhưng file HR mặc định phải private/restricted, có metadata và lịch sử.
7. Chỉ chấp nhận Apps Script làm system of record sau khi vượt qua **deployment identity gate**. Nếu không chứng minh được danh tính người dùng hoặc yêu cầu giao dịch/đồng thời vượt khả năng Sheets, chuyển sang kiến trúc hybrid.

## 2. Nguyên tắc và phạm vi

### 2.1. Nguyên tắc bắt buộc

- Không xóa hoặc làm gián đoạn backend/frontend cũ trong quá trình chuyển đổi.
- Không đồng bộ hai chiều tự động khi chưa có cơ chế giải quyết xung đột.
- Không hard-code Spreadsheet ID, Drive Folder ID, Template ID hoặc secret trong source/client.
- Không cho UI gọi trực tiếp `SpreadsheetApp`, `DriveApp` hoặc `DocumentApp`.
- Không tin dữ liệu, role hoặc employee ID do client gửi lên.
- Không trả dữ liệu nhạy cảm nếu màn hình và quyền hiện tại không cần.
- Không xem LockService là transaction; mọi write quan trọng cần idempotency và operation journal.
- Không triển khai production, đổi deployment hoặc push code chỉ từ việc phê duyệt tài liệu này.

### 2.2. Ngoài phạm vi tài liệu

- Chưa chốt schema chi tiết từng cột; schema chính thức thuộc `HR_DATA_MODEL.md`.
- Chưa quyết định ngày cutover.
- Chưa chọn retention pháp lý cho hồ sơ, audit và tài liệu; cần chủ nghiệp vụ/pháp chế xác nhận.
- Không hứa full PWA. Mục tiêu UI là responsive web app trong HTMLService.

## 3. Current-state evidence

| Khu vực | Hiện trạng đã xác nhận | Nguồn |
|---|---|---|
| Web entry | `doGet(e)` bỏ qua route và luôn trả `Index` | `QuanLyNhanSu_AppScripts/Code.js:9-16` |
| Cấu hình | Spreadsheet ID hard-code trong source | `QuanLyNhanSu_AppScripts/Code.js:6-7` |
| RPC | Có sáu wrapper mỏng nhưng không tạo request context, không authz, không validation | `QuanLyNhanSu_AppScripts/Code.js:18-46` |
| Employee read | `getDataRange().getValues()` đọc toàn bộ used range | `QuanLyNhanSu_AppScripts/EmployeeService.js:33-40` |
| Employee schema | Mapping theo index cố định; `status`, CCCD và địa chỉ đang đọc sai cột của workbook `T6-26` | `QuanLyNhanSu_AppScripts/EmployeeService.js:67-89`; `Quan_Ly_Nhan_Su.xlsx`, sheet `T6-26`, header row 4 |
| Employee ID | ID được tạo từ số dòng `EMP_<row>` | `QuanLyNhanSu_AppScripts/EmployeeService.js:67-70` |
| Search | RPC search tồn tại nhưng UI tải toàn bộ 336 bản ghi rồi lọc ở browser | `Code.js:23-26`; `Index.html:424-433,488-500` |
| Contract | Một template ID và folder ID được nhập từ client; map cứng một bộ 22 placeholder | `Index.html:211-312,532-570`; `ContractService.js:17-68` |
| Document sharing | Google Doc và PDF bị đặt `ANYONE_WITH_LINK` | `ContractService.js:72-78` |
| Movement | Form gọi `handleLogChange(event)` nhưng không có hàm này | `Index.html:328-365,406-580` |
| Movement filter | `getChangeLogs(month, year)` không dùng `month` hoặc `year` | `ChangeLogService.js:36-59` |
| Concurrency | Không có `LockService`, idempotency key hoặc operation journal | Toàn bộ `QuanLyNhanSu_AppScripts/*.js` |
| Permission/audit | Không có permission service; `Changes_Log` là business movement, không phải audit log | `ChangeLogService.js:1-64` |
| Deployment | Chạy bằng người deploy và cho mọi người dùng Google đã đăng nhập truy cập | `appsscript.json:6-9` |
| UI | HTML, CSS và client JS gộp trong một file 582 dòng; Tailwind CDN runtime | `Index.html:1-582` |
| Source control | Toàn bộ thư mục Apps Script, `.clasp.json` và workbook chứa dữ liệu đang untracked | `git status --short --untracked-files=all -- QuanLyNhanSu_AppScripts` ngày 2026-07-28 |

Không được dùng tuyên bố “clone 100%” tại `README_HUONG_DAN.md:1-3` làm bằng chứng hoàn thành tính năng.

## 4. Các quyết định kiến trúc

### ADR-01 — Deployment identity là cổng chặn bắt buộc

Manifest hiện tại dùng `executeAs: USER_DEPLOYING` và `access: ANYONE`. Theo tài liệu Google, `ANYONE` là mọi người dùng Google đã đăng nhập, còn `USER_DEPLOYING` khiến web app chạy bằng quyền của người deploy. Đồng thời, email từ `Session.getActiveUser()` có thể là chuỗi rỗng trong web app “execute as me”. Vì vậy không được suy ra rằng người truy cập đã được nhận diện chỉ vì họ đăng nhập Google.

Tài liệu chính thức:

- [Web apps](https://developers.google.com/apps-script/guides/web)
- [Web app manifest: access và executeAs](https://developers.google.com/apps-script/manifest/web-app-api-executable)
- [Session.getActiveUser](https://developers.google.com/apps-script/reference/base/session)

#### Identity gate

Trước khi triển khai dữ liệu thật, staging phải được kiểm thử bằng **tất cả nhóm người dùng mục tiêu**:

1. Kiểm tra `Session.getActiveUser().getEmail()` có khác rỗng hay không.
2. Đối chiếu active user với effective user, deployment mode và Google Workspace domain.
3. Xác minh người dùng chỉ truy cập được đúng file/folder mà role cho phép.
4. Kiểm tra lại bằng tài khoản ngoài domain, tài khoản bị khóa và người dùng không có role.
5. Lưu kết quả pass/fail nhưng không ghi email thật vào tài liệu hoặc log kiểm thử công khai.

#### Tiêu chí pass

- 100% tài khoản mục tiêu trả về danh tính ổn định, chuẩn hóa được và ánh xạ duy nhất tới `USERS`.
- Tài khoản ngoài allowlist/domain bị từ chối ở server trước khi đọc Sheet/Drive.
- Quyền Drive/Docs phù hợp với deployment mode đã chọn.
- Permission tests chứng minh ẩn nút không phải cơ chế bảo vệ duy nhất.

#### Nếu gate fail

Không dùng Apps Script owner-execution như một backend HR độc lập. Chuyển sang hybrid:

- Spring Boot hoặc một dịch vụ xác thực đáng tin cậy giữ identity, role và dữ liệu chính.
- Apps Script chỉ nhận job đã ký/xác thực để tạo Docs/PDF hoặc thao tác Workspace.
- Không dùng email rỗng, temporary user key hoặc ID client tự khai làm identity nghiệp vụ.

### ADR-02 — Một nguồn dữ liệu ghi trong từng phase

- Trước cutover: backend cũ là source of truth; Apps Script chỉ import snapshot, đọc thử nghiệm và tạo dữ liệu pilot tách biệt.
- Giai đoạn chạy song song: xác định ownership theo module; không cho cùng một record được sửa tự do ở hai hệ thống.
- Sau cutover: backend cũ chuyển read-only trước, chưa xóa; rollback export vẫn hoạt động.

### ADR-03 — Source module, artifact phẳng

`clasp` hỗ trợ phát triển local và quản lý deployment. Dự án này vẫn nên build source TypeScript/React thành artifact tối giản để:

- Không đẩy workbook, README, test fixture hoặc source map lên Apps Script.
- Không phụ thuộc thứ tự nạp file global.
- Có lint, type-check và unit test trước khi push.
- Inline JS/CSS của client vào một HTML file phù hợp HTMLService.

Tham chiếu: [Use the command-line interface with clasp](https://developers.google.com/apps-script/guides/clasp).

### ADR-04 — Apps Script phù hợp pilot 336 người, không mặc định thay database

336 hồ sơ nhân sự là quy mô nhỏ đối với một Sheet được chuẩn hóa. Rủi ro chính là permission, consistency, audit, document quota và concurrent writes. Việc chọn Apps Script làm system of record phải dựa trên kiểm thử, không dựa riêng vào giới hạn 10 triệu ô.

## 5. Cấu trúc source/build/dist

```text
QuanLyNhanSu_AppScripts/
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── build/
│   ├── build-server.mjs
│   ├── build-client.mjs
│   └── verify-dist.mjs
├── config/
│   ├── appsscript.base.json
│   └── env.example.json
├── src/
│   ├── server/
│   │   ├── entrypoints/
│   │   │   ├── App.ts
│   │   │   └── RpcEntrypoints.ts
│   │   ├── common/
│   │   │   ├── ApiResult.ts
│   │   │   ├── DomainError.ts
│   │   │   ├── RequestContext.ts
│   │   │   ├── Idempotency.ts
│   │   │   └── Clock.ts
│   │   ├── modules/
│   │   │   ├── employees/
│   │   │   ├── catalogs/
│   │   │   ├── probation/
│   │   │   ├── contracts/
│   │   │   ├── workforce-movements/
│   │   │   ├── documents/
│   │   │   ├── reports/
│   │   │   ├── permissions/
│   │   │   └── audit/
│   │   ├── infrastructure/
│   │   │   ├── config/
│   │   │   ├── sheets/
│   │   │   ├── drive/
│   │   │   ├── docs/
│   │   │   ├── cache/
│   │   │   ├── locks/
│   │   │   └── logging/
│   │   └── migrations/
│   │       ├── adapters/
│   │       ├── normalize/
│   │       ├── upsert/
│   │       ├── reconcile/
│   │       └── rollback/
│   └── client/
│       ├── main.tsx
│       ├── app/
│       ├── pages/
│       ├── components/
│       ├── api/
│       ├── validation/
│       └── styles/
├── tests/
│   ├── unit/
│   ├── contract/
│   ├── fixtures/
│   └── e2e/
└── dist/
    ├── appsscript.json
    ├── Code.js
    └── Index.html
```

Quy tắc:

- `src/`, `tests/`, raw Excel và source maps không được push.
- `.clasp.json` thật theo môi trường không commit; repo chỉ có hướng dẫn hoặc file mẫu không chứa ID.
- Vite build React/CSS thành một `Index.html`; server bundle xuất đúng các global entrypoint cần thiết.
- `dist/` phải tái tạo được bằng một lệnh build và được kiểm tra không chứa secret/ID thật.
- Không sửa trực tiếp project Apps Script production; source repository là nguồn code chuẩn sau khi quy trình được phê duyệt.

## 6. Layer và request lifecycle

```text
React UI
  → RpcClient + withSuccessHandler/withFailureHandler
  → global RPC entrypoint
  → RequestContextFactory
  → Authentication/PermissionGuard
  → Validator
  → Application Service
  → Repository interface
  → Sheets/Drive/Docs adapter
  → Audit + cache invalidation
  → ApiResult DTO tối thiểu
```

### 6.1. RPC entrypoint

Chỉ global hóa các hàm được whitelist, ví dụ:

```text
doGet
apiGetBootstrap
apiListEmployees
apiGetEmployee
apiCreateEmployee
apiUpdateEmployee
apiCreateMovement
apiListMovements
apiGenerateDocument
apiListTemplates
apiRunMigrationDryRun
```

Không dùng một dispatcher nhận tên hàm tùy ý. Hàm nội bộ có hậu tố `_` hoặc được đóng trong bundle namespace để không thể gọi trực tiếp từ `google.script.run`.

Mọi response dùng envelope thống nhất:

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "meta": {
    "requestId": "opaque-id",
    "schemaVersion": "...",
    "releaseVersion": "..."
  }
}
```

Lỗi client chỉ chứa code và thông điệp an toàn; stack trace ở Cloud Logging. `google.script.run` là API bất đồng bộ và cần cả success/failure handler theo [tài liệu chính thức](https://developers.google.com/apps-script/guides/html/reference/run).

### 6.2. Controller/handler

- Parse request DTO và page/filter/sort.
- Tạo context từ session, release, locale và request ID.
- Gọi permission guard trước khi đọc repository.
- Không chứa nghiệp vụ hoặc câu lệnh Sheet.
- Chuyển domain error thành response code ổn định.

### 6.3. Validator

- Validate type, required, enum, length và format ở server.
- Kiểm tra CCCD, mã nhân sự, ngày, salary và quan hệ start/end theo rule đã được xác nhận.
- Kiểm tra optimistic version khi update.
- Client validation chỉ hỗ trợ trải nghiệm, không thay server validation.
- Không tự tạo default mang ý nghĩa pháp lý nếu dữ liệu thiếu.

### 6.4. Service

- Thực thi use case và state transition.
- Không dựa vào row number hoặc tên người làm khóa.
- Điều phối nhiều repository bằng operation journal.
- Phát sinh movement/history/document metadata và audit trong cùng operation logical.
- Dùng clock/UUID adapter để có thể test.

### 6.5. Repository

- Mỗi repository có interface và Google Sheets implementation.
- Header được map theo tên canonical và `SCHEMA_VERSION`, không theo index mơ hồ.
- UUID là khóa nghiệp vụ; `legacy_id` chỉ dùng mapping/migration.
- Dùng batch `getValues`/`setValues`, không đọc/ghi từng ô trong vòng lặp.
- List API trả projection, pagination và field set theo quyền.
- Row locator/index chỉ là cache nội bộ có thể tái tạo, không lộ ra domain/client.
- Soft delete/archive; không xóa cứng record HR quan trọng.

Google khuyến nghị giảm số lần gọi service và dùng batch operations: [Apps Script best practices](https://developers.google.com/apps-script/guides/support/best-practices).

## 7. Module boundaries

| Module | Trách nhiệm | Không được làm |
|---|---|---|
| `employees` | Hồ sơ chuẩn, search/list/detail, update, employment history | Không tự sinh hợp đồng hoặc ghi trực tiếp audit sheet |
| `catalogs` | Department, position, workplace, employment status/type | Không dùng chuỗi tự do thay master ID khi đã có danh mục |
| `workforce-movements` | Ledger tuyển mới, nghỉ việc, điều chuyển, đổi chức vụ, chuyển chính thức, tạm nghỉ/quay lại | Không sửa số tổng trực tiếp |
| `probation` | Candidate, job template selection, probation state transition | Không hard-code mười template trong service |
| `contracts` | Contract metadata và lifecycle | Không thực hiện thao tác Drive trực tiếp |
| `documents` | Template version, placeholder, Docs/PDF/DOCX, generated document history | Không public-share tài liệu HR |
| `reports` | Projection tháng/quý/năm, headcount, net movement, export | Không tính từ giá trị hard-code UI |
| `permissions` | Identity, role, permission, sensitive-field policy | Không chỉ ẩn nút client |
| `audit` | Actor/action/entity/before-after/result/request ID | Không trộn với business movement ledger |
| `migrations` | Staging, normalize, idempotent upsert, mapping, reconcile, rollback export | Không ghi thẳng dữ liệu chưa validate vào sheet chuẩn |

## 8. Permission và dữ liệu nhạy cảm

### 8.1. Server authorization

Mỗi RPC khai báo permission bắt buộc, ví dụ:

```text
EMPLOYEE_LIST
EMPLOYEE_VIEW_BASIC
EMPLOYEE_VIEW_SENSITIVE
EMPLOYEE_CREATE
EMPLOYEE_UPDATE
MOVEMENT_CREATE
REPORT_VIEW
DOCUMENT_GENERATE
DOCUMENT_DOWNLOAD
TEMPLATE_MANAGE
MIGRATION_RUN
AUDIT_VIEW
```

PermissionGuard lấy role từ repository bằng identity đã xác minh; không nhận role từ payload. Trường nhạy cảm được lọc ở server trước khi serialize.

### 8.2. OAuth scopes

Manifest production phải khai báo scope rõ ràng và tối thiểu. Google khuyến nghị published web app dùng tập scope ít quyền nhất: [Authorization scopes](https://developers.google.com/apps-script/concepts/scopes).

### 8.3. File access

- Template và generated document nằm trong folder do tổ chức sở hữu/quản trị.
- Không dùng `ANYONE_WITH_LINK`.
- Lưu Drive file ID và permission state, không coi URL là authorization.
- Download/generate đều kiểm quyền lại ở server.
- Quyền thực tế của Shared Drive/Workspace phải được kiểm thử theo deployment identity.

## 9. Audit và observability

`AUDIT_LOGS` tối thiểu có:

```text
audit_id, occurred_at, actor_id, actor_key, action,
entity_type, entity_id, request_id, result,
changed_fields, before_hash, after_hash, source, release_version
```

- Không ghi password, token, CCCD, lương, địa chỉ hoặc toàn bộ payload vào Cloud Logging.
- Audit nghiệp vụ lưu thay đổi có cấu trúc; Cloud Logging dùng cho lỗi, duration và correlation.
- Dùng standard Google Cloud project cho production logging/error reporting nếu được quản trị phê duyệt.
- Có dashboard/alert cho exception, timeout, permission denied bất thường, quota và reconciliation mismatch.

Tham chiếu: [Apps Script logging](https://developers.google.com/apps-script/guides/logging).

## 10. Cache

Áp dụng cache-aside cho:

- Catalog ít đổi.
- Header/schema registry.
- Employee row locator/index có version.
- Dashboard projection đã loại dữ liệu nhạy cảm.

Không cache toàn bộ hồ sơ nhạy cảm hoặc xem cache là source of truth. Key có `env`, `schemaVersion` và data version. Cache miss/eviction là hành vi bình thường; write thành công phải invalidate key liên quan, nhưng repository vẫn phải đúng khi invalidate thất bại.

Giới hạn chính thức của Cache Service gồm 100 KB/value, 1.000 item và thời hạn chỉ mang tính gợi ý: [Cache class](https://developers.google.com/apps-script/reference/cache/cache).

## 11. Lock, idempotency và consistency

Mẫu write operation:

1. Validate cú pháp ngoài lock.
2. `tryLock` script lock với timeout ngắn.
3. Re-read record và kiểm version/uniqueness trong lock.
4. Tạo hoặc đọc operation journal bằng idempotency key.
5. Batch write record, history/movement và audit cần thiết.
6. Đánh dấu operation `APPLIED` hoặc `FAILED` để reconciler xử lý nhất quán.
7. Release lock trong `finally`.
8. Invalidate cache sau commit logical.

Lock chỉ ngăn đoạn code đồng thời; không rollback được nhiều row/sheet/Drive operation. Tham chiếu: [Lock Service](https://developers.google.com/apps-script/reference/lock).

Operation journal nội bộ dùng status chung `PENDING/APPLIED/FAILED`; lần render ghi checkpoint kỹ thuật:

```text
PENDING [DOC_CREATED → EXPORTING → READY] → APPLIED
                 └───────────────────────→ FAILED
```

Reconciler tìm operation treo và file mồ côi. Retry chỉ chạy khi cùng idempotency key và không tạo tài liệu trùng. Checkpoint không phải status nghiệp vụ của `GENERATED_DOCUMENTS`; trạng thái tài liệu canonical (`PROCESSING/PREVIEW/GENERATED/SUPERSEDED/VOIDED/FAILED`) được khóa trong `HR_DATA_MODEL.md` và `HR_TEMPLATE_MIGRATION.md`.

## 12. Document/template architecture

```text
DocumentController
  → DocumentGenerationService
    → TemplateRepository
    → PlaceholderValidator
    → Employee/Probation Repository
    → DocsRenderer
    → DriveRepository
    → GeneratedDocumentRepository
    → AuditService
```

- `DOCUMENT_TEMPLATES` lưu template code, Drive file ID, version, type, placeholder schema, status và updater.
- Mỗi lần sinh lưu template version và snapshot dữ liệu đã dùng.
- Preflight xác nhận đủ placeholder và phát hiện placeholder thừa/thiếu trước khi tạo file.
- Renderer xử lý body/header/footer theo contract đã kiểm thử.
- DOCX/PDF export phải có test fixture so sánh placeholder còn sót.
- Không dùng default pháp lý để che dữ liệu thiếu.

## 13. Migration-friendly boundaries

```text
Legacy export
  → immutable staging artifact
  → parser/adapter theo schemaVersion
  → normalizer + validation report
  → dry-run diff
  → idempotent upsert
  → ID_MAPPINGS
  → reconciliation report
```

Quy tắc:

- Khóa idempotency: `(source_system, source_entity, legacy_id)`.
- Lưu source hash để bỏ qua record không đổi và phát hiện xung đột.
- Mỗi run có `migration_run_id`, thời gian, input checksum, count, lỗi và trạng thái.
- Staging không phải dữ liệu vận hành; không cho UI sửa.
- Rollback exporter tạo format backend-compatible và giữ mapping ngược.
- Generated documents được mapping bằng file ID và template version; không copy/move không kiểm soát.
- Cutover chỉ sau khi count, relation, sample value và business report reconcile đạt ngưỡng đã phê duyệt.

## 14. React/Vite trong HTMLService

### 14.1. Cách build

- React source được Vite build ở chế độ single-file: bundle JS và CSS inline vào `dist/Index.html`.
- Không dùng Tailwind CDN hoặc runtime compiler; CSS được build/purge trước.
- Không đặt secret/config server vào `import.meta.env` của client bundle.
- `RpcClient` bọc `google.script.run`, luôn có success/failure handler, timeout UI, request deduplication và stale-response guard.
- React render text/attribute an toàn; không ghép Sheet data vào `innerHTML` hoặc inline handler.

### 14.2. Routing và concept UI

- Dùng state router phù hợp HTMLService và đồng bộ với `google.script.history`/`google.script.url` nếu deep-link được nghiệm thu.
- Bám `docs/hr-design-concepts/HR_UI_REDESIGN_CONCEPT.md`:
  - desktop sidebar + content ledger;
  - mobile bottom navigation và ledger list;
  - movement drawer/full-screen mobile;
  - dossier + timeline;
  - responsive command rail, loading/error/empty states.
- Test các viewport được liệt kê trong concept.

### 14.3. Không cam kết PWA

HTMLService chỉ hỗ trợ IFRAME sandbox; active content phải HTTPS và top-level navigation bị giới hạn. Vì app không kiểm soát hoàn toàn top-level origin/service worker lifecycle, phase này chỉ cam kết responsive web app, không cam kết offline, install prompt, push notification hoặc PWA certification.

Tham chiếu:

- [HTMLService restrictions](https://developers.google.com/apps-script/guides/html/restrictions)
- [HTMLService best practices](https://developers.google.com/apps-script/guides/html/best-practices)
- [Web apps and browser history](https://developers.google.com/apps-script/guides/web#web_apps_and_browser_history)

Nếu PWA thật là yêu cầu bắt buộc, dùng frontend độc lập và backend/hybrid có authentication/CORS phù hợp.

## 15. Config và môi trường

### 15.1. Script Properties

Các key đề xuất, không ghi giá trị vào repo:

```text
APP_ENV
APP_RELEASE_VERSION
APP_SCHEMA_VERSION
PRIMARY_SPREADSHEET_ID
DOCUMENT_ROOT_FOLDER_ID
TEMPLATE_ROOT_FOLDER_ID
ALLOWED_WORKSPACE_DOMAIN
TIME_ZONE
LOG_LEVEL
FEATURE_FLAGS_JSON
```

`PropertiesService.getScriptProperties()` phù hợp config string theo script, nhưng editor/runtime có quyền vẫn đọc được. Vì vậy không coi Script Properties là secret vault. Nếu sau này có secret có giá trị cao, dùng một secret manager/dịch vụ hybrid được phê duyệt.

Tham chiếu: [Properties Service](https://developers.google.com/apps-script/reference/properties/).

### 15.2. Dev/staging/prod

Mỗi môi trường có riêng:

- Apps Script project và immutable deployment version.
- Spreadsheet/folder/template Drive.
- Script Properties.
- Google Cloud project/log stream khi có thể.
- `.clasp.json` được inject cục bộ/CI, không commit.

| Môi trường | Dữ liệu | Access | Mục đích |
|---|---|---|---|
| Dev | Fixture tổng hợp, không PII thật | Developer | Unit/manual development |
| Staging | Bản sao đã kiểm soát/ẩn dữ liệu theo chính sách | Nhóm UAT | Identity, permission, migration, load test |
| Prod | Dữ liệu thật | Nhóm được phê duyệt | Vận hành sau go-live gate |

Không dùng cùng Spreadsheet/Folder giữa ba môi trường. Production promotion phải dùng version đã kiểm thử; không push/deploy tự động nếu chưa có quy trình phê duyệt.

## 16. Testing strategy

### 16.1. Unit test local

- Validator, formatter, state transition, permission matrix.
- Placeholder resolver và number-to-Vietnamese-text implementation.
- Employee/movement/report projection.
- Migration normalizer, hash và idempotent upsert planner.
- Error mapper và field redaction.

### 16.2. Repository contract test

- Header reorder/unknown column/missing required column.
- Insert row không đổi UUID.
- Batch read/write và optimistic version conflict.
- Cache miss/eviction không làm sai kết quả.
- Duplicate employee code/legacy ID/CCCD theo rule đã duyệt.

### 16.3. Staging integration test

- Identity matrix cho từng role và tài khoản ngoài domain.
- Drive/Docs permission và file privacy.
- Concurrent writes, lock timeout, retry cùng idempotency key.
- Sinh Doc/PDF/DOCX, placeholder lint và orphan reconciliation.
- Quota/error simulation, timeout và recovery.
- Migration dry-run, rerun, reconciliation và rollback export.

### 16.4. UI/e2e

- Navigation/deep link/back-forward.
- Loading, empty, error, retry và stale response.
- Permission-hidden và server-forbidden paths.
- Desktop/mobile viewports trong concept; không horizontal overflow ngoài vùng table được thiết kế.
- Keyboard, focus, modal/drawer escape, touch target và form unsaved-change guard.

## 17. Definition of Done

Một module chỉ hoàn thành khi:

- [ ] Có source/module ownership và API contract.
- [ ] RPC kiểm identity, permission và validation ở server.
- [ ] Không trả thừa trường nhạy cảm.
- [ ] Repository không dùng row number làm ID và có schema/version check.
- [ ] Write có lock, idempotency và audit phù hợp.
- [ ] Cache invalidation được test; cache miss vẫn đúng.
- [ ] Unit/contract/integration tests pass.
- [ ] Error có request ID, không lộ stack/PII cho client.
- [ ] Responsive UI pass viewport bắt buộc.
- [ ] Migration/rollback ảnh hưởng module được cập nhật và test rerun.
- [ ] Tài liệu vận hành, monitoring và owner được xác định.
- [ ] `dist/` không chứa ID thật, PII, secret, raw workbook hoặc source map.
- [ ] Chưa deploy production nếu chưa có phê duyệt riêng.

Go-live toàn hệ thống còn yêu cầu:

- Identity gate pass.
- Risk P0 đóng hết; P1 có owner và biện pháp được phê duyệt.
- Hai kỳ đối chiếu hoặc khoảng thời gian UAT do chủ nghiệp vụ phê duyệt không có sai lệch nghiêm trọng.
- Backup, final migration, rollback drill và read-only cutover backend cũ thành công.

## 18. Thứ tự triển khai khuyến nghị

1. **Foundation spike:** identity gate, deployment model, config, build/dist, response/error contract.
2. **Data foundation:** schema registry, UUID, repositories, migration dry-run 336 nhân sự.
3. **Employee read-only:** permission, paged list/detail, concept UI responsive.
4. **Controlled writes:** locks, idempotency, operation journal, audit.
5. **Movement ledger/reports:** headcount projection, month/quarter/year.
6. **Probation/templates/documents:** template registry, preview, generation history, restricted Drive access.
7. **Remaining HR modules:** contracts, transfer, salary/allowance, leave/resignation theo feature matrix đã xác nhận.
8. **Parallel run/cutover:** reconciliation, load/security test, rollback drill.

Nếu identity spike hoặc permission model fail, dừng lộ trình pure Apps Script và chuyển ADR sang hybrid trước khi xây thêm UI/nghiệp vụ.

## 19. Tài liệu chính thức tham chiếu

- [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Web app manifest](https://developers.google.com/apps-script/manifest/web-app-api-executable)
- [Session](https://developers.google.com/apps-script/reference/base/session)
- [Authorization scopes](https://developers.google.com/apps-script/concepts/scopes)
- [Apps Script best practices](https://developers.google.com/apps-script/guides/support/best-practices)
- [google.script.run](https://developers.google.com/apps-script/guides/html/reference/run)
- [Lock Service](https://developers.google.com/apps-script/reference/lock)
- [Cache](https://developers.google.com/apps-script/reference/cache/cache)
- [Properties Service](https://developers.google.com/apps-script/reference/properties/)
- [HTMLService restrictions](https://developers.google.com/apps-script/guides/html/restrictions)
- [HTMLService best practices](https://developers.google.com/apps-script/guides/html/best-practices)
- [Logging](https://developers.google.com/apps-script/guides/logging)
- [clasp](https://developers.google.com/apps-script/guides/clasp)
