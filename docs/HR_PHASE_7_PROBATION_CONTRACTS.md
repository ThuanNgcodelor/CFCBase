# HR Phase 7 — Ứng viên thử việc và hợp đồng Word

Cập nhật: 2026-07-24

Trạng thái: **đã triển khai source schema/API/template/UI; chưa deploy/UAT runtime**

## 1. Mục tiêu

Thêm một flow riêng cho người mới thử việc, không đưa thẳng vào danh sách nhân sự chính thức.

Flow chuẩn:

```text
Ứng viên thử việc
-> tạo hợp đồng thử việc
-> theo dõi thời hạn thử việc
-> nếu đạt: chuyển thành hồ sơ chờ chính thức
-> tạo Tăng nhân sự
-> chính thức vào danh sách nhân sự tháng
```

Flow này không thay thế `Hồ sơ nháp`, `Tăng nhân sự`, `Giảm nhân sự` hiện tại. Nó chỉ thêm một tầng trước khi người thử việc trở thành hồ sơ chờ chính thức.

## 2. Template Word đã chuẩn hóa

Template backend:

```text
backend/src/main/resources/hr/templates/probation-contract-template.docx
```

SHA-256 hiện tại:

```text
34e2b4209ec0596a2003dadbe4ee98e33a9565a157383282cfe08ee84eb16f03
```

Nguồn tham khảo:

```text
docs/hrdocsthuviec/Mẫu Hợp đồng thử việc 2026.docx
```

Việc đã làm với template:

- Cắt còn đúng một hợp đồng thử việc.
- Bỏ dữ liệu ứng viên mẫu trong file gốc.
- Thay các trường biến động bằng placeholder `{{...}}`.
- Giữ cấu trúc/form hợp đồng gốc ở mức an toàn để backend có thể đóng gói vào JAR.
- Không thay đổi nội dung pháp lý; nội dung pháp lý phải do TCHC/pháp chế xác nhận.

Các placeholder hiện có:

| Placeholder | Ý nghĩa |
| --- | --- |
| `{{CONTRACT_NO}}` | Số hợp đồng |
| `{{CONTRACT_YEAR}}` | Năm hợp đồng |
| `{{SIGN_DAY}}` | Ngày ký |
| `{{SIGN_MONTH}}` | Tháng ký |
| `{{SIGN_YEAR}}` | Năm ký |
| `{{CANDIDATE_TITLE}}` | Ông/Bà |
| `{{FULL_NAME}}` | Họ tên ứng viên |
| `{{NATIONALITY}}` | Quốc tịch |
| `{{DATE_OF_BIRTH}}` | Ngày sinh |
| `{{BIRTH_PLACE}}` | Nơi sinh |
| `{{PERMANENT_ADDRESS}}` | Địa chỉ thường trú |
| `{{CITIZEN_ID}}` | Số CCCD |
| `{{CITIZEN_ID_ISSUED_DATE}}` | Ngày cấp CCCD |
| `{{CITIZEN_ID_ISSUED_PLACE}}` | Nơi cấp CCCD |
| `{{PROBATION_CONTRACT_TYPE}}` | Loại hợp đồng thử việc |
| `{{PROBATION_START_DATE}}` | Ngày bắt đầu thử việc |
| `{{PROBATION_END_DATE}}` | Ngày kết thúc thử việc |
| `{{POSITION_NAME}}` | Chức vụ/công việc |
| `{{JOB_DESCRIPTION}}` | Công việc phải làm |
| `{{BASE_SALARY_TEXT}}` | Lương dạng chữ/số đã format |
| `{{SALARY_NOTE}}` | Ghi chú lương, ví dụ ` và KPI` |
| `{{DEPARTMENT_RULE_NOTE}}` | Ghi chú nội quy theo phòng ban |

## 3. Business flow đơn giản

### 3.1 Người mới thử việc

1. Vào `Ứng viên thử việc`.
2. Bấm `+ Thêm ứng viên`.
3. Nhập thông tin cá nhân, CCCD, địa chỉ, phòng ban, chức vụ/công việc, lương thử việc, ngày bắt đầu/kết thúc.
4. Bấm `Tạo hợp đồng thử việc`.
5. Tải file `.docx`.
6. Theo dõi trạng thái `Đang thử việc`, `Sắp hết hạn`, `Đạt`, `Không đạt`.

### 3.2 Ứng viên đạt thử việc

1. Mở chi tiết ứng viên.
2. Bấm `Chuyển thành hồ sơ chờ chính thức`.
3. Hệ thống tạo `HrEmployee` trạng thái `DRAFT`.
4. Manager kiểm tra hồ sơ.
5. Vào `Tăng / Giảm`, chọn `Tăng nhân sự`.
6. Xác nhận để người đó vào danh sách chính thức.

