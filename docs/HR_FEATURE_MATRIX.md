# Feature Matrix chuyển đổi HR

Cập nhật: 2026-07-28
Nguồn đánh giá: source hiện tại, không suy đoán runtime production.

## 1. Quy ước

Trạng thái dùng trong bảng:

- **Đã hoàn chỉnh ở source**: flow chính có backend + frontend + guard; vẫn có thể còn runtime UAT.
- **Có nhưng chưa hoàn chỉnh**: có source thật nhưng thiếu một phần nghiệp vụ, UI, test hoặc vận hành.
- **Chỉ có backend/schema**: không có end-to-end flow usable.
- **Chỉ có frontend/prototype**: UI hoặc RPC placeholder không có domain phía sau.
- **Apps Script đang làm dở**: có một phần code nhưng không an toàn/đúng contract.
- **Chưa có**.
- **Không nên chuyển nguyên trạng**.
- **Cần thiết kế lại**.

Viết tắt nguồn:

- `B-EMP`: `HrManagementController`, `HrManagementService`, Flyway V1.
- `B-WF`: `HrWorkforceController/Service`, `HrActivityController/QueryService`, `HrRosterProjectionService`, V4.
- `B-IMP`: `HrImportController`, package `hr/importer`.
- `B-EXP`: `HrExcelExportController/Service`.
- `B-PROB`: `HrProbationController/Service`, `HrProbationJobTemplateSeeder`, Flyway V3.
- `F-*`: `frontend/src/pages/hr/*` và `frontend/src/api/hr*.js`.
- `G-*`: source trong `QuanLyNhanSu_AppScripts/`.

## 2. Nền tảng, bảo mật và app shell

| Nhóm chức năng | Chức năng | Backend cũ | Frontend cũ | Apps Script hiện tại | Trạng thái | Thiếu gì | Hướng chuyển đổi |
|---|---|---|---|---|---|---|---|
| Bảo mật | Xác thực HR | JWT; active `MANAGER`, 401/403 (`SecurityConfig`) | `HrRoute` + auth storage | `USER_DEPLOYING` + `ANYONE`; không auth gate | Cần thiết kế lại P0 | Identity ổn định, domain restriction, negative tests | Spike deployment; nếu không lấy actor tin cậy thì giữ backend auth/hybrid |
| Bảo mật | Fine-grained permission | Chỉ một role `MANAGER` | Ẩn/hiện theo role chung | Không có | Chưa có | quyền view PII/salary/template/import/audit | `USERS/ROLES/USER_ROLES/ROLE_PERMISSIONS`, server check mọi RPC |
| Bảo mật | PII minimization | List DTO hạn chế; detail cho Manager | Lương/BHXH chủ yếu ở detail | Trả toàn DTO PII về browser | Cần thiết kế lại P0 | field-level DTO và audit view/export | DTO theo use case/scope; không share sheet trực tiếp |
| Bảo mật | Drive/file permission | DOCX BLOB trong DB | authenticated download | Doc/PDF `ANYONE_WITH_LINK` | Cần thiết kế lại P0 | private folder, permission scan | restricted Shared Drive/folder; không trả public URL |
| Audit | Actor từ principal | Có (`HrActorResolver`) | Không gửi actor ID | Không có actor | Cần thiết kế lại | request context và stable email | resolve actor server-side; snapshot role/display name |
| Audit | Mutation audit | Có cho nhiều command | Audit page read-only | `Changes_Log` không phải audit | Có nhưng chưa hoàn chỉnh ở legacy; AS chưa có | before/after/result, view/export audit | append-only `AUDIT_LOGS`, sanitized metadata |
| Đồng thời | Lock/version/idempotency | Có trong employee/movement/import | Gửi rowVersion/idempotency | Không LockService; row-number ID | Cần thiết kế lại | operation journal, lock scope, retry | short ScriptLock + optimistic version + unique idempotency |
| API | Error/response contract | ApiResponse nhưng probation advice có gap | toast/retry một phần | ad-hoc object/empty array; hầu như không failure handler | Cần thiết kế lại | stable error code/request ID | envelope `{ok,data,error,meta}`; global client error states |
| Config | Environment config | application/env/Flyway | Axios/env build | hard-code Spreadsheet ID và nhập template/folder mỗi form | Cần thiết kế lại | dev/staging/prod, secret handling | Script Properties; build artifact không chứa ID thật |
| App shell | Desktop navigation | N/A | sidebar/top bar | header ngang 4 tab | Apps Script đang làm dở | đủ module, active rail, deep link | port concept shell; hash/query router |
| App shell | Mobile navigation/safe area | N/A | bottom nav + More một phần | không có; table scroll ngang | Apps Script đang làm dở | bottom nav, More, safe area, form mode | implement concept; 360–430px QA |
| Routing | Deep link | SPA fallback Spring | 16 route `/manager/hr/**` | `doGet` luôn một Index, tab state mất khi reload | Cần thiết kế lại | stable page/entity deep link | HashRouter/query route trong HtmlService; permission before data |
| PWA | Install/offline/push | Shared PWA infrastructure | hiện có cho app React | không có | Không nên hứa chuyển nguyên trạng | HTMLService sandbox feasibility | spike; nếu PWA parity bắt buộc, giữ external React/hybrid |

