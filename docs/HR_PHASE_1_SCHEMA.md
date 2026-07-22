# HR Phase 1 — Schema Và Migration

Cập nhật: 2026-07-22  
Trạng thái: **đã hoàn thành ở source code; chưa áp dụng lên production**

## 1. Phạm vi đã triển khai

- Thêm Flyway cho versioned database migration.
- Thêm migration `V1__create_hr_phase_1_schema.sql` chỉ tạo 15 bảng `hr_*`.
- Thêm entity, enum/status contract và repository nền cho domain HR.
- Thêm staging import để giữ raw payload trước khi normalize/validate.
- Thêm test chạy migration trên database sạch, chạy lại no-op và baseline trên schema cũ.
- Đã chạy Flyway, MySQL CHECK/FK/JSON, retry/RESTRICT, Hibernate update filter và ORM `validate` trên container MySQL `8.0.46` cô lập; container tự xóa và không dùng volume production.
- Thêm script chụp row-count legacy và verifier chỉ đọc để xác minh schema sau lần deploy đầu tiên.
- Không thêm API, UI, import Excel thật hoặc flow tăng/giảm của Phase 2 trở đi.
- Không restart backend, không kết nối và không thay đổi database production trong Phase 1.

## 2. Quyền sở hữu schema

### Flyway quản lý

Các bảng mới của phân hệ HR chỉ được thay đổi bằng migration versioned trong:

```text
backend/src/main/resources/db/migration/
```

Cấu hình Flyway an toàn, không chứa secret, được version-control tại `backend/src/main/resources/application.properties`. File `application.yml` local vẫn bị ignore như trước.

Không sửa database HR bằng cách chỉ đổi entity rồi trông chờ Hibernate tự cập nhật.

### Hibernate tạm thời quản lý phần legacy

`spring.jpa.hibernate.ddl-auto=update` được giữ lại để không phá flow hiện tại vì schema BookingBase cũ chưa được mô tả đầy đủ bằng migration. Đây là trạng thái chuyển tiếp:

- Flyway sở hữu toàn bộ bảng `hr_*`.
- Hibernate tiếp tục tương thích các bảng BookingBase cũ.
- `LegacySchemaFilterProvider` loại `hr_*` khỏi Hibernate create/update/drop/truncate; vì vậy sửa entity HR không thể tự đổi schema ngoài migration.
- Chế độ Hibernate `validate` vẫn kiểm tra toàn bộ HR mappings khi chạy verification.
- Chỉ chuyển `ddl-auto` sang `validate` sau một phase riêng đã baseline đầy đủ schema legacy.

## 3. Danh sách 15 bảng

| Nhóm | Bảng | Mục đích |
| --- | --- | --- |
| Danh mục | `hr_departments` | Phòng ban HR độc lập |
| Danh mục | `hr_positions` | Chức vụ HR độc lập |
| Danh mục | `hr_working_conditions` | Điều kiện/môi trường làm việc |
| Hồ sơ | `hr_employees` | Thông tin cốt lõi và trạng thái nhân sự |
| Hồ sơ | `hr_employee_employment` | Công việc, hợp đồng hiện tại, lương/phụ cấp, mốc tính phép |
| Hồ sơ | `hr_employee_identity` | CMND/CCCD và trạng thái xác minh |
| Hồ sơ | `hr_employee_insurance` | BHXH/BHYT |
| Hồ sơ | `hr_employee_contacts` | Địa chỉ, điện thoại, email, liên hệ khẩn cấp |
| Biến động | `hr_employee_movements` | Tăng, giảm, điều chuyển, thay đổi chức vụ/điều kiện |
| Tháng | `hr_monthly_rosters` | Kỳ snapshot tháng |
| Tháng | `hr_monthly_roster_items` | Snapshot từng nhân sự và ngày phép |
| Import | `hr_excel_template_versions` | Version/checksum hợp đồng Excel |
| Import | `hr_excel_import_batches` | Vòng đời một lần import |
| Import | `hr_excel_import_rows` | Raw/normalized staging và lỗi từng dòng |
| Audit | `hr_audit_events` | Nhật ký append-only, metadata đã lọc |

## 4. Hợp đồng dữ liệu quan trọng

### Employee độc lập với User