### 3.3 Ứng viên không đạt

1. Mở chi tiết ứng viên.
2. Bấm `Đánh dấu không đạt`.
3. Lưu lý do.
4. Không tạo `HrEmployee`.
5. Vẫn giữ audit/hợp đồng đã sinh để tra cứu.

## 4. Dữ liệu đã triển khai

### 4.1 `hr_probation_candidates`

Dùng cho ứng viên thử việc.

Trường chính:

- `id`
- `candidate_code`
- `full_name`
- `gender`
- `date_of_birth`
- `birth_place`
- `nationality`
- `citizen_id`
- `citizen_id_issued_date`
- `citizen_id_issued_place`
- `permanent_address`
- `phone`
- `email`
- `department_id`
- `position_id`
- `job_template_id`
- `probation_start_date`
- `probation_end_date`
- `base_salary`
- `salary_note`
- `status`
- `converted_employee_id`
- `row_version`
- `created_at`, `created_by_actor`, `updated_at`, `updated_by_actor`

Status đề xuất:

```text
DRAFT
CONTRACT_CREATED
IN_PROBATION
PASSED
FAILED
CONVERTED
CANCELLED
```

### 4.2 `hr_probation_job_templates`

Dùng để mỗi phòng ban/công việc có nội dung và lương mặc định riêng.

Ví dụ:

```text
Tên mẫu: Nhân viên phòng QLCLSP
Phòng ban: QLCLSP
Chức vụ: Nhân viên phòng QLCLSP
Lương: 7.500.000
Công việc: Do trưởng phòng phân công.
Ghi chú nội quy: , phòng CN-KCS
```

### 4.3 `hr_probation_contracts`

Dùng để lưu lịch sử file hợp đồng đã sinh.

Trường chính:

- `id`
- `candidate_id`
- `contract_no`
- `template_version`
- `template_sha256`
- `generated_file_sha256`
- `generated_at`
- `generated_by_actor`
- `status`
- `snapshot_payload`

Phase đầu đang lưu file `.docx` đã sinh trong DB dạng `MEDIUMBLOB`, kèm checksum SHA-256 và snapshot placeholder JSON. Cách này gọn cho deployment JAR hiện tại; nếu dung lượng hợp đồng tăng lớn sau này có thể chuyển sang private storage mà vẫn giữ metadata/checksum.

## 5. API đã triển khai

Tất cả nằm dưới `/api/v1/hr/**` và chỉ `MANAGER` đang active được gọi.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `GET` | `/api/v1/hr/probation/candidates` | Danh sách ứng viên thử việc |
| `POST` | `/api/v1/hr/probation/candidates` | Tạo ứng viên |
| `GET` | `/api/v1/hr/probation/candidates/{id}` | Chi tiết ứng viên |
| `PATCH` | `/api/v1/hr/probation/candidates/{id}` | Sửa ứng viên khi chưa chuyển hồ sơ |
| `POST` | `/api/v1/hr/probation/candidates/{id}/contracts` | Sinh hợp đồng thử việc |
| `GET` | `/api/v1/hr/probation/contracts/{id}/download` | Tải hợp đồng `.docx` |
| `POST` | `/api/v1/hr/probation/candidates/{id}/start` | Chuyển sang đang thử việc |
| `POST` | `/api/v1/hr/probation/candidates/{id}/pass` | Đánh dấu đạt thử việc |
| `POST` | `/api/v1/hr/probation/candidates/{id}/fail` | Đánh dấu không đạt |
| `POST` | `/api/v1/hr/probation/candidates/{id}/convert-to-employee-draft` | Chuyển thành hồ sơ chờ chính thức |
| `GET` | `/api/v1/hr/probation/job-templates` | Danh sách mẫu công việc thử việc |
| `POST` | `/api/v1/hr/probation/job-templates` | Tạo mẫu công việc thử việc |
| `PATCH` | `/api/v1/hr/probation/job-templates/{id}` | Sửa/ngừng dùng mẫu công việc thử việc |

## 6. UI đã triển khai

Thêm menu:

```text
Quản lý nhân sự
-> Thử việc
```

Route:

```text
/manager/hr/probation
```

Trang chính có 2 tab:

- Danh sách ứng viên.
- Filter theo trạng thái, phòng ban, thời hạn sắp hết.
- Nút `+ Thêm ứng viên`.
- Nút `Tạo hợp đồng`.
- Nút `Tải hợp đồng`.
- Nút `Đạt thử việc`.
- Nút `Không đạt`.
- Nút `Chuyển thành hồ sơ chờ chính thức`.
- Tab `Mẫu công việc thử việc` để khai báo nhanh phòng ban/chức vụ/điều kiện/lương/mô tả công việc.

## 7. Thư viện xử lý Word

Đề xuất kỹ thuật:

- Phase đầu: dùng `docx4j` hoặc Apache POI XWPF để thay placeholder trong `.docx`.
- Với template nhiều format phức tạp/content control sau này, ưu tiên `docx4j`.
- Nếu cần xuất PDF: dùng LibreOffice headless trên Linux để convert `.docx -> .pdf`.

Không nên thay text trực tiếp kiểu replace chuỗi thô trên file Word gốc có dữ liệu thật, vì Word có thể tách chữ thành nhiều run làm mất format hoặc replace không đủ.

## 8. Phase triển khai

### Phase 7.0 — Plan và template

Trạng thái: **đã làm**.

- Tạo plan này.
- Tạo `probation-contract-template.docx` trong backend resources.
- Verify template chỉ còn một hợp đồng và không còn dữ liệu ứng viên mẫu.

### Phase 7.1 — Schema/API/backend sinh hợp đồng

Trạng thái: **đã làm ở source code ngày 2026-07-24**.

- Thêm Flyway `V3__add_hr_probation_candidates.sql`.
- Thêm entity/repository/service/controller cho ứng viên thử việc, mẫu công việc và hợp đồng đã sinh.
- Sinh `.docx` từ `probation-contract-template.docx` bằng placeholder trong OOXML.
- Lưu hợp đồng đã sinh, snapshot placeholder và checksum trong DB.
- Chuyển ứng viên đạt thử việc thành `HrEmployee DRAFT`; không tự tạo movement tăng nhân sự.
- Thêm seeder tạo sẵn các mẫu công việc thử việc từ nội dung an toàn trong file Word gốc; không seed tên, CCCD, ngày sinh hoặc địa chỉ người thật.
- Seeder chỉ thêm template còn thiếu theo mã/tên, không ghi đè template Manager đã chỉnh sửa.

### Phase 7.2 — Frontend Manager

Trạng thái: **đã làm ở source code ngày 2026-07-24**.

- Thêm API client `hrProbationApi`.
- Thêm route `/manager/hr/probation`.
- Thêm menu `Thử việc` trong sidebar Manager.
- Thêm UI nhập/sửa ứng viên, tạo/tải hợp đồng, bắt đầu thử việc, đánh giá đạt/không đạt và chuyển hồ sơ.
- Thêm UI quản lý `Mẫu công việc thử việc` để tự điền nhanh dữ liệu khi nhập ứng viên.

### Mẫu công việc mặc định từ Word gốc

Khi backend start và bảng `hr_probation_job_templates` chưa có các mã tương ứng, hệ thống tự thêm các mẫu sau:

- `TV-VIDEO` — Sáng tạo nội dung Video.
- `TV-ONLINE-SALES` — Xây dựng kênh bán hàng Online.
- `TV-QLCLSP` — Nhân viên phòng QLCLSP.
- `TV-KY-THUAT-CD` — Nhân viên kỹ thuật cơ điện.
- `TV-KHO` — Nhân viên kho.
- `TV-SALE` — Nhân viên sale.
- `TV-MARKETING` — Quản lý Marketing và bán hàng Online.
- `TV-TCHC-CDS` — Chuyển đổi số, hỗ trợ phòng TCHC.
- `TV-XNK` — Nhân viên xuất nhập khẩu.

Các mẫu này có thể sửa/ngừng dùng trực tiếp trong tab `Mẫu công việc thử việc`.

### Verification source ngày 2026-07-24

- Backend `./mvnw -q -DskipTests compile`: pass.
- Frontend `npm run build`: pass.
- Frontend `npm run lint`: pass, còn các warning cũ/nhẹ.
- Target migration test `HrPhase1MigrationTest,HrPhase2RetentionMigrationTest`: pass với Flyway V1/V2/V3.
- Full backend `mvn test` hiện bị chặn bởi Mockito inline/ByteBuddy self-attach trên Java 25 Fedora; không còn failure migration sau khi cập nhật test đếm V3.

### Việc còn lại trước production

- Deploy artifact mới trong cửa sổ phù hợp.
- UAT bằng một ứng viên giả: tạo mẫu công việc -> thêm ứng viên -> tạo/tải docx -> bắt đầu thử việc -> đạt -> chuyển `HrEmployee DRAFT` -> tạo `Tăng nhân sự`.
- Nếu số lượng hợp đồng tăng lớn, cân nhắc chuyển file generated từ DB blob sang private storage.

## 9. Quy tắc an toàn

- Không đưa ứng viên thử việc vào roster chính thức.
- Không tạo `Tăng nhân sự` tự động.
- Không sửa flow login/profile/booking.
- Không log CCCD hoặc payload hợp đồng.
- Không ghi đè template gốc trong `docs/hrdocsthuviec`.
- Không coi nội dung pháp lý trong template là do hệ thống tự xác nhận.
