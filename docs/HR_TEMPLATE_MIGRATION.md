# Kế hoạch migration mẫu hợp đồng thử việc sang Google Apps Script

**Ngày lập:** 2026-07-28

**Trạng thái:** Kế hoạch kiến trúc và migration; chưa triển khai

**Phạm vi:** Mẫu nghiệp vụ thử việc, mẫu tài liệu, quy trình render Google Docs, xuất DOCX/PDF, lưu lịch sử và phân quyền trên Google Drive

## 1. Mục tiêu và nguyên tắc

Mục tiêu là chuyển năng lực tạo hợp đồng thử việc hiện có từ Spring Boot/DOCX sang Google Apps Script mà không làm mất ý nghĩa nghiệp vụ, lịch sử hay khả năng đối soát. Thiết kế đích phải giải quyết bốn bài toán độc lập:

1. Quản lý **mẫu nghiệp vụ công việc thử việc**.
2. Quản lý **mẫu bố cục tài liệu có phiên bản**.
3. Render, xem trước và xuất **Google Docs + DOCX + PDF** một cách xác định.
4. Lưu lịch sử tài liệu đã sinh, trạng thái thay thế/hủy và dấu vết kiểm toán.

Các nguyên tắc bắt buộc:

- Không coi 9 mẫu công việc và file DOCX là cùng một loại “template”.
- Không lấy dữ liệu hợp đồng từ các ô tự do trên trình duyệt nếu đã có dữ liệu nguồn được duyệt.
- Mỗi lần sinh phải đóng băng phiên bản mẫu công việc, phiên bản mẫu tài liệu và payload đã render.
- Tài liệu đã sinh là bất biến; sửa nội dung phải tạo tài liệu mới và liên kết `supersedes`.
- Không chia sẻ tài liệu nhân sự bằng `ANYONE_WITH_LINK`.
- Không ghi CCCD, địa chỉ, ngày sinh hoặc nội dung hợp đồng vào log kỹ thuật.
- Không xóa nguồn Spring Boot/DOCX cũ trong giai đoạn migration; rollback phải luôn khả dụng.

## 2. Kết luận kiểm kê đã xác minh

### 2.1. Không phải “10 template”

Nguồn `docs/hrdocsthuviec/Mẫu Hợp đồng thử việc 2026.docx` có **10 bản ghi hợp đồng nguồn**, nhưng hai bản ghi dùng cùng một cấu hình nghiệp vụ QLCLSP. Vì vậy, dữ liệu tái sử dụng đúng là:

- **10 bản ghi hợp đồng nguồn**: bằng chứng nghiệp vụ, không dùng làm danh mục trực tiếp.
- **9 mẫu công việc thử việc duy nhất**: các preset được seeder hiện tại tạo.
- **1 bố cục tài liệu đang hoạt động**: `probation-contract-template.docx` với 22 placeholder.

Không tạo “mẫu công việc thứ 10” chỉ để khớp số bản ghi nguồn. Bản ghi trùng phải được giữ trong hồ sơ đối soát, không nhân đôi danh mục.

### 2.2. Danh mục 9 mẫu công việc hiện tại

Nguồn code: `HrProbationJobTemplateSeeder.DEFAULT_TEMPLATES`, `backend/src/main/java/com/booking/system/config/HrProbationJobTemplateSeeder.java:37-137`.

| Thứ tự | Mã ổn định hiện tại | Tên mẫu | Đơn vị gợi ý | Lương thử việc | Ghi chú lương hiện tại |
|---:|---|---|---|---:|---|
| 10 | `TV-VIDEO` | Sáng tạo nội dung Video | Chưa gắn | 7.000.000 | đồng/tháng và KPI |
| 20 | `TV-ONLINE-SALES` | Xây dựng kênh bán hàng Online | Phòng Kinh doanh | 7.000.000 | đồng/tháng và KPI |
| 30 | `TV-QLCLSP` | Nhân viên phòng QLCLSP | Phòng QLCLSP | 7.500.000 | đồng/tháng |
| 40 | `TV-KY-THUAT-CD` | Nhân viên kỹ thuật cơ điện | Phòng Kỹ thuật | 7.500.000 | đồng/tháng |
| 50 | `TV-KHO` | Nhân viên kho | Bộ phận kho | 7.500.000 | đồng/tháng |
| 60 | `TV-SALE` | Nhân viên sale | Phòng Kinh doanh | 8.000.000 | đồng/tháng |
| 70 | `TV-MARKETING` | Quản lý Marketing và bán hàng Online | Phòng Kinh doanh | 12.750.000 | đồng/tháng và KPI |
| 80 | `TV-TCHC-CDS` | Chuyển đổi số, hỗ trợ phòng TCHC | Tổ chức | 7.500.000 | đồng/tháng |
| 90 | `TV-XNK` | Nhân viên xuất nhập khẩu | Phòng XNK | 8.000.000 | đồng/tháng |

Tất cả preset hiện có `workingConditionName = null`. Quan hệ phòng ban/chức vụ được tìm theo alias; không tìm thấy thì seeder vẫn lưu `null` (`HrProbationJobTemplateSeeder.java:177-218`).

### 2.3. Các file nguồn cần đóng băng

| Vai trò | File | SHA-256 đã xác minh ngày 2026-07-28 |
|---|---|---|
| Nguồn nghiệp vụ gồm 10 hợp đồng | `docs/hrdocsthuviec/Mẫu Hợp đồng thử việc 2026.docx` | `bf124279e761b807ae5a55ce17ea1549b8a9d96367abd1ed05514e946f3e5f9e` |
| Bố cục render đang chạy | `backend/src/main/resources/hr/templates/probation-contract-template.docx` | `208425e6a6f5c56c012789fa54f62f72488c64f43cfb8c3933fd16afb7ccd3ee` |
| Bản sao lưu bố cục | `backend/src/main/resources/hr/templates/probation-contract-template.backup.docx` | `34e2b4209ec0596a2003dadbe4ee98e33a9565a157383282cfe08ee84eb16f03` |