- Không có `user_id` trong bất kỳ bảng HR nào.
- Không có foreign key từ `hr_*` sang `users`.
- Actor audit được lưu dạng snapshot chuỗi `created_by_actor`, `updated_by_actor`, `actor_subject`, không phải user foreign key.
- `MANAGER` authorization sẽ được enforce ở API trong Phase 3, không ghép domain Employee với tài khoản login.

### Giá trị được lưu và giá trị được tính

- Lưu `base_salary` và `allowance`.
- Không lưu `total_income`; giá trị này được tính từ hai trường trên.
- Không lưu tuổi và số năm công tác; tính từ ngày sinh/ngày làm tại thời điểm truy vấn hoặc snapshot.
- Lưu `leave_accrual_start_date` làm mốc cho rule phép ở Phase 7.
- `leave_days` nằm trong monthly roster item để phản ánh đúng giá trị của từng tháng.

### Dữ liệu bẩn không bị mất

Baseline T6-26 có BHXH/CMND trùng, 29 giá trị `#N/A` và một số ngày có source type không đồng nhất. Vì vậy:

- Không đặt unique constraint lên BHXH, BHYT, CMND hoặc CCCD ở Phase 1.
- Các trường số giấy tờ/số điện thoại dùng `VARCHAR`, không dùng kiểu số.
- Import row có `raw_payload`, `normalized_payload`, checksum và issue codes.
- Phase 2 phải preview/validate trước confirm; không biến `#N/A` thành giá trị chính thức.
- Chỉ `employee_code` là khóa nghiệp vụ unique đã được baseline xác nhận đủ 329/329.
- Cùng checksum/sheet được phép retry bằng `attempt_number`; `confirmation_key` mới là idempotency key cho lần confirm.
- Raw staging chứa PII không được log/export tự do. Trước Phase 2 phải chốt và triển khai retention/purge cho raw payload; Phase 1 chưa tạo dữ liệu staging production.

### Status dùng VARCHAR + CHECK

Không dùng MySQL `ENUM`, tránh lặp lại lỗi phải sửa enum thủ công:

- Employee: `DRAFT`, `ACTIVE`, `INACTIVE`.
- Movement: `DRAFT`, `CONFIRMED`, `CANCELLED`.
- Roster: `DRAFT`, `OPEN`, `CLOSED`, `EXPORTED`.
- Import batch: `UPLOADED`, `PARSED`, `VALIDATED`, `CONFIRMED`, `FAILED`, `ROLLED_BACK`.
- Import row: `PENDING`, `VALID`, `WARNING`, `INVALID`, `IMPORTED`, `SKIPPED`, `ROLLED_BACK`.

CHECK constraint còn khóa lifecycle quan trọng: confirm/cancel phải có timestamp và actor, giảm phải chuyển `ACTIVE -> INACTIVE`, tăng/initial/rehire phải đi tới `ACTIVE`, roster đóng/xuất phải có metadata tương ứng.

### Lịch sử không có generic delete

- Repository HR mặc định không expose `delete*`/`remove*`.
- Snapshot item và import row dùng `ON DELETE RESTRICT`, không cascade mất lịch sử theo parent.
- Xóa bản nháp sau này phải là method nghiệp vụ riêng, kiểm tra trạng thái và audit trong cùng transaction.
- Audit entity là immutable và repository chỉ có save/read.

### Thời gian

Callback audit HR tạo thời gian theo UTC. JDBC hiện được cấu hình UTC; mọi import/native write ở Phase 2 cũng phải ghi UTC để tránh lệch `+07` giữa JPA và database.

## 5. Cách áp dụng lần đầu lên database hiện có

Flyway mặc định để `baseline-on-migrate=false` nhằm tránh vô tình ghi vào nhầm database. Chỉ bật trong lần áp dụng đầu tiên có kiểm soát.

### Quy trình deploy có maintenance window

1. Chỉ thực hiện trong cửa sổ maintenance đã thông báo; production phải được dừng trước final backup/migration.
2. Chạy bằng cờ one-time. Cờ này chỉ có hiệu lực trong đúng tiến trình hiện tại, không được lưu lại vào `.env`:

```bash
cd /home/david-nguyen/Works/BookingBase
./deployserver/linux/build-prod.sh --initialize-hr-schema
```

Nếu JAR đã build xong và chỉ lần start trước bị Flyway chặn, không cần build lại:

```bash
./deployserver/linux/run.sh --initialize-hr-schema
```