## 3. Hồ sơ nhân sự và danh mục

| Nhóm chức năng | Chức năng | Backend cũ | Frontend cũ | Apps Script hiện tại | Trạng thái | Thiếu gì | Hướng chuyển đổi |
|---|---|---|---|---|---|---|---|
| Nhân sự | Danh sách | Page DTO (`B-EMP`) | table/mobile cards (`HrEmployees`) | đọc toàn 336 vào client | Legacy core đã có; AS làm dở | mapping đúng, DTO tối thiểu | repository schema-versioned + server pagination |
| Nhân sự | Search/filter/sort/page | keyword/status/department/position/condition/sort | URL state + stale guard | client filter; RPC search không dùng; không page/sort | Có nhưng AS chưa hoàn chỉnh | query contract + cancellation | index batch read, filter server, page bounded |
| Nhân sự | Chi tiết hồ sơ | đầy đủ employee + 4 profile 1:1 | detail dossier một phần | modal 8 field; mapping sai | Có nhưng chưa hoàn chỉnh | true history/attachments, visual dossier | endpoint scoped detail + activity timeline khi có data |
| Nhân sự | Tạo hồ sơ draft | Có | dedicated `/employees/new` | không có | Chưa có ở AS | validator/catalog/UUID/audit | port DRAFT flow trước active writes |
| Nhân sự | Sửa hồ sơ draft | Có rowVersion | dedicated edit | không có | Chưa có ở AS | dirty guard/version conflict | dedicated route, optimistic concurrency |
| Nhân sự | Sửa trực tiếp active | Backend chặn | UI hướng qua nghiệp vụ | không có | Không nên chuyển như CRUD | command cho từng change type | giữ guard; không mở generic edit active |
| Nhân sự | Xóa hồ sơ draft | Guarded delete | Có | không có | Chưa có ở AS | reference check/audit | chỉ draft chưa reference; còn lại archive |
| Nhân sự | CCCD/CMND | Current state + verification status | detail/form; preserve legacy issuing place | đọc sai cột | Cần thiết kế lại P0 | mapping, mask, duplicate review | restricted sheet/DTO, data-quality issue, không unique mù |
| Nhân sự | BHXH/BHYT | Current state | detail/form | đọc nhưng trả list/browser | Có nhưng chưa hoàn chỉnh | duplicate/history/access control | restricted detail, warning-based dedupe |
| Nhân sự | Liên hệ | Current state | detail/form | chỉ địa chỉ và đang map sai | Có nhưng chưa hoàn chỉnh | full contact + access | normalized current sheet + audit |
| Nhân sự | Lương/phụ cấp | Current current-state field | detail/form | trả list; total hard-code/mapping | Có nhưng chưa hoàn chỉnh | permission và history | restricted DTO; change ledger khi rule được chốt |
| Nhân sự | Lịch sử thay đổi | movement + coarse audit | detail chưa có true timeline | không có | Có nhưng chưa hoàn chỉnh | field delta/activity API | combine movement + audit read model, không bịa |
| Nhân sự | File đính kèm | Không có | Không có | Không có | Chưa có | metadata, Drive, permission, checksum | `ATTACHMENTS` + restricted Drive + audit |
| Nhân sự | Chống trùng | employee code unique; document numbers warning/index | import hiển thị issue | row code + defaults; không UUID | Cần thiết kế lại | stable UUID + review workflow | unique business key, duplicate issue, no auto-merge |
| Danh mục | Phòng ban phân cấp | CRUD/inactivate/parent | Có | chỉ suy ra chuỗi employee | Legacy đã có; AS chưa có | UUID/FK/cycle guard | migrate catalog first; repository + cache |
| Danh mục | Chức vụ | CRUD/inactivate | Có | chỉ chuỗi | Legacy đã có; AS chưa có | master-data UI | port source semantics |
| Danh mục | Điều kiện lao động | CRUD/inactivate | Có | không có | Legacy đã có; AS chưa có | master-data UI | port source semantics |
| Danh mục | Loại hợp đồng/nơi làm việc | Chỉ label current; chưa catalog | Không có | không có | Chưa có | BA vocabulary/lifecycle | chỉ thêm sau source/rule approval |

