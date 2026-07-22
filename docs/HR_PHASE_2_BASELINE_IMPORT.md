# HR Phase 2 — Import Baseline T6-26

Cập nhật: `2026-07-22`

Trạng thái: **hoàn thành ở source code và môi trường kiểm thử cô lập; chưa migrate, import hoặc khởi động production**.

Phase 2 xây phần lõi backend cho lần nạp baseline ban đầu. API bảo vệ bằng `ROLE_MANAGER` thuộc Phase 3; giao diện thuộc Phase 4.

## 1. Contract đầu vào

- Chỉ nhận artifact local `baseline-values-2026.xlsx` của Phase 0.1.
- SHA-256 bắt buộc: `d8f4ff9e292b68d1ec50b623159ef34095f7441d3487fa1e422140f0fdeaadbe`.
- Đúng ba sheet visible theo thứ tự: `GIAM`, `TĂNG`, `T6-26`.
- Chỉ parse `T6-26!A4:AH333`; header ở hàng 4, 329 dòng dữ liệu ở hàng 5–333.
- Không cho công thức, macro, external relationship hoặc dữ liệu ngoài vùng khóa.
- Giới hạn upload 10 MB, tối đa 256 ZIP entries và 25 MB sau giải nén; XML tắt DTD/external entity.

Parser đọc OOXML trực tiếp và không thêm dependency spreadsheet vào production JAR. File upload không được lưu; chỉ staging JSON và checksum được giữ có thời hạn.

## 2. Flow nghiệp vụ

```text
upload + checksum
        ↓
PARSED (chỉ staging, chưa có Employee)
        ↓
preview phân trang
        ↓
validate toàn bộ batch
        ↓
VALIDATED ── lỗi ──> không cho confirm
        ↓ warning cần xác nhận rõ
confirm + confirmation key
        ↓
CONFIRMED (transaction nguyên tử)
```

Confirm tạo đồng thời:

- danh mục HR deterministic nếu chưa có;
- 329 `HrEmployee` độc lập với `User`;
- hồ sơ công việc, định danh, bảo hiểm và liên hệ;
- 329 movement `INITIAL_LOAD` đã xác nhận;
- snapshot tháng `T6-26` ở trạng thái `CLOSED` với 329 dòng;
- liên kết staging và audit event theo batch.

Tuổi, tổng thu nhập và số năm công tác chỉ dùng đối chiếu, không lưu trùng vào hồ sơ chính. Cột `NGÀY LÀM` chỉ map sang `hireDate`; không tự suy diễn thành `leaveAccrualStartDate`. Cột ngày nghỉ phép `AH` map vào snapshot tháng và hiện để trống theo baseline.

## 3. Validation

Lỗi chặn confirm gồm thiếu/sai trường bắt buộc, mã nhân viên trùng, ngày không hợp lệ, thứ tự nguồn sai và tổng thu nhập derived không khớp.

Warning cần Manager chấp nhận rõ trước confirm gồm:

- `#N/A` hoặc optional value không hợp lệ được chuyển thành `null`;
- định danh dạng số có nguy cơ mất số 0 đầu;
- BHXH/CMND trùng trong nguồn;
- trường hồ sơ cần xác minh còn thiếu;
- tuổi derived không khớp mốc `2026-06-30`.

Baseline thật hiện parse đủ 329 mã duy nhất, không có lỗi chặn. Có 29 ô `#N/A` tại cột `Z`; tổng cộng 111 dòng có `birthPlaceCurrent = null` do `#N/A`, ô trống hoặc giá trị không dùng được. Không giá trị nào bị tự bịa hoặc tự sửa.

## 4. Idempotency và transaction

- Upload lại cùng checksum/sheet/type trả về batch đang hoạt động thay vì tạo thêm staging.
- Mỗi batch confirm bằng `confirmationKey` unique; retry cùng key trả lại kết quả cũ.
- Batch bị khóa pessimistic khi validate/confirm/rollback/purge.
- Confirm kiểm tra lại mã nhân viên và roster T6 ngay trong transaction.
- Nếu có xung đột sau validate, toàn bộ confirm rollback; không tồn tại dữ liệu chèn dở.