Bản sao lưu không được Spring Boot tham chiếu. Cả bố cục đang chạy và bản sao lưu dùng cùng tên placeholder, nhưng nội dung/bố cục khác nhau; chúng không được xem là hai phiên bản hợp lệ cho đến khi được đăng ký và phê duyệt rõ ràng.

## 3. Hiện trạng Spring Boot

### 3.1. Call path tạo hợp đồng

```text
POST /api/v1/hr/probation/candidates/{candidateId}/contracts
  -> HrProbationController.generateContract(...)
  -> HrProbationService.generateContract(...)
     -> khóa bản ghi ứng viên
     -> kiểm tra trường bắt buộc
     -> cấp số hợp đồng
     -> đọc DOCX từ classpath và tính SHA-256
     -> tạo map 22 placeholder
     -> thay chuỗi trong word/document.xml
     -> lưu BLOB DOCX + snapshot + checksum vào hr_probation_contracts
     -> chuyển DRAFT thành CONTRACT_CREATED
     -> ghi HrAuditEvent

GET /api/v1/hr/probation/contracts/{contractId}/download
  -> tải BLOB DOCX đã lưu
```

Nguồn: `HrProbationController.java:105-129`; `HrProbationService.generateContract`, `HrProbationService.java:142-196`; `HrProbationService.fillDocxTemplate`, `HrProbationService.java:635-661`.

### 3.2. Metadata và lịch sử hiện có

Bảng/entity hợp đồng hiện lưu được các dữ liệu quan trọng sau:

- `candidate_id`, `contract_no`, `contract_year`.
- Tên file mẫu, SHA-256 mẫu.
- Tên file sinh, SHA-256 file sinh và BLOB DOCX.
- `status` gồm `GENERATED` hoặc `VOIDED`.
- `generated_at`, `generated_by`.
- Snapshot JSON của dữ liệu dùng để render.
- Ràng buộc duy nhất `(contract_no, contract_year)`.

Nguồn: `HrProbationContract.java:25-72`; migration `V3__add_hr_probation_candidates.sql:92-117`.

Kho dữ liệu có thể chứa nhiều hợp đồng theo ứng viên, nhưng API/repository hiện chỉ phục vụ bản mới nhất; chưa có API liệt kê lịch sử, thao tác void hoặc quan hệ supersede (`HrProbationContractRepository.java:12-26`, `HrProbationService.java:731-737`).

### 3.3. Khiếm khuyết cần sửa trước hoặc trong migration

| Mức | Khiếm khuyết hiện tại | Hệ quả | Yêu cầu ở hệ thống đích |
|---|---|---|---|
| Blocker | Bố cục có `{{BASE_SALARY_TEXT}} đồng/tháng{{SALARY_NOTE}}`, trong khi 9 preset đã lưu `SALARY_NOTE` là `đồng/tháng` hoặc `đồng/tháng và KPI` | Có thể sinh `7.000.000 đồng/tháng đồng/tháng và KPI` | Quy định một nơi duy nhất sở hữu đơn vị; migrate ghi chú thành suffix chuẩn và giữ raw value để đối soát |
| Blocker | Bố cục ghép `Nội quy của Công ty{{DEPARTMENT_RULE_NOTE}}` nhưng service không thêm delimiter | Có thể thành `Công tyChấp hành...` | Template version mới phải chứa khoảng trắng/dấu câu rõ ràng và có visual golden test |
| Cao | Seeder chỉ insert; nếu tìm thấy theo code **hoặc** name thì bỏ qua hoàn toàn | Không backfill quan hệ/field bị thiếu, không phát hành phiên bản mới | Import idempotent theo stable ID + version, có báo cáo khác biệt; không silently skip |
| Cao | Seeder có thể lưu department/position `null` nếu catalog chưa sẵn sàng | Quan hệ thiếu tồn tại vĩnh viễn qua các lần restart | Migration phải resolve alias, đưa bản ghi không resolve vào quarantine và yêu cầu duyệt |
| Cao | Client gửi lại salary/job/rule/type; backend chỉ lưu snapshot từ payload và không áp preset ở server | Có chọn preset nhưng hợp đồng vẫn có dữ liệu bị sửa tự do | Server Apps Script phải tải preset ACTIVE bằng ID/version và tự dựng snapshot; client chỉ gửi ID + trường ứng viên được phép |
| Cao | Số tự động dùng `count(year)+1`; chỉ khóa ứng viên hiện tại | Hai ứng viên tạo đồng thời có thể tranh cùng số, cuối cùng vỡ unique constraint | Dùng `LockService` cho sequence theo năm và một bảng sequence/ledger duy nhất |
| Vừa | Ngày ký mặc định dùng `LocalDate.now(ZoneOffset.UTC)` | Sau 00:00 ở Việt Nam có thể vẫn là ngày hôm trước theo UTC | Mọi ngày hệ thống dùng `Asia/Ho_Chi_Minh`; lưu cả instant UTC và business date |
| Vừa | Renderer chỉ thay chuỗi trong `word/document.xml` | Không xử lý header/footer; không kiểm tra biến sót/biến lạ | Renderer đích duyệt body, bảng, header/footer và fail-closed nếu manifest không khớp |
| Vừa | Chưa có preview, PDF, version registry hay lịch sử supersede | Khó duyệt trước khi phát hành và khó truy vết | Bổ sung workflow preview/generate/supersede/void và registry |
| Vừa | Không có test probation/template trong `backend/src/test` | Không có lưới an toàn hồi quy | Phải có fixture, contract test, permission test và UAT trước cutover |
| Vừa | `HrApiExceptionHandler` không gắn với `HrProbationController` | Lỗi validation/conflict có thể không theo chuẩn 4xx/409 của HR API | Apps Script trả error envelope có mã ổn định; UI không dựa vào raw exception |