## 4. Tăng/Giảm, điều chuyển và roster

| Nhóm chức năng | Chức năng | Backend cũ | Frontend cũ | Apps Script hiện tại | Trạng thái | Thiếu gì | Hướng chuyển đổi |
|---|---|---|---|---|---|---|---|
| Movement | Tăng nhân sự | DRAFT -> preview -> confirm -> ACTIVE | End-to-end | RPC append, UI submit function thiếu | Legacy đã hoàn chỉnh ở source; AS hỏng | lifecycle/version/idempotency/projection | port command, không append raw log |
| Movement | Giảm/nghỉ việc | DRAFT -> confirm -> INACTIVE; reason required | End-to-end | chỉ label/form hỏng | Legacy core đã có; AS hỏng | offboarding/document/filters | port exact guard; giữ employee/history |
| Movement | Preview ảnh hưởng | `HrRosterProjectionService` | confirm dialog có periods | không có | Chưa có ở AS | read model | dùng cùng projection với dashboard/export |
| Movement | Cancel/delete draft | Guarded | Có | không có | Chưa có ở AS | version/reference/audit | port guarded command |
| Movement | Correction/reversal/rehire | V4 + service, row mới | Có | không có | Chưa có ở AS | correction link + downstream guard | preserve immutable original |
| Movement | Điều chuyển phòng ban | enum/schema, service từ chối | không create flow | label trong select nhưng không business | Chỉ có schema/prototype | business rule/from-to/audit | BA design + service/test; không coi label là feature |
| Movement | Đổi chức vụ | enum/schema only | không có | không có | Chỉ có backend/schema | rule/history | phase sau approval |
| Movement | Đổi điều kiện làm việc | enum/schema only | không có | không có | Chỉ có backend/schema | rule/history | phase sau approval |
| Movement | Nâng lương/phụ cấp | current fields only | không có workflow | comment server liệt kê nhưng UI không có | Chưa có | before/after, effective date, permission | separate change record/extension after BA rules |
| Movement | Tạm nghỉ/quay lại | không có state/flow | không có | không có | Chưa có | status semantics/headcount | design state machine first |
| Movement | Filter tháng/quý/năm/phòng/type/status | activity API chỉ page/size | không có filters | getChangeLogs bỏ qua month/year | Chưa có end-to-end | query/index/report | add backend/GAS query contract before UI |
| Roster | Baseline tháng | import tạo baseline | hiển thị | static T6 workbook | Có nhưng chưa đồng nhất | 336/339 reconciliation | preserve source timestamp and manifest |
| Roster | Live monthly projection | Có từ baseline + confirmed movement | UI dùng | không có | Chưa có ở AS | deterministic projection | port same algorithm/test vectors |
| Roster | Manual open/close/reopen | API legacy còn | client methods có nhưng page không gọi | không có | Không nên chuyển nguyên trạng | semantics đã đổi sang live projection | giữ read compatibility; không đưa UI trở lại |
| Roster | Reconciliation | Read-only API | Có page | không có | Chưa có ở AS | count/hash/timeline | bắt buộc trước cutover |
| Roster | Month detail/page | Có | Có | không có | Chưa có ở AS | DTO/paging/mobile ledger | build after projection |

