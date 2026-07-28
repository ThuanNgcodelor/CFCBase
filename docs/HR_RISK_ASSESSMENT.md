# Đánh giá rủi ro HR Google Apps Script

Ngày lập: **2026-07-28**

Trạng thái: **Baseline risk assessment — chưa phê duyệt go-live**

Phạm vi: Google Apps Script, Google Sheets, Google Drive/Docs và HTMLService cho phân hệ HR khoảng 336 nhân sự.

## 1. Kết luận điều hành

**Kết luận hiện tại: NO-GO cho dữ liệu thật và cutover.**

Lý do không phải vì 336 nhân sự vượt khả năng Google Sheets. Quy mô này phù hợp cho pilot nếu thiết kế đúng. Các điểm chặn là:

- Web app hiện chạy bằng quyền người deploy và mở cho mọi tài khoản Google đăng nhập, nhưng không có authorization phía server.
- Danh tính người truy cập chưa được chứng minh đáng tin cậy trong deployment mode hiện tại.
- Google Doc/PDF chứa dữ liệu HR bị chia sẻ `ANYONE_WITH_LINK`.
- Workbook chứa dữ liệu nhạy cảm đang nằm trong source directory và chưa được Git ignore.
- Mapping cột nhân sự đang sai; movement UI không chạy.
- Không có LockService, idempotency, audit nghiệp vụ, migration mapping hoặc rollback.

Chỉ được chuyển sang GO sau khi đóng toàn bộ P0, identity gate pass với người dùng thật, migration/reconciliation pass và quota/load test chứng minh workload nằm trong ngưỡng vận hành đã phê duyệt.

## 2. Cách đọc giới hạn và ngưỡng

Tài liệu này phân biệt hai loại giá trị:

### 2.1. Hard limit/quota chính thức

- Do Google công bố.
- Có thể khác giữa tài khoản consumer và Google Workspace.
- Nhiều quota tính theo người dùng và reset theo cửa sổ Google quy định.
- Google ghi rõ quota có thể thay đổi bất kỳ lúc nào; cần kiểm tra lại trước production release.

### 2.2. Ngưỡng vận hành đề xuất

- Là guardrail nội bộ của dự án, **không phải giới hạn Google**.
- Cố ý thấp hơn hard limit để còn headroom cho retry, peak load và công việc vận hành.
- Phải được hiệu chỉnh bằng telemetry staging/production.

Không được dùng “chưa chạm 10 triệu ô” làm bằng chứng hệ thống đang khỏe. Latency, formula, file size, số sheet, audit growth, service calls và concurrent writes có thể gây vấn đề sớm hơn nhiều.

## 3. Baseline đã xác nhận trong source

| Phát hiện | Mức | Bằng chứng |
|---|---|---|
| `USER_DEPLOYING` + `ANYONE` | P0 | `QuanLyNhanSu_AppScripts/appsscript.json:6-9` |
| Không có PermissionService/server role check | P0 | `Code.js:18-46` và toàn bộ `QuanLyNhanSu_AppScripts/*.js` |
| Doc/PDF đặt `ANYONE_WITH_LINK` | P0 | `ContractService.js:72-78` |
| Spreadsheet ID hard-code | P1 | `Code.js:6-7` |
| Trả toàn bộ employee DTO về browser | P1 | `EmployeeService.js:33-96`; `Index.html:424-433` |
| Sai mapping status/CCCD/địa chỉ | P0 | `EmployeeService.js:67-89` so với `Quan_Ly_Nhan_Su.xlsx`, sheet `T6-26`, row 4 |
| Dùng số dòng làm employee ID | P1 | `EmployeeService.js:67-70` |
| Movement form gọi hàm không tồn tại | P1 | `Index.html:333`; không có `handleLogChange` trong source |
| `getChangeLogs(month, year)` bỏ qua filter | P1 | `ChangeLogService.js:36-59` |
| Không LockService/idempotency | P1 | Toàn bộ `QuanLyNhanSu_AppScripts/*.js` |
| Không audit log nghiệp vụ | P1 | `Changes_Log` chỉ lưu movement tại `ChangeLogService.js:6-34` |
| UI ghép Sheet data vào `innerHTML`/inline handler | P1 | `Index.html:443-485` |
| Không `withFailureHandler` | P2 | `Index.html:424-433,558-576` |
| Full-range read và client filtering | P2 | `EmployeeService.js:39`; `Index.html:488-500` |
| File HR raw và `.clasp.json` đang untracked | P0 | `git status --short --untracked-files=all -- QuanLyNhanSu_AppScripts`, 2026-07-28 |