Các nguồn chi tiết: `HrProbationJobTemplateSeeder.run`, `HrProbationJobTemplateSeeder.java:144-175`; `HrProbationService.copyCandidate`, `HrProbationService.java:451-493`; `HrProbationService.resolveContractNo`, `HrProbationService.java:573-589`; `HrProbationService.contractPlaceholders`, `HrProbationService.java:591-620`; `HrApiExceptionHandler.java:21-26`.

## 4. Hiện trạng Google Apps Script và khoảng cách an toàn

Prototype trong `QuanLyNhanSu_AppScripts/` chưa phải bản tương đương nghiệp vụ hoặc bản sẵn sàng production.

### 4.1. Những gì đang có

- `apiCreateProbationContract` chuyển toàn bộ payload, Template ID và Folder ID từ trình duyệt sang service (`Code.js:28-31`).
- Service copy một Google Docs, thay placeholder trong body và tạo PDF (`ContractService.js:17-84`).
- `appsscript.json` đặt timezone `Asia/Ho_Chi_Minh` (`appsscript.json:2`).
- UI cho nhập Template ID và Folder ID thủ công mỗi lần (`Index.html:213-226`).

### 4.2. Các blocker phải đóng trước khi dùng dữ liệu thật

| Blocker | Bằng chứng hiện tại | Thay đổi bắt buộc |
|---|---|---|
| Web App mở công khai | `executeAs: USER_DEPLOYING`, `access: ANYONE` tại `appsscript.json:6-9` | Chỉ tài khoản/domain được phê duyệt; kiểm tra session và role trong mọi hàm server |
| Cho phép nhúng mọi nơi | `ALLOWALL` tại `Code.js:10-15` | Dùng chính sách frame mặc định hoặc allowlist đã được phê duyệt |
| Identifier dữ liệu hard-code | Spreadsheet ID ở `Code.js:6-7` | Chuyển vào Script Properties; UI không được đọc giá trị này |
| Client chọn file nguồn/đích tùy ý | `Index.html:216-224`, `Index.html:555-570` | Client chỉ chọn template registry ID; server resolve Drive IDs và kiểm tra trạng thái/quyền |
| Tài liệu nhân sự bị public link | `ContractService.js:76-78` | Xóa tuyệt đối chia sẻ public; kế thừa ACL của thư mục private, kiểm tra lại ACL sau tạo |
| Chưa có authorization theo nghiệp vụ | Các API wrapper tại `Code.js:18-45` gọi service trực tiếp | `requirePermission()` ở đầu từng server command, không chỉ ẩn nút UI |
| Số hợp đồng dựa vào timestamp | `ContractService.js:29-35` | Sequence theo năm được khóa, unique ledger, retry có giới hạn |
| Tên file chứa họ tên và CCCD | `ContractService.js:34` | Tên file dùng document ID/contract number không chứa CCCD; tên người chỉ ở nội dung/metadata bảo vệ |
| Chỉ thay trong body | `ContractService.js:36-68` | Duyệt body, table, header, footer; đối chiếu manifest trước và sau render |
| Không xác minh kết quả | Không có kiểm tra placeholder còn sót ở `ContractService.js:65-70` | Nếu còn biến, thiếu biến hoặc có biến ngoài schema thì hủy transaction logic và đưa file tạm vào quarantine |
| Không có DOCX thật | Service chỉ tạo Google Doc và PDF tại `ContractService.js:72-84` | Export thêm MIME DOCX, tính hash cả DOCX/PDF, lưu cả ba Drive ID |
| Không có preview/history | Service trả hai URL rồi kết thúc | Lưu `GENERATED_DOCUMENTS`; preview có TTL/trạng thái riêng và không cấp số chính thức |
| Payload không đủ 22 nguồn | UI chỉ gửi một phần field tại `Index.html:538-553`; `department` không phải placeholder hợp lệ | Payload canonical do server dựng; bỏ nhãn `{{DEPARTMENT_NAME}}` vì manifest hiện không có key này |
| Default nghiệp vụ bị hard-code | `ContractService.js:46-62` | Default thuộc schema/preset version và phải được duyệt, không nằm rải rác trong code |
| Không rollback file dở dang | `ContractService.js:17-92` không có cleanup/record thất bại | Ghi operation ID, trạng thái `PROCESSING/FAILED`, quarantine/xóa bản tạm có kiểm soát |

## 5. Mô hình đích: tách hai loại template

### 5.1. `PROBATION_JOB_TEMPLATES` — mẫu nghiệp vụ công việc

Đây là danh mục thay thế đúng vai trò của `HrProbationJobTemplate`; không chứa Google Docs ID.

Các cột tối thiểu:

| Nhóm | Cột đề xuất |
|---|---|
| Định danh | `job_template_id` UUID bất biến, `code`, `name`, `version` |
| Tổ chức | `department_id`, `department_name_snapshot`, `position_id`, `position_name_snapshot`, `working_condition_id` |
| Nội dung hợp đồng | `probation_contract_type`, `job_description`, `base_salary_amount`, `currency`, `salary_note_suffix`, `department_rule_note` |
| Vòng đời | `template_status` (`DRAFT/ACTIVE/INACTIVE`), `effective_from`, `effective_until`, `replaces_version` |
| Thứ tự | `sort_order` |
| Nguồn | `legacy_id`, `legacy_code`, `legacy_raw_salary_note`, `source_file_sha256`, `source_record_refs` |
| Audit | `created_at/by`, `approved_at/by`, `updated_at/by`, `row_version`, `content_sha256` |

Quy tắc:

- `code` ổn định qua phiên bản; `(code, version)` là duy nhất.
- Bản `ACTIVE` đã được dùng để sinh tài liệu không sửa tại chỗ.
- Thay đổi lương/mô tả tạo version mới; lịch sử cũ tiếp tục trỏ đúng version cũ.
- Chỉ một version hiệu lực của một code tại một thời điểm.
- `base_salary_amount` là số; format hiển thị chỉ thực hiện ở renderer.
- `salary_note_suffix` không lặp đơn vị. Giá trị migration dự kiến: `đồng/tháng` → rỗng; `đồng/tháng và KPI` → ` và KPI`. Raw value cũ vẫn giữ ở cột nguồn để audit.

### 5.2. `DOCUMENT_TEMPLATES` — mẫu bố cục tài liệu

Đây là registry của file Google Docs, độc lập với chức danh, lương và mô tả công việc.

| Nhóm | Cột đề xuất |
|---|---|
| Định danh | `document_template_id` UUID, `template_code` (ví dụ `PROBATION_CONTRACT`), `version_code` |
| File | `drive_file_id`, `drive_revision_id`, `source_docx_sha256`, `google_doc_export_sha256` |
| Schema | `placeholder_schema_version`, `placeholder_manifest_json`, `required_placeholder_count` |
| Vòng đời | `template_status` (`DRAFT/IN_REVIEW/ACTIVE/RETIRED`), `effective_from`, `effective_until`, `replaces_template_id` |
| Phê duyệt | `approved_by`, `approved_at`, `approval_note` |
| Audit | `created_at/by`, `updated_at/by`, `content_sha256`, `row_version` |

Quy tắc:

- File `ACTIVE` là read-only đối với người dùng nghiệp vụ; chỉ tài khoản quản trị template được tạo version mới.
- Không cập nhật `drive_file_id` của một version đã active.
- Kích hoạt chỉ thành công khi placeholder manifest khớp chính xác schema được hỗ trợ và visual golden test đạt.
- Việc retire mẫu không làm mất khả năng tải tài liệu cũ.

### 5.3. Các kho bổ trợ

`DOCUMENT_PLACEHOLDER_SCHEMAS` lưu schema version và định nghĩa kiểu dữ liệu. Có thể lưu một JSON canonical kèm SHA-256, nhưng phải có công cụ validate; không để schema chỉ tồn tại trong UI.

`CONTRACT_NUMBER_SEQUENCES` lưu `year`, `last_number`, `updated_at/by`. Việc cấp số chạy trong `LockService.getScriptLock()` và ghi ledger trước khi phát hành tài liệu.

`GENERATED_DOCUMENTS` là sổ lịch sử: payload/artifact bất biến sau khi phát hành, còn lifecycle metadata chỉ được chuyển bằng command có audit.

| Nhóm | Cột đề xuất |
|---|---|
| Định danh | `generated_document_id` UUID, `operation_id` UUID, `document_type`, `candidate_id`, `contract_no`, `contract_year` |
| Snapshot | `job_template_id/version/hash`, `document_template_id/version/hash`, `placeholder_schema_version`, `render_payload_hash`, `secure_snapshot_ref` |
| File | `google_doc_file_id/hash`, `docx_file_id/hash`, `pdf_file_id/hash`, `private_folder_id` |
| Vòng đời | `generation_status` (`PROCESSING/PREVIEW/GENERATED/SUPERSEDED/VOIDED/FAILED`), `supersedes_document_id`, `superseded_by_id`, `void_reason` |
| Nguồn cũ | `legacy_contract_id`, `legacy_generated_sha256`, `migration_batch_id` |
| Audit | `generated_at/by`, `superseded_at/by`, `voided_at/by`, `error_code` |

`DOCUMENT_RENDER_EVENTS` ghi operation ID, loại sự kiện, document ID, actor, thời điểm, kết quả và mã lỗi đã làm sạch. Không ghi payload PII. Các sự kiện tối thiểu: `PREVIEW_CREATED`, `GENERATED`, `DOWNLOADED`, `SUPERSEDED`, `VOIDED`, `PERMISSION_DENIED`, `RENDER_FAILED`.

## 6. Chuẩn placeholder v1 và mapping canonical

### 6.1. Manifest chính xác của bố cục hiện tại

File active có đúng **22 placeholder**, mỗi placeholder xuất hiện một lần trong `word/document.xml`:

| # | Placeholder | Nguồn Spring hiện tại | Nguồn đích canonical | Kiểu/format | Bắt buộc | Nhạy cảm |
|---:|---|---|---|---|---|---|
| 1 | `{{CONTRACT_NO}}` | `resolvedContractNo` | sequence ledger hoặc số đã được duyệt | chuỗi, trim | Có | Không |
| 2 | `{{CONTRACT_YEAR}}` | `contractYear` | `contract.business_year` | `yyyy` | Có | Không |
| 3 | `{{SIGN_DAY}}` | `signDate.day` | `sign_date` tại `Asia/Ho_Chi_Minh` | `dd` | Có | Không |
| 4 | `{{SIGN_MONTH}}` | `signDate.month` | `sign_date` tại `Asia/Ho_Chi_Minh` | `MM` | Có | Không |
| 5 | `{{SIGN_YEAR}}` | `signDate.year` | `sign_date` tại `Asia/Ho_Chi_Minh` | `yyyy` | Có | Không |
| 6 | `{{CANDIDATE_TITLE}}` | `candidate.candidateTitle` | snapshot ứng viên đã duyệt | enum đã duyệt | Có | Có |
| 7 | `{{FULL_NAME}}` | `candidate.fullName` | snapshot ứng viên | Unicode, trim; uppercase theo policy | Có | Có |
| 8 | `{{NATIONALITY}}` | `candidate.nationality` | snapshot ứng viên; default có version | chuỗi | Có | Có |
| 9 | `{{DATE_OF_BIRTH}}` | `candidate.dateOfBirth` | snapshot ứng viên | `dd/MM/yyyy` | Có | Có |
| 10 | `{{BIRTH_PLACE}}` | `candidate.birthPlace` | snapshot ứng viên | chuỗi | Có | Có |
| 11 | `{{PERMANENT_ADDRESS}}` | `candidate.permanentAddress` | snapshot ứng viên | chuỗi đa dòng an toàn | Có | Có |
| 12 | `{{CITIZEN_ID}}` | `candidate.citizenId` | snapshot ứng viên | chuỗi, không ép số | Có | Có - cao |
| 13 | `{{CITIZEN_ID_ISSUED_DATE}}` | `candidate.citizenIdIssuedDate` | snapshot ứng viên | `dd/MM/yyyy` | Có | Có - cao |
| 14 | `{{CITIZEN_ID_ISSUED_PLACE}}` | `candidate.citizenIdIssuedPlace` | snapshot ứng viên | chuỗi | Có | Có - cao |
| 15 | `{{PROBATION_CONTRACT_TYPE}}` | `candidate.probationContractType` | snapshot của job preset/version | chuỗi danh mục | Có | Không |
| 16 | `{{PROBATION_START_DATE}}` | `candidate.probationStartDate` | snapshot ứng viên | `dd/MM/yyyy` | Có | Có |
| 17 | `{{PROBATION_END_DATE}}` | `candidate.probationEndDate` | snapshot ứng viên | `dd/MM/yyyy` | Có | Có |
| 18 | `{{POSITION_NAME}}` | candidate position; fallback tên preset | snapshot job preset/version | chuỗi | Có | Không |
| 19 | `{{JOB_DESCRIPTION}}` | `candidate.jobDescription` | snapshot job preset/version đã duyệt | chuỗi đa dòng | Có | Không |
| 20 | `{{BASE_SALARY_TEXT}}` | formatted `candidate.baseSalary` | `base_salary_amount` được format `vi-VN`, **không kèm đơn vị** | ví dụ `7.000.000` | Có | Có - tài chính |
| 21 | `{{SALARY_NOTE}}` | `candidate.salaryNote` | `salary_note_suffix` của preset/version | suffix chuẩn hoặc rỗng | Không | Có - tài chính |
| 22 | `{{DEPARTMENT_RULE_NOTE}}` | `candidate.departmentRuleNote` | snapshot job preset/version | câu hoàn chỉnh, không tự ghép delimiter | Có | Không |

Mapping Spring hiện tại nằm tại `HrProbationService.contractPlaceholders`, `backend/src/main/java/com/booking/system/hr/service/HrProbationService.java:591-620`.

### 6.2. Quy tắc schema

- Tên placeholder phân biệt hoa/thường và không được tự động alias.
- `{{DEPARTMENT_NAME}}` đang xuất hiện trên nhãn UI Apps Script nhưng **không thuộc** manifest 22 biến; không được lặng lẽ thêm vào v1.
- Mẫu có biến lạ, thiếu biến bắt buộc, biến bắt buộc lặp sai số lần hoặc render xong còn `{{...}}` phải bị từ chối.
- Schema quy định type, required, format, sensitivity và owner (`candidate`, `job_template`, `system`), không chỉ là danh sách tên.
- String phải chuẩn hóa Unicode NFC, giữ dấu tiếng Việt và escape đúng ngữ cảnh Google Docs; không dùng raw regex từ tên placeholder.
- Dòng lương của template version mới phải sở hữu literal `đồng/tháng`; `BASE_SALARY_TEXT` chỉ có số và `SALARY_NOTE` chỉ có suffix bổ sung.
- `DEPARTMENT_RULE_NOTE` phải đứng sau delimiter có trong template, tốt nhất là một câu/đoạn độc lập.

## 7. Cấu trúc Google Drive và registry phiên bản

### 7.1. Cây thư mục đề xuất

```text
HR_PRIVATE_ROOT/                         (không public link)
├── templates/
│   └── probation-contract/
│       ├── v001/
│       │   ├── source.docx
│       │   ├── template-google-doc
│       │   └── manifest.json
│       └── v002/
├── generated/
│   └── 2026/
│       └── <candidate-stable-id>/
│           └── <generated-document-id>/
│               ├── contract-google-doc
│               ├── contract.docx
│               └── contract.pdf
├── previews/                            (TTL ngắn, ACL private)
├── _archive/                            (version retired/history migrated)
└── _quarantine/                         (file dở dang hoặc migration lỗi)
```

Không đặt CCCD hoặc họ tên trong tên thư mục/file. Tên vật lý dùng `generated_document_id` và số hợp đồng đã làm sạch.

### 7.2. Quản lý identifier và quyền

- Root folder ID, registry spreadsheet ID và admin group được giữ trong Script Properties hoặc deployment configuration; không hard-code, không truyền từ browser.
- Sheet registry chỉ lưu ID, version và hash; không lưu URL chia sẻ công khai.
- Tài khoản chạy script chỉ có quyền tối thiểu trên `HR_PRIVATE_ROOT`.
- File sinh kế thừa ACL private của folder; sau tạo phải kiểm tra không có `ANYONE`/`ANYONE_WITH_LINK`.
- Nếu tổ chức dùng Shared Drive, dùng group nội bộ theo vai trò và vô hiệu hóa chia sẻ ngoài miền cho khu vực này.

## 8. Quy trình render đích

### 8.1. Tạo preview