## 5. Dashboard và báo cáo

| Nhóm chức năng | Chức năng | Backend cũ | Frontend cũ | Apps Script hiện tại | Trạng thái | Thiếu gì | Hướng chuyển đổi |
|---|---|---|---|---|---|---|---|
| Dashboard | Tổng/active/draft/inactive | Có basic overview | Hiển thị 4 count | total/active gán cùng array; probation luôn 0 | Apps Script sai/mô phỏng | dynamic source + as-of date | calculate from repository/projection, no hard-code |
| Dashboard | Thử việc | candidate data có | page riêng; overview chưa metric | hard-code 0 | Có nhưng chưa nối overview | count by candidate status | summary query/cache |
| Dashboard | Tăng/giảm/net tháng | movement data có | chưa overview | không có | Chưa có | monthly aggregate | derive confirmed ledger |
| Dashboard | Theo phòng ban | catalog/current data có | chưa chart/stat | không có | Chưa có | aggregation and privacy | server aggregate, no all-data browser |
| Dashboard | Danh sách mới/nghỉ | movement query có nhưng thiếu filter | chưa widget | không có | Chưa có | date/type filter API | operational ledger after query contract |
| Báo cáo | Biểu đồ biến động | không endpoint dedicated | không có | không có | Chưa có | BA metric/range | add only after metric definition |
| Báo cáo | Cảnh báo sắp hết thử việc | candidate filter/sort by end | page có sort/filter | không có | Có nhưng chưa hoàn chỉnh | explicit alert query/notification | query + threshold config |
| Báo cáo | Hết hạn hợp đồng chính thức | không domain history | không có | không có | Chưa có | contract model | defer until contract rules/data exist |

## 6. Thử việc, template và tài liệu

| Nhóm chức năng | Chức năng | Backend cũ | Frontend cũ | Apps Script hiện tại | Trạng thái | Thiếu gì | Hướng chuyển đổi |
|---|---|---|---|---|---|---|---|
| Probation | Candidate list/detail/create/update | Có | dedicated routes + filters | không persist candidate; một form | Legacy core đã có; AS chưa có | UUID/state/audit | migrate candidate domain before document UI |
| Probation | Start/pass/fail/convert | Có nhưng state guards cần BA review | Có actions | không có | Có nhưng chưa hoàn chỉnh | strict transition matrix/tests | approve state machine then port |
| Probation | Cancel candidate | enum/schema only | không action | không có | Chỉ có schema | command/reason/audit | design if business needs |
| Job preset | Editable job template | 9 presets + CRUD | tab/form | không có registry | Legacy đã có | server-side preset application/version | migrate 9 exact presets; no invented 10th |
| Template | DOCX layout | một classpath file, SHA at generation | không manage file | one Google Docs ID entered each form | Cần thiết kế lại | version/file/status/placeholder schema | separate `DOCUMENT_TEMPLATES` registry |
| Template | Placeholder mapping | exact 22 | form fields | map 22 hard-code; UI adds nonexistent `DEPARTMENT_NAME` | Có nhưng chưa hoàn chỉnh | schema version, leftover validation | canonical placeholder schema per version |
| Document | Preview | không có | không có | không có | Chưa có | secure preview | generated staging preview + expiry or rendered summary |
| Document | DOCX output/download | Có BLOB/download | latest download | không export DOCX | Legacy có; AS chưa có | Drive export + history | Docs API/Drive export DOCX, checksum |
| Document | PDF output | Không | Không | Có PDF | Apps Script có nhưng không an toàn | private permission/history | Drive export PDF, restricted file |
| Document | Google Docs/Drive | Không | Không | Có nhưng public and user-supplied IDs | Cần thiết kế lại P0 | managed folder/template, cleanup | server config only; inherited private permission |
| Document | Generation history | DB rows mỗi lần; UI chỉ latest | Không list all | không có | Có nhưng chưa hoàn chỉnh | list/version/reissue/void | `GENERATED_DOCUMENTS`, supersedes link |
| Document | Template versioning | filename + SHA snapshot only | không UI | không có | Chưa có | version/status/effective dates | Drive revision + exported SHA + immutable version |
| Document | Void/revoke | enum `VOIDED`, không API | không UI | không có | Chỉ có schema | command/reason/audit | implement only with business rule |
| Document | Download/view audit | Không | Không | Không | Chưa có | access event | audit sensitive document access |
| Contract | Hợp đồng lao động chính thức | current label/number only | current field only | không có | Chưa có domain | lifecycle/history/file | new phase after BA/data source confirmation |
| Document | Quyết định điều chuyển/nâng lương/nghỉ | không có | không có | không có | Chưa có | template/business flow | backlog; do not invent |

