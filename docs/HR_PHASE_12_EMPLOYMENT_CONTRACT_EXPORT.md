# HR Phase 12 — Xuất Hợp Đồng Lao Động Hai Khối

Cập nhật: `2026-08-07`

Trạng thái: **đã hoàn thành source, migration, API, UI và automated verification; chưa deploy, chưa chạy migration production và chưa UAT runtime**.

## Phạm vi

- Khối văn phòng: sau khi ứng viên đạt thử việc, Manager có thể `Lưu và xuất hợp đồng`; hệ thống tạo Employee `DRAFT`, lưu HĐLĐ chính thức, sinh/tải DOCX khối văn phòng rồi chuyển sang màn tạo `INCREASE`.
- Lao động phổ thông: Manager có thể `Lưu và xuất hợp đồng` ngay trong form onboarding trực tiếp; hệ thống dùng mẫu LĐ phổ thông rồi chuyển sang cùng flow `INCREASE`.
- Từ trang chi tiết Employee có thể xuất lại hợp đồng hiện tại. Mỗi lần sinh là một document snapshot mới, không ghi đè file cũ.
- Cả `FIXED_TERM_12_MONTHS` và `INDEFINITE` dùng chung renderer; hợp đồng không xác định thời hạn không in ngày kết thúc.

## Template và an toàn dữ liệu

- Runtime dùng hai template sạch:
  - `employment-contract-office-template.docx`
  - `employment-contract-general-labor-template.docx`
- Hai mẫu được distill bằng script `scripts/hr-template/build-employment-contract-templates.py` từ file tham chiếu `HDLD.docx`.
- `HDLD.docx` là bundle 49 hợp đồng có PII, được giữ local-only, ignore khỏi Git và exclude khỏi Maven resources. Backend artifact chỉ chứa hai mẫu đã làm sạch.
- Trước khi xuất, backend bắt buộc đủ họ tên, ngày/nơi sinh, địa chỉ, CCCD/ngày cấp/nơi cấp, phòng ban, chức vụ, mô tả công việc và lương cơ bản.

## Backend

- Flyway V7 tạo `hr_employment_contract_documents` để lưu template checksum, generated checksum, DOCX blob, snapshot payload, actor và thời điểm sinh.
- API:
  - `POST /api/v1/hr/employment-contracts/{contractId}/documents`
  - `GET /api/v1/hr/employment-contract-documents/{documentId}/download`
- `HrEmploymentContractDocumentService` chọn template theo `workforce_group`, thay placeholder có XML escaping, chặn token chưa xử lý, ghi audit và lưu bản bất biến.

## Frontend và form

- Nút placeholder được thay bằng nút xuất thật ở onboarding Văn phòng, onboarding LĐ phổ thông và chi tiết Employee.
- Phòng ban/Chức vụ ở form thử việc và LĐ phổ thông là combobox tìm theo tên hoặc mã, hỗ trợ tìm không dấu và bàn phím.
- Nơi cấp CCCD ở LĐ phổ thông dùng đúng hai lựa chọn dùng chung với thử việc: `Bộ Công an`, `Cục cảnh sát QLHC về TTXH`; hồ sơ legacy vẫn giữ được giá trị cũ khi hiển thị.

## Verification

- Backend full regression: `111` test chạy, `0` failure, `0` error, `1` skip theo điều kiện môi trường.
- Test sinh file phủ cả `OFFICE` 12 tháng và `GENERAL_LABOR` không xác định thời hạn; DOCX mở được, có dữ liệu snapshot và không còn placeholder.
- Flyway clean migrate/replay pass đến V7.
- Frontend `npm run lint` và `npm run build` pass; còn chunk-size warning hiện hữu.
- Quick Look render thành công template Word để kiểm tra hierarchy, body và vùng chữ ký.
- Không deploy/restart, không chạy V7 và không ghi dữ liệu production trong lượt này.