1. UI gửi `candidate_id`, `job_template_id/version` và các override được phép; không gửi Drive ID.
2. Server xác thực danh tính, trạng thái tài khoản và quyền `HR_CONTRACT_PREVIEW`.
3. Server tải ứng viên và preset, kiểm tra preset `ACTIVE`, thời gian hiệu lực và optimistic version.
4. Server dựng snapshot canonical, validate đủ field và format theo schema.
5. Server tải `DOCUMENT_TEMPLATES` version `ACTIVE`, xác minh Drive file/revision/hash và manifest.
6. Tạo bản copy trong `previews/`, thay placeholder ở body, bảng, header và footer.
7. Quét lại toàn tài liệu; nếu còn/thiếu/ngoài manifest thì fail-closed.
8. Xuất PDF preview có watermark “BẢN XEM TRƯỚC - KHÔNG CÓ GIÁ TRỊ”, không cấp số chính thức.
9. Lưu event không chứa PII; đặt TTL và job dọn preview hết hạn.

### 8.2. Phát hành hợp đồng

1. UI gửi operation ID/idempotency key và xác nhận snapshot preview.
2. Server chạy lại toàn bộ authorization/validation, không tin kết quả từ client.
3. Lấy script lock; cấp số hợp đồng theo năm trong sequence ledger; bảo đảm idempotent theo operation ID.
4. Tạo trước record `GENERATED_DOCUMENTS` trạng thái `PROCESSING`.
5. Copy đúng Google Docs template version vào folder tài liệu private.
6. Render snapshot canonical; validate không còn placeholder và kiểm tra nội dung/hash.
7. Export Google Docs sang DOCX và PDF; chờ file ổn định, tính SHA-256 từng artifact.
8. Kiểm tra ACL của cả Google Doc, DOCX, PDF; không có link public.
9. Cập nhật record thành `GENERATED`, lưu đủ template/job/schema version, hashes và audit actor/time.
10. Trả về opaque document ID; API mở/tải phải authorization lại rồi mới trả URL ngắn hạn hoặc nội dung.

Nếu lỗi sau khi tạo file, record chuyển `FAILED`, các file dở dang vào `_quarantine`; không tái sử dụng số hợp đồng ngoài policy đã duyệt. Retry cùng idempotency key phải trả cùng kết quả hoặc tiếp tục operation cũ, không sinh hợp đồng thứ hai.

## 9. Vòng đời tài liệu và lịch sử

### 9.1. Không sửa tài liệu đã phát hành

- `GENERATED`: bản hiện hành, file read-only đối với người dùng thường.
- `SUPERSEDED`: đã được thay bằng tài liệu mới; giữ nguyên file, hash và audit.
- `VOIDED`: vô hiệu bằng lý do bắt buộc; không xóa vật lý.
- `FAILED`: operation không hoàn tất; file liên quan ở quarantine và không được dùng nghiệp vụ.

### 9.2. Supersede

Khi cần sửa hợp đồng:

1. Người có quyền chọn tài liệu hiện hành và nhập lý do.
2. Hệ thống tạo preview từ snapshot mới.
3. Khi phát hành, tạo `generated_document_id` mới.
4. Bản mới có `supersedes_document_id = old_id`; bản cũ có `superseded_by_id = new_id` và trạng thái `SUPERSEDED`.
5. Cả hai giữ nguyên job template version, document template version và payload hash riêng.

Không overwrite Google Doc/PDF/DOCX cũ và không đổi hash lịch sử.

## 10. Phân quyền đề xuất

| Quyền | HR operator | HR approver | Template admin | Auditor | System service |
|---|:---:|:---:|:---:|:---:|:---:|
| Xem danh mục preset active | Có | Có | Có | Chỉ đọc | Có |
| Tạo/sửa preset draft | Không | Không | Có | Không | Không |
| Phê duyệt/activate preset | Không | Có theo policy | Có theo policy | Không | Không |
| Tạo preview hợp đồng | Có | Có | Có | Không | Có |
| Phát hành hợp đồng | Theo phân công | Có | Không mặc định | Không | Có theo command hợp lệ |
| Xem/tải hợp đồng có PII | Theo hồ sơ được giao | Có | Không mặc định | Theo mandate | Có |
| Supersede/void | Không | Có, bắt buộc lý do | Không mặc định | Không | Có theo command hợp lệ |
| Quản lý document template | Không | Phê duyệt | Có | Chỉ đọc metadata | Có |
| Xem audit | Không | Có giới hạn | Có metadata | Có | Ghi sự kiện |

Kiểm soát phải nằm trong hàm server Apps Script. Ẩn tab/nút trên frontend không phải authorization. Mỗi lần preview, generate, open, download, supersede và void đều kiểm tra quyền lại theo actor hiện tại và phạm vi hồ sơ.

## 11. Kế hoạch migration theo giai đoạn

### Giai đoạn 0 — Chốt phạm vi và freeze bằng chứng

- Đóng băng ba file thử việc nêu tại mục 2.3; lưu SHA-256, kích thước, thời điểm và người kiểm kê.
- Xuất 9 preset Spring hiện tại cùng ID/code/field/audit; không suy đoán số lượng từ UI.
- Xuất metadata hợp đồng đã sinh: legacy ID, candidate ID, contract no/year, template hash, generated hash, status, actor/time và snapshot reference.
- Không xuất PII vào log hoặc tài liệu kế hoạch. File trao đổi migration phải nằm trong vùng private.
- Ghi số lượng runtime thực tế từ database trước cutover; các con số 329/336/339 thuộc các nguồn khác nhau, không được dùng thay cho truy vấn đối soát.

**Gate:** Có manifest nguồn được ký duyệt và không có file nào thiếu hash.

### Giai đoạn 1 — Dựng nền an toàn Apps Script

- Đóng web app `ANYONE`; cấu hình phạm vi domain/group được duyệt.
- Bỏ `ALLOWALL`, hard-coded IDs, input Template/Folder ID và mọi `ANYONE_WITH_LINK`.
- Tạo Script Properties, Shared Drive/private root, groups và permission middleware.
- Tạo các sheet registry có schema cố định, data validation và protected ranges.
- Tạo operation/audit/error envelope; log không chứa PII.