## 7. Import, export, migration và rollback

| Nhóm chức năng | Chức năng | Backend cũ | Frontend cũ | Apps Script hiện tại | Trạng thái | Thiếu gì | Hướng chuyển đổi |
|---|---|---|---|---|---|---|---|
| Import | Baseline preview/validate/confirm | Có, checksum/dataset locked | UI đầy đủ | README chuyển Excel thủ công | Legacy đã có; AS chưa có | generic schema/version/staging | reuse safety ideas, not locked parser as-is |
| Import | Rollback baseline | Guarded transaction | advanced UI | không có | Legacy có phạm vi hẹp | downstream/delta round-trip | new migration rollback protocol |
| Import | Generic employee import | Không | Không | Không | Chưa có | mapping/preview/idempotency | build canonical migration pipeline first |
| Import | Tăng/Giảm workbook bất kỳ | Không | Không | Không | Chưa có | contract/rules | defer until controlled generic import |
| Export | Excel tháng/năm | Có | Có | link export toàn workbook, nhãn tháng giả | Legacy đã có; AS sai scope | exact template/history/audit | port projection export and record generated report |
| Export | Lossless system export | Không | Không | Không | Chưa có | all entities + manifest/checksum | canonical JSONL/CSV export package |
| Migration | Legacy ID mapping | Không | Không | Không | Chưa có | `ID_MAPPINGS` | required before shadow import |
| Migration | Idempotent rerun | Locked importer only | preview supports | không có | Cần thiết kế lại | source hash/run journal | upsert by legacy ID + hash |
| Migration | Parallel reconciliation | roster/import partial | pages partial | không có | Có nhưng chưa hoàn chỉnh | cross-system report | daily/weekly count/hash/FK/headcount |
| Migration | Export ngược/rollback | Không generic | Không | Không | Chưa có | delta watermark/backend importer | build and rehearse before cutover |

## 8. Governance, vận hành và chất lượng