Có thể dùng biến `FLYWAY_BASELINE_ON_MIGRATE=true` trong `.env` cho automation cũ, nhưng không nên lưu `true` lâu dài.

3. `run.sh` tự động thực hiện đúng thứ tự:
   - dừng tunnel và backend cũ;
   - tạo **final full backup sau khi write traffic đã dừng**;
   - chụp row-count tất cả bảng legacy, không lưu nội dung PII;
   - start JAR mới để Flyway baseline `0` và chạy V1;
   - kiểm tra đúng 15 bảng, column/constraint/index contract, không có HR -> User;
   - đối chiếu row-count legacy trước/sau;
   - chỉ mở lại Cloudflare Tunnel khi toàn bộ verifier pass.

Nếu verifier fail, script dừng backend mới và không mở tunnel.

4. Flyway sẽ:
   - tạo `flyway_schema_history`;
   - baseline schema BookingBase cũ ở version `0`;
   - chạy V1 để tạo các bảng `hr_*`;
   - không `ALTER`, `DROP`, `DELETE` hoặc `TRUNCATE` bảng legacy.

5. Có thể chạy lại verifier read-only:

```bash
./deployserver/linux/verify-hr-phase1.sh
```

6. Các lần chạy sau dùng launcher/`build-prod.sh` bình thường. Flyway đọc history hiện có và V1 sẽ là no-op.

Không chạy quy trình trên production chỉ để test. Phase 1 đã pass cả H2 và MySQL 8 cô lập; production chỉ được áp dụng trong maintenance window riêng.

## 6. Backup Và rollback

Flyway migration là forward-only. Không có script tự động drop 15 bảng vì drop có thể làm mất dữ liệu HR sau khi Phase 2 bắt đầu.

- Nếu rollback JAR trước khi có dữ liệu HR: chạy lại JAR cũ; các bảng `hr_*` không được JAR cũ sử dụng và có thể để nguyên.
- Nếu V1/verifier lỗi: backend mới bị dừng, tunnel vẫn đóng; giữ log và final backup, không tự chạy `repair` hoặc drop table từng phần.
- Ưu tiên chạy lại JAR cũ và để các bảng HR chưa dùng nằm yên. Nếu thực sự cần quay lại toàn bộ database, final backup được tạo sau khi production dừng nên không bỏ mất booking phát sinh trong maintenance window.
- Restore dùng quy trình xác nhận trong `deployserver/linux/restore-database.sh`.
- Sau khi đã import HR: mọi rollback làm thay đổi dữ liệu phải dùng migration bù hoặc restore có kế hoạch, tuyệt đối không xóa tay.

Chi tiết backup/restore chung: [DATABASE_BACKUP.md](DATABASE_BACKUP.md).

## 7. Test contract

Các test mới kiểm tra:

- đủ đúng 15 bảng HR;
- không có `user_id`/FK sang `users`;
- migration trên database sạch chạy đúng một lần;
- lần migrate thứ hai không chạy lại;
- duplicate `employee_code` bị chặn;
- status sai bị CHECK constraint chặn;
- baseline schema có sẵn giữ nguyên dữ liệu bảng `users`;
- domain HR không tham chiếu bất kỳ entity legacy BookingBase nào;
- tuổi, thâm niên và tổng thu nhập không bị persist trùng.
- Hibernate update filter không được tạo/sửa/drop/truncate `hr_*`.
- repository lịch sử không expose generic delete.
- MySQL 8 thật: migration/no-op, JSON/CHECK/FK, retry attempt, RESTRICT delete và ORM schema validation.

Chạy riêng Phase 1:

```bash
cd backend
./mvnw -Dtest='com.booking.system.hr.*Test' test
```

Chạy integration test MySQL 8 cô lập (tạo container cổng ngẫu nhiên, không volume và tự xóa):

```bash
./scripts/hr-schema/verify-phase1-mysql.sh
```

## 8. Gate trước Phase 2

- Chưa seed/import 329 nhân sự trong V1.
- Không ghi cố định 9 tăng và 2 giảm vào migration.
- Phase 2 phải dùng `baseline-values-2026.xlsx` đã khóa checksum.
- 9 tăng và 2 giảm được dùng làm UAT sau khi flow preview/validate/confirm hoàn chỉnh.
- MySQL 8 schema/ORM smoke đã pass; trước Phase 2 vẫn phải test parser/import transaction và rollback batch trên MySQL cô lập.