**Gate:** Permission test chứng minh người ngoài/không có role không thể gọi trực tiếp server function hoặc mở file.

### Giai đoạn 2 — Migrate 9 job preset

- Tạo stable UUID cho 9 code hiện tại; lưu `legacy_id` và source SHA.
- Resolve department/position alias; bản ghi không resolve đưa vào quarantine, không tự lưu `null` rồi bỏ qua.
- Chuẩn hóa salary note theo quy tắc không lặp đơn vị; giữ `legacy_raw_salary_note`.
- Tạo content hash và version 1; review chéo nghiệp vụ trước khi `ACTIVE`.
- Đối soát từng field với seeder và tài liệu nguồn; ghi rõ bản ghi nguồn trùng QLCLSP nhưng không tạo preset thứ 10.

**Gate:** 9/9 code duy nhất, không duplicate, không field bắt buộc null, tổng lương/mô tả/rule khớp báo cáo đối soát.

### Giai đoạn 3 — Chuyển bố cục và schema

- Import active DOCX vào Google Docs `DRAFT v001`; lưu source SHA và Drive revision.
- Đăng ký schema 22 placeholder chính xác ở mục 6.
- Tạo version sửa lỗi nội dung lương/delimiter; không sửa file active tại chỗ.
- Kiểm tra placeholder trong body, bảng, header/footer; loại bỏ split token/unknown token.
- Phê duyệt bằng legal/HR và visual golden test; chỉ sau đó chuyển `ACTIVE`.

**Gate:** Manifest khớp 22/22, không biến lạ, hash/revision ổn định, legal/HR ký duyệt version phát hành.

### Giai đoạn 4 — Renderer, preview và export

- Dựng canonical render context từ ứng viên + preset version + system date/sequence.
- Thực hiện preview watermark, render fail-closed, DOCX/PDF export và hash.
- Thêm idempotency, yearly sequence lock, `PROCESSING/FAILED` recovery và quarantine.
- Thêm generated-document history, supersede/void và audit download.
- Dùng dữ liệu tổng hợp, không dùng hồ sơ cá nhân thật trong CI/test.

**Gate:** Toàn bộ test mục 12 đạt; không file public; không còn placeholder sau render.

### Giai đoạn 5 — Migrate lịch sử

- Với từng `hr_probation_contracts` cũ, tạo record `GENERATED_DOCUMENTS` bằng `legacy_contract_id` duy nhất.
- Đưa BLOB DOCX cũ vào thư mục private; không render lại rồi giả làm bản gốc.
- Xác minh DOCX hash bằng `generated_sha256`; lưu template hash và snapshot reference cũ.
- Chỉ tạo PDF dẫn xuất nếu business yêu cầu; đánh dấu rõ `derived_from_legacy_docx`, tool/version và hash.
- Map `VOIDED` nếu có; không suy diễn supersede nếu nguồn cũ không có bằng chứng.
- Chạy lại migration phải idempotent và không tạo file/record trùng.

**Gate:** Số record nguồn = migrated + quarantined có lý do; 100% hash đối soát; lấy mẫu mở file đạt.

### Giai đoạn 6 — UAT, cutover và rollback window

- Chạy UAT bằng dữ liệu tổng hợp và một bộ hồ sơ đã được phép.
- Trong cửa sổ song song, chỉ một hệ thống được cấp số/phát hành; hệ còn lại read-only để tránh split-brain.
- Chốt mốc cutover, last legacy ID, last sequence/year và batch reconciliation.
- Theo dõi lỗi/permission/hash trong thời gian rollback window.
- Chỉ retire đường phát hành Spring sau khi chủ sản phẩm ký nghiệm thu; không xóa BLOB, bảng hay DOCX nguồn.

**Rollback:** Ngừng command phát hành Apps Script, đánh dấu các operation đang xử lý, đối soát số đã cấp, đưa Spring về writer duy nhất và tiếp tục sequence từ ledger đã chốt. Tài liệu Apps Script đã phát hành vẫn được giữ và map về legacy/import ledger; tuyệt đối không xóa để “làm sạch”.

## 12. Validation, kiểm thử và UAT

### 12.1. Schema/render tests

- [ ] Active template có chính xác 22 key được hỗ trợ; count từng key đúng manifest.
- [ ] Template thiếu key bắt buộc bị từ chối khi activate và khi render.
- [ ] Template có key lạ hoặc render xong còn `{{...}}` bị từ chối.
- [ ] Placeholder trong body, table, header và footer đều được xử lý.
- [ ] Họ tên/địa chỉ có dấu tiếng Việt, ký tự `&`, `<`, `>`, dấu nháy và xuống dòng không làm hỏng tài liệu.
- [ ] Ngày luôn render `dd/MM/yyyy` theo `Asia/Ho_Chi_Minh`.
- [ ] CCCD giữ số 0 đầu và không bị spreadsheet đổi sang scientific notation.
- [ ] `BASE_SALARY_TEXT` không chứa đơn vị; dòng cuối không lặp `đồng/tháng`.
- [ ] `DEPARTMENT_RULE_NOTE` có delimiter/dấu câu đúng, không nối từ.
- [ ] Google Doc, DOCX và PDF có hash, mở được và cùng nội dung nghiệp vụ.
- [ ] Visual diff đạt ở font, bảng, ngắt trang, header/footer và vùng ký.

### 12.2. Nghiệp vụ và concurrency