## 5. Rollback có guard

Rollback tự động chỉ được phép khi batch còn nguyên trạng:

- đúng số Employee/movement/roster do batch tạo;
- Employee chưa bị cập nhật;
- chưa có movement hoặc roster tháng sau tham chiếu;
- roster T6 vẫn là snapshot đóng ban đầu.

Khi hợp lệ, transaction xóa dữ liệu nghiệp vụ do batch tạo nhưng giữ batch, staging result, checksum, issue và audit. Danh mục HR được giữ lại để retry deterministic. Nếu đã có dữ liệu downstream, rollback bị chặn và phải xử lý bằng nghiệp vụ/migration bù ở phase sau.

## 6. Retention PII

Migration `V2__add_hr_import_payload_retention.sql` chỉ thay đổi hai bảng staging HR:

- thêm deadline, thời điểm purge và actor purge ở batch;
- cho phép `raw_payload` thành `NULL`;
- thêm CHECK audit purge và index quét deadline.

Deadline mặc định là 30 ngày kể từ upload, và được đặt lại sau confirm/rollback. Scheduler chạy `02:30 UTC` mỗi ngày. Batch `PARSED`/`VALIDATED` bị bỏ quên sẽ chuyển `FAILED`, các row chuyển `SKIPPED`, rồi raw/normalized payload và employee-code hint bị xóa. Batch đã confirm/rollback cũng được purge staging khi hết hạn, nhưng vẫn giữ checksum, issue code, liên kết/audit cần thiết.

Snapshot tháng chỉ giữ dữ liệu cần cho roster: mã/tên nhân sự, đơn vị, chức vụ, môi trường, trạng thái, ngày làm và ngày phép. Nó không sao chép CCCD/CMND, BHXH/BHYT, địa chỉ, điện thoại hoặc lương/phụ cấp.

Cấu hình:

```properties
HR_IMPORT_PAYLOAD_RETENTION_DAYS=30
HR_IMPORT_PAYLOAD_PURGE_CRON=0 30 2 * * *
```

## 7. Kiểm thử

Đã kiểm tra:

- parser với workbook fixture 329 dòng và file baseline thật đã khóa;
- confirm/rollback đủ 329 dòng của chính baseline thật trên cả H2 và MySQL 8 cô lập;
- checksum/header/range/formula/type mapping;
- migration V1 → V2, no-op lần hai và bảo toàn raw payload cũ;
- preview, validation, warning acknowledgement, confirm và retry idempotent;
- xung đột sau validation không tạo dữ liệu một phần;
- rollback có audit;
- purge batch đã rollback và batch validation bị bỏ quên;
- JSON là object/array thật trên MySQL;
- schema/ORM/transaction trên MySQL `8.0.46` container tạm, cổng ngẫu nhiên, không volume và tự xóa;
- không có cột/FK từ HR sang `users` và không thay đổi bảng legacy.

Lệnh kiểm tra:

```bash
cd backend
HR_BASELINE_XLSX=../docs/hr-template/baseline-values-2026.xlsx ./mvnw test

cd ..
./scripts/hr-schema/verify-phase2-mysql.sh
```

## 8. Phạm vi chưa triển khai

- Chưa có endpoint `/api/v1/hr/**`, upload multipart hoặc mapping principal → `HrImportActor`.
- Chưa có `ROLE_MANAGER` authorization test; thuộc Phase 3.
- Chưa có UI preview/confirm/rollback; thuộc Phase 4.
- Chưa import 329 nhân sự vào production.
- Chưa xử lý 9 tăng/2 giảm; dùng làm case UAT sau khi API/UI sẵn sàng.

Production chỉ được áp dụng V1/V2 trong maintenance window riêng sau full backup và đối chiếu bảng legacy theo [quy trình Phase 1](HR_PHASE_1_SCHEMA.md).