| Nhóm chức năng | Chức năng | Backend cũ | Frontend cũ | Apps Script hiện tại | Trạng thái | Thiếu gì | Hướng chuyển đổi |
|---|---|---|---|---|---|---|---|
| Audit UI | Danh sách audit | page API | direct route + page | không có | Có nhưng chưa hoàn chỉnh | filters/search/export/nav | indexed audit query + permission |
| Data quality | Import issue/reconciliation | Có một phần | import/reconciliation UI | không có | Có nhưng chưa hoàn chỉnh | persistent issue lifecycle | `DATA_QUALITY_ISSUES` + owner/resolution |
| Backup | DB backup/restore | Có infra | N/A | không có app-level backup | Cần thiết kế lại | Sheets/Drive manifest/restore drill | versioned export + permission/file inventory |
| Retention | Import raw payload | V2 purge | UI không cần | không có | Chỉ có backend | policy cho all PII/docs/audit | retention matrix + audited purge |
| Observability | Logs/metrics | Spring logs/tests; HR metrics hạn chế | toast/errors | Logger/ad-hoc | Cần thiết kế lại | request ID, execution/quota dashboard | structured sanitized log + operation journal |
| Performance | Batch/page | DB page/index; some N+1 probation | stale guards | batch read nhưng all-data client | Có nhưng chưa hoàn chỉnh | load/lock/quota tests | bounded page, batch I/O, cache catalogs/summary |
| Test | Backend automated | nhiều HR tests, nhưng probation/DOCX thiếu | không test suite; manual screenshots | không tests | Có nhưng chưa hoàn chỉnh | unit/contract/integration/visual | test pyramid + fixtures + rollback rehearsal |
| UX state | Loading/error/empty/retry | error contract partial | primitives nhưng inconsistent | text/alert, no failure handler | Cần thiết kế lại | consistent state system | shared components, no false-empty flash |
| UX safety | Long form/draft protection | rowVersion | dedicated candidate/template route | single long contract form | Có nhưng chưa hoàn chỉnh | dirty guard/sticky action | dedicated route; mobile accordion; bottom nav hidden |
| Accessibility | Keyboard/focus/ARIA | N/A | partial | emoji/buttons/no dialog focus | Có nhưng chưa hoàn chỉnh | focus trap/return, touch target | WCAG-oriented component QA |
| Visual fidelity | 10 accepted concepts | N/A | partial application | only palette/skin resemblance | Apps Script đang làm dở | full shell/page/state/responsive fidelity | F0-F6 ledger + browser screenshots + `view_image` |

## 9. Chức năng chỉ có backend hoặc chưa được frontend dùng

- Roster create/open/close/reopen/delete: backend và API client còn, UI active đã chuyển sang live projection. **Không nên chuyển nguyên trạng**.
- Import retention scheduler/schema and internal metadata: backend-only operational behavior.
- Enum/status dự phòng như transfer/position/working-condition, roster `EXPORTED`, candidate `CANCELLED`, contract `VOIDED`: chỉ có schema/enum, không phải feature hoàn chỉnh.
- Full generated DOCX rows tồn tại trong DB nhưng frontend chỉ lấy latest contract; history chưa expose.

## 10. Chức năng chỉ có trong Apps Script prototype

- Tạo Google Doc/PDF trong Drive: có code, nhưng thiếu permission/history/version và hiện đặt public link.
- UI nhập Template ID/Folder ID trong form: là configuration leak/confused-deputy risk, không phải business feature cần giữ.
- Link export toàn Google Sheet: không tương đương báo cáo tháng/năm backend.

## 11. Quyết định không chuyển

- Không chuyển row-number ID, guessed column mapping, fake default values.
- Không chuyển `ANYONE_WITH_LINK`.
- Không chuyển client-side all-PII dataset.
- Không chuyển manual roster lifecycle lên UI nếu business source vẫn dùng projection sống.
- Không chuyển README claim “100%” thành acceptance evidence.
- Không chuyển Booking/Auth legacy vào Apps Script trừ phần identity/permission cần cho HR.

## 12. Gate đóng Feature Matrix

Matrix chỉ được coi là khóa khi:

1. runtime reconciliation 336/339 hoàn tất;
2. TCHC xác nhận các hàng `CHƯA CÓ/CHƯA XÁC ĐỊNH` nào thật sự cần;
3. permission matrix và PII scope được ký;
4. state machine candidate/contract/movement còn mơ hồ được chốt;
5. quyết định pure Apps Script hay hybrid được đưa ra sau identity/PWA/concurrency spike.