Không có bằng chứng checkout local giống hệt deployment đang phục vụ người dùng. Trước mọi quyết định production cần `clasp`/deployment inventory read-only được phê duyệt; không tự push hoặc pull đè source.

## 4. Hard limit và hành vi chính thức hiện hành

Kiểm tra ngày 2026-07-28. Các giá trị dưới đây phải được refresh trước go-live vì Google có thể thay đổi quota.

| Khu vực | Hard limit/hành vi chính thức | Ý nghĩa với HR | Nguồn chính thức |
|---|---|---|---|
| Execution runtime | 6 phút mỗi execution cho consumer và Workspace | Import, report và bulk document không được chạy như một job dài không chia đoạn | [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) |
| Concurrent execution | 30 execution/người dùng; 1.000 execution/script | Đây không phải cam kết throughput; Sheet/Drive contention có thể xảy ra trước | [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) |
| Documents created/day | 250/ngày consumer; 1.500/ngày Workspace | Bulk tạo hợp đồng có thể chạm quota trong một ngày | [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) |
| Files converted/day | 2.000/ngày consumer; 4.000/ngày Workspace | PDF/DOCX/export pipeline cần đo quota thực tế theo account | [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) |
| Properties | 9 KB/value; 500 KB/property store | Không lưu dataset, template body hoặc audit trong Script Properties | [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) |
| Cache | Key tối đa 250 ký tự; value 100 KB; tối đa 1.000 item; expiry tối đa 21.600 giây và chỉ là gợi ý | Cache có thể evict sớm; không được làm source of truth | [Cache class](https://developers.google.com/apps-script/reference/cache/cache) |
| `google.script.run` | Tối đa 10 server calls đồng thời từ client; call bất đồng bộ và có thể không chạy theo thứ tự mong đợi | UI phải deduplicate, sequence và có failure handler | [HTML communication](https://developers.google.com/apps-script/guides/html/communication) |
| Google Sheets | Tối đa 10 triệu ô hoặc 18.278 cột cho Sheet tạo/chuyển đổi | Đây là storage ceiling, không phải performance target | [Google Drive file limits](https://support.google.com/drive/answer/37603) |
| Excel conversion | Cell trên 50.000 ký tự bị loại khi chuyển Excel sang Google Sheets | Migration phải có preflight length và discrepancy report | [Google Drive file limits](https://support.google.com/drive/answer/37603) |
| Web app access | `ANYONE` là mọi người dùng Google đã đăng nhập; `ANYONE_ANONYMOUS` gồm cả anonymous | `ANYONE` không tương đương “nhân viên được phân quyền” | [Web app manifest](https://developers.google.com/apps-script/manifest/web-app-api-executable) |
| Execution identity | Web app có thể chạy bằng người deploy hoặc người truy cập | Quyền truy cập Drive/Sheet và khả năng nhận diện actor phụ thuộc lựa chọn này | [Web apps](https://developers.google.com/apps-script/guides/web) |
| Active user email | Có thể trả chuỗi rỗng nếu policy/context không cho phép, đặc biệt web app execute-as-owner | Identity gate là bắt buộc | [Session](https://developers.google.com/apps-script/reference/base/session) |
| Lock | Script/document/user lock chỉ ngăn concurrent access tới đoạn code | Lock không tạo transaction/rollback cho Sheet + Drive | [Lock Service](https://developers.google.com/apps-script/reference/lock) |
| HTMLService | Chỉ còn IFRAME sandbox; active content phải HTTPS; top navigation bị giới hạn | Không cam kết PWA/offline và phải test navigation/download | [HTMLService restrictions](https://developers.google.com/apps-script/guides/html/restrictions) |

Google cũng khuyến nghị giảm service calls, batch read/write và dùng cache cho dữ liệu tốn chi phí đọc: [Apps Script best practices](https://developers.google.com/apps-script/guides/support/best-practices).

## 5. Capacity assessment cho 336 nhân sự

### 5.1. Hiện trạng workbook

- Sheet `T6-26` có 336 dòng nhân sự thực ở row 5–340 và 34 cột dữ liệu.
- Phần dữ liệu tương đương khoảng `336 × 34 = 11.424` ô, rất nhỏ so với hard limit 10 triệu ô.
- Tuy nhiên workbook có format kéo tới row 1000; `getDataRange()` hiện đọc khoảng 34.000 ô. Đây chưa nguy hiểm nhưng cho thấy storage ceiling không phản ánh read cost.
- 336 employee codes hiện là duy nhất trong snapshot đã audit; uniqueness này chưa được enforce bởi repository/schema.

### 5.2. Sizing scenario — không phải số liệu nghiệp vụ đã xác nhận

Bảng sau chỉ dùng để lập tải; chủ nghiệp vụ phải thay bằng dữ liệu đo thật.

| Scenario | Movement/người/năm | Document/người/năm | Audit event/người/năm | Tổng/năm với 336 người |
|---|---:|---:|---:|---:|
| Nhẹ | 0,5 | 1 | 10 | 168 movement; 336 document; 3.360 audit |
| Kế hoạch cơ sở | 1 | 2 | 20 | 336 movement; 672 document; 6.720 audit |
| Stress | 4 | 5 | 100 | 1.344 movement; 1.680 document; 33.600 audit |

Nếu giữ stress scenario trong 5 năm và giả định 20 cột cho movement/document, 16 cột cho audit:

```text
EMPLOYEES:             336 × 60                   ≈    20.160 ô
MOVEMENTS:           1.344 × 5 × 20              ≈   134.400 ô
GENERATED_DOCUMENTS: 1.680 × 5 × 20              ≈   168.000 ô
AUDIT_LOGS:         33.600 × 5 × 16              ≈ 2.688.000 ô
```

Tổng vẫn dưới 10 triệu ô, nhưng audit đã chi phối dung lượng và có thể làm list/report chậm. Vì vậy cần partition/archive và không đọc full range.

### 5.3. Document burst

- Sinh 336 tài liệu trong một ngày đã vượt quota document/ngày của tài khoản consumer 250, nhưng nằm dưới mức Workspace 1.500.
- Sinh 1.680 tài liệu trong một ngày vượt cả mức Workspace 1.500.
- Số tài liệu/năm không trực tiếp quyết định quota/ngày; rủi ro nằm ở bulk migration, re-export hoặc đợt ký tập trung.
- Cần xác nhận loại tài khoản sở hữu deployment và đo chính xác một lần generate dùng những quota nào trong staging.

### 5.4. Kết luận capacity

**336 nhân sự phù hợp cho Apps Script pilot** nếu:

- Người dùng đồng thời thấp và write được serialize có kiểm soát.
- List API paged và chỉ trả field cần thiết.
- Audit/report được partition/cache.
- Tạo tài liệu được queue/chunk theo quota.
- Identity và Drive permission pass.

Không nên dùng pure Apps Script nếu workload cần transaction mạnh, bulk document cao, cross-domain identity phức tạp, near-real-time integration hoặc nhiều writer đồng thời.

## 6. Ngưỡng vận hành đề xuất

Các giá trị này là **đề xuất nội bộ**, không phải hard limit Google.

| Metric | Mục tiêu bình thường | Cảnh báo | Hành động/hybrid review |
|---|---:|---:|---:|
| Execution duration RPC thường | p95 < 3 giây | p95 ≥ 5 giây | p95 ≥ 10 giây trong 3 ngày |
| Write RPC | < 10 giây | ≥ 20 giây | ≥ 30 giây hoặc timeout lặp lại |
| Batch/import execution | < 60 giây/chunk | ≥ 180 giây | Chia continuation trước 240 giây; không tiến sát hard limit 360 giây |
| List page | 50 record mặc định; tối đa 100 | Payload > 500 KB | Thiết kế projection/index lại |
| Cache value | ≤ 80 KB | > 80 KB | Không ghi nếu có nguy cơ vượt hard limit 100 KB |
| Cache TTL | 5–15 phút catalog/summary | > 1 giờ | Chỉ dùng khi có invalidation/version rõ ràng |
| Lock wait | `tryLock` ≤ 5 giây | Busy rate > 2% | Busy rate > 5% hoặc writer > 5 đồng thời |
| Workbook cells | < 1 triệu | 1–2 triệu | ≥ 2 triệu: partition/archive/hybrid review |
| Transactional sheet rows | < 25.000/sheet | 25.000–50.000 | ≥ 50.000: partition hoặc DB review |
| Quota use theo tenant | < 50% quota ngày | 50–70% | ≥ 70%: throttle/queue; ≥ 85%: dừng batch không thiết yếu |
| Reconciliation mismatch | 0 critical; < 0,1% noncritical có ticket | Bất kỳ critical | NO-GO cutover |
| Permission-denied anomaly | Baseline + owner-reviewed | Tăng bất thường | Tạm khóa operation nhạy cảm |

Ngưỡng phải được lưu trong runbook/monitoring và hiệu chỉnh sau UAT; không hard-code vào UI.

## 7. Risk register

### 7.1. P0 — Stop-ship

| ID | Rủi ro và bằng chứng | Hậu quả | Biện pháp bắt buộc | Verification/exit |
|---|---|---|---|---|
| R-P0-01 | `USER_DEPLOYING` + `ANYONE`, không server authz (`appsscript.json:6-9`, `Code.js:18-46`) | Người không được phép có thể dùng quyền chủ deployment để đọc/tạo file | Identity spike; DOMAIN/USER_ACCESSING nếu khả thi; PermissionGuard mọi RPC; hybrid nếu identity fail | Role matrix tests với target/outside-domain accounts pass 100% |
| R-P0-02 | `Session.getActiveUser()` chưa được kiểm chứng và có thể rỗng theo Google | Không biết actor thật; audit/authorization giả | Deployment identity gate; không fallback sang client identity/temp key | Không user mục tiêu nào có identity rỗng; outside-domain bị từ chối |
| R-P0-03 | Doc/PDF bị `ANYONE_WITH_LINK` (`ContractService.js:72-78`) | Rò rỉ hợp đồng/CCCD/lương | Gỡ public sharing trong design; folder/file restricted; download authz server | Automated Drive permission test không tìm public file |
| R-P0-04 | Workbook HR thật và `.clasp.json` untracked trong source tree | Git/clasp push nhầm dữ liệu hoặc config | Di chuyển/ignore theo quy trình được phê duyệt; scan repo/dist; không in ID/PII | `git status`, secret/PII scan và `clasp status` không liệt kê raw data |
| R-P0-05 | Sai mapping `status`, CCCD, địa chỉ (`EmployeeService.js:67-89`) | Hiển thị/sinh tài liệu sai; migration làm bẩn dữ liệu | Schema registry theo header; mapping test từ fixture; reconciliation 336 record | 100% required-field mapping pass; zero critical mismatch |

### 7.2. P1 — Phải đóng trước production

| ID | Rủi ro và bằng chứng | Hậu quả | Mitigation | Exit criterion |
|---|---|---|---|---|
| R-P1-01 | Không lock/idempotency/journal | Duplicate/collision/partial write | Script lock, version re-read, idempotency key, operation journal, reconciler | Concurrent test không duplicate; retry cùng key trả cùng result |
| R-P1-02 | Row number làm ID | Insert/sort phá reference | UUID + legacy mapping + row index cache tái tạo được | Insert/reorder test không đổi entity ID |
| R-P1-03 | Không audit nghiệp vụ | Không truy vết ai sửa gì | AuditService tách movement; actor/action/before-after hash/result/request ID | CRUD/movement/document đều có audit tương ứng |
| R-P1-04 | Full DTO nhạy cảm về browser; DOM `innerHTML` | Lộ dữ liệu/XSS | DTO theo quyền; React escaping; không inline handler; CSP khả thi | Security test và payload inspection pass |
| R-P1-05 | Contract map/default hard-code; không history; public ID nhập từ client | Hợp đồng sai, file mồ côi, template abuse | Template registry/version, placeholder preflight; operation `PENDING/APPLIED/FAILED`; document lifecycle canonical; folder allowlist | Golden template tests; orphan reconciliation; no arbitrary folder/template |
| R-P1-06 | Movement UI hỏng, filter bị bỏ qua | Báo cáo tăng/giảm sai hoặc không có | Implement use case từ ledger; server filter; tests theo tháng/quý/năm | Movement lifecycle và dashboard reconciliation pass |
| R-P1-07 | Không migration idempotency/mapping/rollback | Trùng/mất dữ liệu, không quay lại được | Staging, hash, `ID_MAPPINGS`, dry-run, rerun, rollback export | Hai lần import cùng input không tạo thêm record; restore drill pass |
| R-P1-08 | Bulk Docs/Drive có thể vượt quota/runtime | Job dừng giữa chừng | Queue/chunk, quota headroom, continuation, idempotent retry | Stress batch hoàn thành trong staging không vượt guardrail |
| R-P1-09 | OAuth scope và Drive ownership chưa chốt | Overprivilege hoặc user không tạo/đọc được file | Explicit least-privilege scopes; Shared Drive/domain policy test | Scope review và Drive permission matrix được owner duyệt |
| R-P1-10 | Không có backup/retention policy | Mất dữ liệu hoặc giữ dữ liệu sai quy định | Immutable export/checksum, Drive retention, owner/legal decision | Restore sample và retention sign-off |

### 7.3. P2 — Ổn định và vận hành

| ID | Rủi ro | Mitigation | Chỉ báo |
|---|---|---|---|
| R-P2-01 | Full-range read/client filtering tăng latency | Server projection/pagination, used-range discipline, cached index | p95 list, cells read/request |
| R-P2-02 | Cache stale/evict sớm | Cache-aside, version key, repository fallback, invalidation | Cache hit rate và stale-data test |
| R-P2-03 | Config hard-code/drift môi trường | Script Properties; separate dev/staging/prod project/data | Config validation fail-fast |
| R-P2-04 | HTML iframe giới hạn navigation/download, không phải PWA | Single-file React HTMLService, user-activated links, responsive web only | Browser/device smoke tests |
| R-P2-05 | Tailwind CDN/remote font dependency | Build CSS locally, pin dependencies, HTTPS assets | Dist dependency scan |
| R-P2-06 | Không failure handler/standard errors | RpcClient wrapper, request ID, timeout/retry policy | Client errors, stuck-loading count |
| R-P2-07 | Logging thiếu hoặc log PII | Structured Cloud Logging, redaction, Error Reporting | PII log scan, alert coverage |
| R-P2-08 | Script/project thuộc cá nhân, bus factor | Tổ chức quản lý ownership/collaboration; runbook và redeploy plan | Owner/collaborator review |
| R-P2-09 | Quota thay đổi theo Google/account | Refresh quota pre-release, measure remaining/headroom, throttle | Daily quota dashboard |
| R-P2-10 | Sheet time zone khác script time zone | Config validation và UTC/ISO storage | Date boundary tests |

### 7.4. P3 — Chất lượng và khả dụng

| ID | Rủi ro | Mitigation |
|---|---|---|
| R-P3-01 | UI chỉ lấy màu concept, thiếu structure/responsive behavior | React shell theo `docs/hr-design-concepts`, visual/e2e regression |
| R-P3-02 | Header ngang/table overflow trên mobile | Bottom navigation, ledger list, bottom-sheet filter, safe-area test |
| R-P3-03 | Modal/form thiếu focus, keyboard, unsaved guard | Accessibility test, focus trap, confirmation |
| R-P3-04 | Master data tự do gây duplicate spelling | Catalog ID + normalized label + controlled legacy preservation |
| R-P3-05 | Report copy/tháng hard-code | Server report period và as-of timestamp |

## 8. Security/permission test matrix tối thiểu

| Test | Kết quả bắt buộc |
|---|---|
| Anonymous/không đăng nhập | Không truy cập app/data |
| Logged-in ngoài domain | 403/Access denied trước repository |
| Trong domain nhưng không có `USERS` record | 403 |
| Employee role | Không nhận trường nhạy cảm ngoài policy |
| Department head | Chỉ scope phòng ban đã duyệt |
| HR role | Đúng CRUD/document/report permission |
| Admin | Có permission quản trị nhưng mọi thao tác vẫn audit |
| Client sửa role/employee ID/payload | Server bỏ qua/từ chối |
| Gọi RPC trực tiếp từ console | Cùng authorization như UI |
| Template/folder ID ngoài allowlist | Từ chối |
| File generated | Không `ANYONE_WITH_LINK`; chỉ principal/group được duyệt |

Không đạt bất kỳ test nào trong nhóm này là NO-GO.

## 9. Go/No-Go criteria

### 9.1. GO cho pilot nội bộ

- P0 đóng 100%.
- Identity gate pass trên toàn bộ nhóm role mục tiêu.
- Dùng dữ liệu fixture hoặc bản sao được kiểm soát; chưa chuyển source of truth.
- List/detail permission và document privacy tests pass.
- 336-record migration dry-run có report count/hash/mismatch.
- p95 và quota nằm dưới ngưỡng vận hành đề xuất.
- Backup và rollback export chạy được.

### 9.2. GO cho production/cutover

- Tất cả điều kiện pilot pass.
- P1 đóng hoặc có risk acceptance bằng văn bản, owner và ngày xử lý; không chấp nhận waive identity/data leak/data corruption.
- Chạy song song đủ thời gian do chủ nghiệp vụ duyệt, zero critical mismatch.
- Rerun migration không tạo duplicate.
- Concurrent-write, bulk-document và quota tests pass trên loại account production thực tế.
- Monitoring, alert, runbook, ownership và support path sẵn sàng.
- Backend cũ chỉ chuyển read-only sau backup/final reconcile; rollback drill pass.

### 9.3. NO-GO

Bất kỳ điều kiện nào sau đây:

- Active identity rỗng/không ổn định cho một nhóm người dùng mục tiêu.
- Vẫn `ANYONE` + owner execution mà không có identity/authz đáng tin cậy.
- Còn public-sharing tài liệu HR.
- Raw PII/ID/credential có thể vào Git hoặc `dist`.
- Có critical reconciliation mismatch.
- Import rerun tạo duplicate hoặc rollback chưa khôi phục được.
- Job thường xuyên tiến sát 6 phút hoặc quota vượt 70% trong tải bình thường.
- Concurrent writes gây duplicate/partial state.

## 10. Khi nào phải chọn hybrid

Chuyển sang backend/database + Apps Script document automation nếu có một hoặc nhiều tiêu chí:

- Không chứng minh được identity/row-level permission trong Apps Script deployment.
- Có user ngoài Google Workspace domain hoặc nhiều domain với policy khác nhau.
- Cần transaction nguyên tử giữa nhiều entity/file hoặc yêu cầu consistency mạnh.
- Nhiều hơn khoảng 5 writer đồng thời gây lock contention theo telemetry.
- Transactional sheet đạt 50.000 row hoặc workbook đạt 2 triệu ô và latency vượt guardrail.
- Execution thường > 240 giây sau khi đã batch/chunk.
- Document/import workload bình thường sử dụng ≥ 70% quota ngày.
- Audit retention/reporting khiến Sheet scan/partition không còn đáp ứng SLA.
- Cần API integration, event streaming, search phức tạp hoặc near-real-time synchronization.
- PWA/offline/push/background sync là yêu cầu bắt buộc.

Mô hình hybrid khuyến nghị:

```text
React frontend hoặc frontend hiện có
  → Spring Boot/authenticated API
  → MySQL system of record + audit/transaction
  → controlled document job
  → Apps Script/Google Docs/Drive adapter
```

Apps Script khi đó chỉ xử lý phần có lợi thế Workspace; không giữ identity hoặc transactional HR master.

## 11. Monitoring và operational controls

### 11.1. Metrics

- RPC count/error/p50/p95/max theo action.
- Permission denied theo action/role, không log PII.
- Lock wait/busy/timeout.
- Operation journal PENDING/FAILED/retry age.
- Sheet row/cell count theo module.
- Cache hit/miss/value size.
- Document created/converted/failure/orphan count.
- Migration count/hash/mismatch.
- Apps Script timeout/quota exceptions.

### 11.2. Alert

- Bất kỳ generated file public.
- Bất kỳ P0 security test regression.
- Operation PENDING quá runbook threshold.
- Critical reconciliation mismatch.
- Quota use ≥ 70% hoặc timeout tăng.
- Lock busy > 5% write requests.
- Error rate/p95 vượt guardrail ba cửa sổ liên tiếp.

### 11.3. Logging

Cloud Logging phù hợp production multi-user và Error Reporting có thể gom lỗi, nhưng không log email/PII trực tiếp. Google khuyến nghị dùng active user key thay vì thông tin nhận dạng trong log: [Apps Script logging](https://developers.google.com/apps-script/guides/logging).

Audit nghiệp vụ vẫn phải nằm ở kho audit có cấu trúc; Cloud Logging không thay thế audit trail.

## 12. Risk review cadence

- Review P0/P1 ở cuối mỗi implementation phase.
- Refresh quota/link tài liệu Google trước staging load test và trước production release.
- Review capacity hàng tháng trong pilot, sau đó theo quý nếu tải ổn định.
- Review ngay khi thêm service mới, scope mới, template bulk hoặc thay deployment mode.
- Re-run permission matrix khi domain/shared-drive policy thay đổi.

## 13. Tài liệu chính thức tham chiếu

- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
- [Apps Script best practices](https://developers.google.com/apps-script/guides/support/best-practices)
- [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Web app manifest](https://developers.google.com/apps-script/manifest/web-app-api-executable)
- [Session](https://developers.google.com/apps-script/reference/base/session)
- [Lock Service](https://developers.google.com/apps-script/reference/lock)
- [Cache](https://developers.google.com/apps-script/reference/cache/cache)
- [Properties Service](https://developers.google.com/apps-script/reference/properties/)
- [HTMLService restrictions](https://developers.google.com/apps-script/guides/html/restrictions)
- [HTMLService best practices](https://developers.google.com/apps-script/guides/html/best-practices)
- [HTML communication / google.script.run](https://developers.google.com/apps-script/guides/html/communication)
- [Authorization scopes](https://developers.google.com/apps-script/concepts/scopes)
- [Logging](https://developers.google.com/apps-script/guides/logging)
- [Google Sheets/Drive file limits](https://support.google.com/drive/answer/37603)