- [ ] 9 preset đúng code/field/version; bản ghi nguồn trùng không tạo preset dư.
- [ ] Client sửa payload preset trái phép không thay đổi snapshot server.
- [ ] Preset/template inactive, retired hoặc ngoài effective date bị server từ chối.
- [ ] Hai người phát hành đồng thời nhận hai số hợp đồng duy nhất, tăng đúng thứ tự.
- [ ] Retry cùng idempotency key không tạo file hoặc số thứ hai.
- [ ] Preview không chiếm số hợp đồng và luôn có watermark.
- [ ] Supersede tạo quan hệ hai chiều; file/hash cũ không đổi.
- [ ] Void bắt buộc lý do và vẫn giữ artifact.
- [ ] Lỗi giữa chừng tạo trạng thái `FAILED`, không để file công khai hoặc record giả `GENERATED`.

### 12.3. Security/privacy

- [ ] Người chưa đăng nhập và tài khoản ngoài phạm vi không thể mở Web App/API.
- [ ] Người không có role bị từ chối ngay cả khi gọi trực tiếp `google.script.run`.
- [ ] Operator không thể truyền tùy ý Template ID/Folder ID.
- [ ] Không file nào có `ANYONE` hoặc `ANYONE_WITH_LINK`.
- [ ] Open/download kiểm tra lại quyền và được audit.
- [ ] Log/error/telemetry không chứa họ tên, CCCD, địa chỉ, ngày sinh, mức lương hoặc payload hợp đồng.
- [ ] Tên file/thư mục không chứa CCCD.
- [ ] Script Properties, protected sheets và Shared Drive permissions tuân thủ least privilege.

### 12.4. Migration/reconciliation

- [ ] SHA-256 ba file nguồn khớp manifest mục 2.3.
- [ ] 9/9 job preset migrate thành công hoặc có quarantine record rõ ràng.
- [ ] Mỗi legacy contract có đúng một kết quả `migrated` hoặc `quarantined`.
- [ ] Hash DOCX lịch sử sau upload khớp hash backend.
- [ ] Tổng trạng thái/số hợp đồng theo năm khớp nguồn.
- [ ] Dry-run không ghi production registry hoặc phát hành tài liệu.
- [ ] Rollback rehearsal xác nhận chỉ một writer và sequence tiếp tục không trùng.

## 13. Tiêu chí hoàn thành

Migration mẫu hợp đồng chỉ được xem là hoàn thành khi đồng thời đạt:

1. 9 job preset và document template registry được tách độc lập, có version/audit.
2. Template active được phê duyệt, manifest đúng 22 placeholder và đã sửa lỗi lương/delimiter.
3. Preview, Google Doc, DOCX và PDF chạy qua cùng canonical payload, cùng version snapshot.
4. Tài liệu private, mọi command/download được authorization phía server.
5. Số hợp đồng không trùng khi concurrent và retry idempotent.
6. Generated history bất biến, có supersede/void và đối soát hash.
7. Lịch sử Spring được migrate hoặc quarantine đầy đủ, không mất BLOB/snapshot/hash.
8. Tất cả validation/UAT ở mục 12 đạt và có biên bản rollback rehearsal.

## 14. Nguồn kiểm chứng trong repository

| Chủ đề | File / symbol / dòng |
|---|---|
| 9 preset và dữ liệu seed | `backend/src/main/java/com/booking/system/config/HrProbationJobTemplateSeeder.java`, `DEFAULT_TEMPLATES`, dòng 37-137 |
| Cơ chế insert-only/skip | cùng file, `run`, dòng 144-175 |
| Resolve catalog alias/null | cùng file, `resolveDepartment`/`resolvePosition`, dòng 177-218 |
| Endpoint generate/download | `backend/src/main/java/com/booking/system/hr/api/HrProbationController.java`, dòng 105-129 |
| Call path và snapshot/BLOB/hash/audit | `backend/src/main/java/com/booking/system/hr/service/HrProbationService.java`, `generateContract`, dòng 142-196 |
| Client snapshot candidate | cùng file, `copyCandidate`, dòng 451-493 |
| Required fields | cùng file, `validateContractRequiredFields`, dòng 548-565 |
| Contract number race | cùng file, `resolveContractNo`, dòng 573-589 |
| Map 22 placeholder | cùng file, `contractPlaceholders`, dòng 591-620 |
| DOCX renderer giới hạn document.xml | cùng file, `fillDocxTemplate`, dòng 635-661 |
| Entity/lịch sử hợp đồng | `backend/src/main/java/com/booking/system/hr/entity/HrProbationContract.java`, dòng 25-72 |
| Schema DB | `backend/src/main/resources/db/migration/V3__add_hr_probation_candidates.sql`, dòng 92-117 |
| Repository chỉ lấy latest | `backend/src/main/java/com/booking/system/hr/repository/HrProbationContractRepository.java`, dòng 12-26 |
| Exception handler bỏ sót probation | `backend/src/main/java/com/booking/system/hr/api/HrApiExceptionHandler.java`, dòng 21-26 |
| Apps Script public deployment | `QuanLyNhanSu_AppScripts/appsscript.json`, dòng 6-9 |
| Apps Script frame/hard-coded data ID | `QuanLyNhanSu_AppScripts/Code.js`, dòng 6-15 |
| Client truyền Template/Folder ID | `QuanLyNhanSu_AppScripts/Index.html`, dòng 213-226 và 538-570 |
| Render/public sharing hiện tại | `QuanLyNhanSu_AppScripts/ContractService.js`, dòng 17-92 |
| File nguồn 10 hợp đồng | `docs/hrdocsthuviec/Mẫu Hợp đồng thử việc 2026.docx`, SHA ở mục 2.3 |
| Bố cục active 22 placeholder | `backend/src/main/resources/hr/templates/probation-contract-template.docx`, SHA ở mục 2.3 |

Tài liệu này không chứa nội dung định danh cá nhân được trích từ các hợp đồng nguồn. Các kết luận về số bản ghi, preset, placeholder và checksum là kết quả kiểm kê tĩnh repository ngày 2026-07-28; số lượng dữ liệu runtime phải được truy vấn và ký đối soát tại thời điểm migration.
