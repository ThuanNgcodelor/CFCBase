# HR Phase 11 — Hợp Đồng Chính Thức Và Onboarding Hai Khối

Cập nhật: `2026-08-07`

Trạng thái: **đã hoàn thành source, migration, API, UI và automated verification; chưa deploy, chưa chạy migration production và chưa UAT runtime**.

## 1. Mục tiêu đã chốt

Phase này tách onboarding thành hai luồng nghiệp vụ nhưng dùng chung một cổng kiểm soát hợp đồng lao động chính thức.

### Khối văn phòng

```text
Ứng viên thử việc
  -> tạo hợp đồng thử việc
  -> bắt đầu thử việc
  -> đánh giá ĐẠT
  -> chọn HĐLĐ 12 tháng hoặc không xác định thời hạn
  -> HrEmployee DRAFT (OFFICE)
  -> tạo Tăng nhân sự DRAFT
  -> xác nhận Tăng
  -> Employee ACTIVE + hợp đồng EFFECTIVE
```

API cũ chuyển thẳng ứng viên đạt thành Employee nháp được giữ ở backend để tương thích nhưng luôn trả lỗi `EMPLOYMENT_CONTRACT_REQUIRED`. Frontend không còn gọi API này.

### Khối lao động phổ thông

```text
Mở menu LĐ phổ thông
  -> thêm trực tiếp thông tin nhân sự
  -> chọn HĐLĐ 12 tháng hoặc không xác định thời hạn
  -> HrEmployee DRAFT (GENERAL_LABOR)
  -> tạo Tăng nhân sự DRAFT
  -> xác nhận Tăng
  -> Employee ACTIVE + hợp đồng EFFECTIVE
```

Luồng này không đi qua ứng viên hoặc hợp đồng thử việc.

## 2. Quy tắc hợp đồng

- Loại `FIXED_TERM_12_MONTHS`: ngày kết thúc phải đúng `effectiveFrom + 1 năm`.
- Loại `INDEFINITE`: không được có ngày kết thúc.
- Ngày vào làm và ngày hiệu lực Tăng nhân sự phải trùng ngày hợp đồng bắt đầu.
- Hồ sơ onboarding mới dùng `onboarding_policy_version = 2` và bắt buộc có hợp đồng trạng thái `READY` trước khi tạo/xác nhận Tăng.
- Khi xác nhận Tăng, Employee chuyển `DRAFT -> ACTIVE` và hợp đồng chuyển `READY -> EFFECTIVE` trong cùng transaction.
- Employee legacy giữ `onboarding_policy_version = 1`, `LEGACY_UNKNOWN/LEGACY` và không bị chặn bởi rule mới.
- `contract_number` và `idempotency_key` là duy nhất. Gửi lại cùng khóa chỉ được replay khi đúng cùng hồ sơ và cùng nội dung hợp đồng; payload khác trả `ONBOARDING_IDEMPOTENCY_CONFLICT`.

## 3. Schema và backend

Flyway `V6__add_hr_employment_onboarding.sql`:

- Bổ sung `workforce_group`, `onboarding_source`, `onboarding_policy_version` vào `hr_employees`.
- Tạo `hr_employment_contracts` với trạng thái `READY`, `EFFECTIVE`, `VOIDED`.
- Liên kết hợp đồng với Employee; với luồng văn phòng có thêm liên kết nguồn tới ứng viên thử việc.
- Không sửa/xóa dữ liệu HR cũ và không chạm schema Booking.

API chính:

- `POST /api/v1/hr/probation/candidates/{candidateId}/complete-onboarding`
- `POST /api/v1/hr/onboarding/general-labor`
- `GET /api/v1/hr/employees?workforceGroup=GENERAL_LABOR`
- API Tăng/Giảm hiện hữu tiếp tục tạo và xác nhận movement.

Employee list/detail trả thêm `workforceGroup`, `onboardingSource`, `onboardingPolicyVersion` và hợp đồng hiện tại.

## 4. Frontend

- Menu Manager có mục `LĐ phổ thông` ngay sau `Thử việc`.
- Route danh sách: `/manager/hr/general-labor`.
- Route thêm mới: `/manager/hr/general-labor/new`.
- Sau khi hoàn tất onboarding ở cả hai luồng, UI chuyển sang màn Tăng/Giảm và tự điền Employee/ngày hiệu lực từ hợp đồng.
- Màn chi tiết Employee hiển thị phân loại khối, nguồn onboarding và hợp đồng hiện tại.

## 5. Xuất hợp đồng chính thức được defer

Phase này **không sinh Word/PDF hợp đồng lao động chính thức** cho cả văn phòng và lao động phổ thông theo quyết định của người dùng.

- UI đã có nút `Xuất hợp đồng` để cố định vị trí/flow tương lai.
- Nút chỉ thông báo chức năng chưa triển khai và không gọi API giả.
- Ba ảnh hợp đồng lao động phổ thông chỉ là nguồn tham khảo nghiệp vụ, không đủ ổn định để dùng trực tiếp làm template production.
- Khi có file Word chính thức đã làm sạch, phase sau mới chuẩn hóa placeholder, version template, checksum, snapshot và download API.

Hợp đồng **thử việc** Word hiện hữu không thay đổi và vẫn dùng template riêng `probation-contract-template.docx`.

## 6. Verification và gate vận hành

Đã đạt ở source:

- Backend full test: `108` test chạy, `0` failure, `0` error, `1` skip theo điều kiện môi trường.
- Frontend `npm run lint`: pass.
- Frontend `npm run build`: pass; còn chunk-size warning hiện hữu.
- Migration V6 có test clean migrate, default legacy, constraints và delete behavior.
- Không thay đổi `QuanLyNhanSu_AppScripts/Index.html` đang có chỉnh sửa riêng của người dùng.

Chưa thực hiện:

- Không deploy/restart runtime.
- Không chạy V6 trên production.
- Không ghi/sửa dữ liệu HR production.
- Chưa browser UAT vì phiên làm việc không có browser được kết nối.

UAT cần dùng hồ sơ test riêng cho đủ hai loại hợp đồng và cả hai khối; phải backup trước khi cho phép ghi vào runtime.
