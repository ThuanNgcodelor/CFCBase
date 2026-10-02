# Kế hoạch triển khai import nâng lương HR

> Ngày chốt nghiệp vụ: 02/10/2026 (Asia/Ho_Chi_Minh)
>
> Trạng thái: **Đã triển khai và kiểm thử local; chưa deploy production**
>
> File mẫu đối chiếu: `Tang luong thang 7-2026.xlsx`

## 1. Mục tiêu

Bổ sung chế độ **Nâng lương** cho HR, cho phép tải file Excel, ghép nhân viên theo `MS`, xem trước chênh lệch, xác nhận và lưu lịch sử lương theo ngày hiệu lực.

Hệ thống phải giữ đúng lịch sử theo kỳ:

- Tháng 6/2026 của A339 vẫn dùng `6.647.000 + 1.892.000 = 8.539.000`.
- Từ tháng 7/2026 dùng `7.046.000 + 1.892.000 = 8.938.000`.
- Mức mới tiếp tục có hiệu lực cho đến khi có một thay đổi lương khác được xác nhận.
- Không ghi đè làm mất mức lương cũ.

### Kết quả triển khai ngày 02/10/2026

| Phase | Trạng thái | Kết quả chính |
|---|---|---|
| 0 — Contract/fixture | Hoàn thành | Parser fixture A339 và quy tắc giữ ngày tới hạn theo file |
| 1 — Schema/domain | Hoàn thành | Flyway V27, history, snapshot, idempotency và truy vấn lương theo ngày |
| 2 — Parse/validate | Hoàn thành | Upload, staging, preview, cảnh báo và chặn mismatch toàn batch |
| 3 — Confirm/effective/rollback | Hoàn thành | ADMIN-only, transaction/lock, scheduled apply, audit và rollback |
| 4 — UI/profile | Hoàn thành | Màn import nâng lương, thông báo từng dòng, hồ sơ và lịch sử lương |
| 5 — Export/direct edit | Hoàn thành | Export theo tháng dùng timeline; form và backend chặn sửa lương trực tiếp |
| 6 — Hardening/rollout | Một phần, gate chính đạt | H2 + MySQL 8, test nghiệp vụ, lint/build và schema verifier V27; còn concurrency/API-security E2E và smoke/deploy production |

## 2. Quyết định nghiệp vụ đã chốt

1. Ghép nhân viên duy nhất bằng `MS` sau khi trim và chuẩn hóa chữ hoa; họ tên chỉ dùng để đối chiếu.
2. `NGÀY NÂNG BẬC GẦN NHẤT` là ngày mức lương mới bắt đầu có hiệu lực.
3. Chưa tính lương/prorate theo ngày trong CFCBase. Giai đoạn này chỉ cần truy vấn đúng mức lương theo kỳ; trường hợp ngày hiệu lực giữa tháng chưa xây dựng phép chia lương theo số ngày.
4. `HẠN NÂNG BẬC` được lưu bằng số tháng và hiển thị thân thiện, ví dụ `48` thành `4 năm`.
5. `NGÀY TỚI HẠN` trong file là giá trị nghiệp vụ ưu tiên. Hệ thống giữ nguyên ngày này, kể cả khi lệch 15–20 ngày so với phép cộng tháng lịch.
6. Nếu `NGÀY TỚI HẠN` khác `ngày nâng + hạn nâng bậc`, preview chỉ cảnh báo để người dùng biết; không tự sửa và không chặn import vì lý do này.
7. `NGÀY TỚI HẠN` chỉ là ngày nhắc xét nâng bậc tiếp theo; đến hạn không tự đổi, dừng hoặc hết hiệu lực mức lương đang dùng.
8. `Phụ cấp sau nâng` được cập nhật và có lịch sử hiệu lực giống lương cơ bản.
9. Nếu lương hoặc phụ cấp hiện tại trong file không khớp dữ liệu đang có trong DB, dòng bị chặn, batch không được xác nhận và UI phải hiển thị thông báo rõ ràng.
10. Cho phép import trước ngày hiệu lực. Thay đổi được lưu ở trạng thái chờ và chỉ trở thành mức hiện hành từ ngày hiệu lực.
11. Sau khi chức năng hoạt động, không cho sửa trực tiếp lương/phụ cấp tại form hồ sơ. Thay đổi thủ công cũng phải đi qua nghiệp vụ thay đổi lương và tạo lịch sử.
12. Xác nhận và rollback nâng lương là thao tác nhạy cảm; giai đoạn đầu chỉ `ADMIN` được thực hiện.

## 3. Mapping file mẫu

| Cột nguồn | Ý nghĩa | Cách xử lý |
|---|---|---|
| `MS` | Mã nhân viên | Bắt buộc; ghép với `hr_employees.employee_code` |
| `HỌ VÀ TÊN` | Tên tham chiếu | Không dùng để ghép; khác DB thì cảnh báo |
| `ĐƠN VỊ LV`, `CHỨC DANH`, `NGÀY LÀM` | Thông tin đối chiếu | Không cập nhật hồ sơ trong import nâng lương |
| `Lương <năm>` | Lương trước nâng trong file | So sánh bắt buộc với mức có hiệu lực trong DB |
| `PHỤ CẤP <năm>` | Phụ cấp trước nâng trong file | So sánh bắt buộc với mức có hiệu lực trong DB |
| `TỔNG LƯƠNG <năm>` | Tổng trước nâng | Kiểm tra bằng lương + phụ cấp; không dùng làm nguồn tính |
| `Bậc <năm>` | Bậc trước nâng | Lưu vào lịch sử |
| `Mã số <năm>` | Mã ngạch/bảng lương | Lưu vào lịch sử; template mới nên đổi tên thành `MÃ NGẠCH LƯƠNG` |
| `Bậc sau khi nâng` | Bậc mới | Bắt buộc |
| `Lương sau nâng bậc` | Lương cơ bản mới | Bắt buộc |
| `Phụ cấp Sau nâng` | Phụ cấp mới | Bắt buộc; cho phép bằng mức cũ |
| `TỔNG LƯƠNG SAU NÂNG` | Tổng mới | Kiểm tra bằng lương mới + phụ cấp mới |
| `HẠN NÂNG BẬC` | Chu kỳ xét tiếp theo | Lưu số tháng; hiển thị năm/tháng |
| `NGÀY NÂNG BẬC GẦN NHẤT` | Ngày hiệu lực | Bắt buộc |
| `NGÀY TỚI HẠN` | Ngày nhắc xét tiếp theo | Giữ đúng giá trị file; bắt buộc |

Các cột không tiêu đề, dữ liệu tài khoản/định danh ngoài contract và cột trợ giúp không được import. Parser dùng allowlist, không lưu payload PII không cần thiết.

## 4. Mô hình dữ liệu đã triển khai

### 4.1 Bảng lịch sử `hr_employee_salary_changes`

Tối thiểu gồm:

- `id`, `employee_id`, `import_batch_id`, `source_row_number`.
- `effective_date`, `status` (`SCHEDULED`, `APPLIED`, `ROLLED_BACK`).
- `old_base_salary`, `new_base_salary`.
- `old_allowance`, `new_allowance`.
- `old_grade`, `new_grade`, `salary_scale_code`.
- `review_cycle_months`, `next_review_date`.
- `idempotency_key`, actor, timestamp và `row_version`.

Ràng buộc chính:

- Một dòng nguồn chỉ sinh tối đa một thay đổi lương.
- Không được có hai thay đổi trùng nhân viên, ngày hiệu lực và nội dung mới.
- Tiền dùng `DECIMAL(15,2)`, không dùng số thực dấu phẩy động.
- Bản ghi đã áp dụng không sửa trực tiếp; điều chỉnh/rollback phải để lại dấu vết.

### 4.2 Snapshot hiện hành

`hr_employee_employment.base_salary` và `allowance` tiếp tục là snapshot để các màn hình hiện tại đọc nhanh. Bổ sung snapshot bậc/ngạch/ngày nâng/ngày tới hạn nếu cần hiển thị thường xuyên.

Nguồn lịch sử có hiệu lực mới là căn cứ để:

- Lấy lương theo một ngày hoặc kỳ quá khứ.
- Khôi phục đúng khi rollback.
- Không làm thay đổi báo cáo tháng cũ sau một lần nâng lương mới.

### 4.3 Tái sử dụng batch import

- Bổ sung `SALARY_RAISE` vào `HrImportType` và CHECK constraint bằng migration forward-only.
- Tái sử dụng `hr_excel_import_batches` và `hr_excel_import_rows` cho lifecycle parse/validate/confirm/rollback, checksum, retention và audit.
- Không dùng `INCREASE`, vì tên này đang dễ bị hiểu là tăng nhân sự/quân số.
- Không đưa nâng lương vào `HrEmployeeMovement`; thay đổi lương không làm thay đổi roster hoặc quân số.

## 5. Quy tắc xác định lương theo kỳ

Khi cần lương tại ngày `D`, lấy bản ghi không bị rollback có `effective_date <= D` gần nhất.

Ví dụ A339:

| Kỳ/ngày đối chiếu | Mức áp dụng |
|---|---:|
| Đến 30/06/2026 | 8.539.000 |
| Từ 01/07/2026 | 8.938.000 |
| 08/2026, 09/2026 và các kỳ sau | 8.938.000 cho đến thay đổi tiếp theo |

Đối với export theo tháng, service phải nhận kỳ cần xuất và tra mức lương có hiệu lực tại kỳ đó, không đọc mù snapshot hiện hành. Giai đoạn này không tính prorate nếu ngày hiệu lực nằm giữa tháng.

## 6. Validation và thông báo

### Lỗi chặn xác nhận

- Không tìm thấy `MS` trong DB hoặc có `MS` trùng trong file.
- Nhân viên không có hồ sơ employment cần thiết.
- Lương/phụ cấp trước nâng trong file khác mức đang có hiệu lực trong DB.
- Thiếu lương mới, phụ cấp mới, bậc mới, ngày hiệu lực hoặc ngày tới hạn.
- Tổng cũ/mới không bằng lương + phụ cấp.
- Lương mới âm, phụ cấp mới âm hoặc tổng mới không tăng trong chế độ nâng lương.
- Trùng thay đổi đã xác nhận hoặc dữ liệu bị thay đổi sau lúc preview.

Batch áp dụng theo nguyên tắc **all-or-nothing**: còn ít nhất một dòng lỗi thì không xác nhận toàn batch.

### Cảnh báo không chặn

- Họ tên trong file khác tên DB nhưng `MS` đúng.
- Đơn vị/chức danh/ngày làm khác hồ sơ hiện hành.
- Ngày tới hạn trong file khác phép tính ngày hiệu lực + số tháng.

### Kênh thông báo giai đoạn đầu

- Toast đỏ ngay khi validate/confirm thất bại.
- Banner tổng hợp ở đầu preview.
- Lỗi chi tiết tại từng dòng, hiển thị cả giá trị file và giá trị DB.
- Ghi issue vào batch và audit để xem lại sau khi tải lại trang.
- Chưa gửi email hoặc Telegram trong phase đầu.

Thông báo mismatch mẫu:

> A339 – Lương hiện tại trong file là 6.647.000 nhưng mức đang có hiệu lực trong hệ thống là 6.700.000. Batch chưa được áp dụng; vui lòng kiểm tra file hoặc lịch sử lương.

## 7. Lifecycle

1. **Upload/parse:** đọc workbook, nhận diện header linh hoạt, tạo batch và staging rows; chưa đổi dữ liệu nhân viên.
2. **Validate/preview:** ghép theo `MS`, tải mức lương DB có hiệu lực tại ngày ngay trước `effective_date`, kiểm tra số tiền và hiển thị chênh lệch.
3. **Confirm:** khóa các dòng nhân viên liên quan, kiểm tra lại chống stale data, tạo lịch sử trong một transaction.
4. **Apply:**
   - `effective_date <= ngày hiện tại`: đặt `APPLIED` và cập nhật snapshot.
   - `effective_date > ngày hiện tại`: đặt `SCHEDULED`; job định kỳ áp dụng khi đến ngày.
5. **Rollback:** đánh dấu lịch sử của batch là `ROLLED_BACK`, sau đó tính lại snapshot từ bản ghi hợp lệ gần nhất; không xóa dấu vết.

## 8. API và giao diện đã triển khai

API riêng dưới `/api/v1/hr/salary-raises`:

- Import/upload và danh sách batch.
- Preview phân trang.
- Validate.
- Confirm với confirmation key.
- Rollback có lý do bắt buộc.
- Lấy lịch sử lương theo nhân viên.

Trang **Nhập dữ liệu nhân sự** có thêm chế độ **Nâng lương**. Preview tối thiểu hiển thị:

```text
MS | Họ tên | Lương DB | Lương file | Lương mới | Chênh lệch
   | Bậc cũ → mới | Hiệu lực | Tới hạn | Trạng thái/lỗi
```

Hồ sơ nhân viên bổ sung:

- Lương cơ bản, phụ cấp và tổng hiện hành.
- Bậc/mã ngạch hiện hành.
- Ngày nâng gần nhất và ngày tới hạn.
- Lịch sử thay đổi lương theo thời gian.

Form hồ sơ không ghi trực tiếp `baseSalary`/`allowance` sau khi module được bật. Nút sửa lương dẫn sang luồng thay đổi lương thủ công có ngày hiệu lực, lý do và audit.

## 9. Phases triển khai

### Phase 0 — Contract và fixture

**Trạng thái: hoàn thành.**

- Khóa mapping file mẫu và tên header alias có hậu tố năm.
- Tạo fixture tối giản từ file mẫu, không đưa dữ liệu thừa/PII vào test.
- Chốt quy tắc ngày tới hạn theo file và cảnh báo lệch ngày.
- Viết acceptance matrix cho A339.

**Hoàn thành khi:** parser contract và kết quả kỳ 6/7 của A339 được mô tả bằng test case rõ ràng.

### Phase 1 — Schema và domain lịch sử

**Trạng thái: hoàn thành bằng migration V27.**

- Migration kế tiếp sau V26 cho import type, bảng lịch sử, index, FK và CHECK constraints.
- Entity/repository/service tra lương theo ngày.
- Cơ chế snapshot hiện hành và idempotency.
- Unit test timeline, future-effective và rollback.

**Hoàn thành khi:** có thể tạo lịch sử lương và truy vấn đúng mức trước/sau 01/07/2026 mà chưa cần UI.

### Phase 2 — Parser, staging và validation

**Trạng thái: hoàn thành.**

- `HrSalaryRaiseWorkbookParser` riêng; không sửa parser baseline khóa cứng để nhận file mới.
- Nhận diện sheet/header, đọc ngày và tiền bằng Apache POI.
- Stage vào batch/rows, preview phân trang và validate toàn batch.
- Chặn mismatch DB/file, duplicate `MS`, tổng sai và stale data.
- Trả issue code/message ổn định cho frontend.

**Hoàn thành khi:** file mẫu preview ra A339 với mức cũ 8.539.000, mức mới 8.938.000 và cảnh báo ngày tới hạn nhưng chưa đổi DB.

### Phase 3 — Confirm, lịch hiệu lực và rollback

**Trạng thái: hoàn thành.**

- Confirm all-or-nothing trong transaction ngắn, có lock và confirmation key.
- Áp dụng ngay thay đổi quá khứ/hiện tại.
- Lưu `SCHEDULED` và job áp dụng thay đổi tương lai.
- Rollback có lý do, tính lại snapshot an toàn khi đã có thay đổi sau đó.
- Audit upload/validate/confirm/apply/rollback, không log payload lương đầy đủ.

**Hoàn thành khi:** confirm file mẫu làm mức từ 01/07/2026 thành 8.938.000 nhưng truy vấn 30/06/2026 vẫn trả 8.539.000.

### Phase 4 — UI import và hồ sơ nhân viên

**Trạng thái: hoàn thành.**

- Chế độ Nâng lương trong trang import.
- KPI batch, preview old/new/delta, banner và lỗi từng dòng.
- Toast khi mismatch; disable confirm khi còn lỗi.
- Lịch sử lương và thông tin tới hạn trong hồ sơ nhân viên.
- Chỉ ADMIN thấy thao tác confirm/rollback.

**Hoàn thành khi:** người dùng thực hiện trọn luồng upload → preview → validate → confirm và xem lịch sử mà không cần gọi API thủ công.

### Phase 5 — Export theo thời điểm và khóa sửa trực tiếp

**Trạng thái: hoàn thành cho luồng import.**

- Sửa export tháng/năm để lấy lương theo kỳ cần xuất.
- Tháng 6/2026 xuất mức cũ; tháng 7/8/9 xuất mức mới.
- Bỏ cập nhật trực tiếp lương/phụ cấp từ form hồ sơ.
- Mọi thay đổi lương hiện đi qua batch import có ngày hiệu lực; chưa mở endpoint sửa tay bỏ qua file.

**Hoàn thành khi:** export lại kỳ cũ không bị thay đổi bởi snapshot lương hiện tại và mọi thay đổi lương đều có history/audit.

### Phase 6 — Hardening và rollout

**Trạng thái: gate chính local hoàn thành; test concurrency/API-security E2E và rollout production chưa thực hiện.**

- Test API 401/403 và ADMIN-only cho confirm/rollback.
- Test file lớn, duplicate upload, formula/error cell, concurrent confirm, scheduled apply và rollback nhiều lớp.
- Cập nhật verify schema, backup/restore runbook và tài liệu vận hành.
- Chạy backend tests, frontend lint/build, `git diff --check` và smoke test trên bản sao DB trước rollout.
- Chạy smoke test trên bản sao dữ liệu production và triển khai theo maintenance window còn là bước vận hành tiếp theo.

**Hoàn thành khi:** gate local đạt, migration đã thử trên bản sao DB và có phương án rollback không xóa lịch sử.

## 10. Acceptance bắt buộc với file mẫu

1. Ghép `A339` với Lê Minh Toàn chỉ bằng `MS`.
2. Preview tính đúng chênh lệch `+399.000` và khoảng `6,00%` trên lương cơ bản.
3. Confirm tạo history hiệu lực `01/07/2026`.
4. Truy vấn/xuất tháng 6 trả tổng `8.539.000`.
5. Truy vấn/xuất tháng 7, 8, 9 trả tổng `8.938.000`.
6. Lưu hạn `48 tháng`, hiển thị `4 năm`.
7. Giữ `NGÀY TỚI HẠN` đúng theo file; nếu lệch phép cộng tháng lịch thì chỉ cảnh báo.
8. Nếu DB không còn lương `6.647.000` hoặc phụ cấp `1.892.000` tại thời điểm xác nhận, chặn batch và hiển thị thông báo.
9. Rollback khôi phục snapshot đúng nhưng vẫn giữ audit/history.

## 11. Ngoài phạm vi hiện tại

- Tính bảng lương, thuế, bảo hiểm hoặc prorate theo ngày.
- Tự động nâng lương khi đến ngày tới hạn.
- Gửi email/Telegram nhắc tới hạn.
- Thay đổi phòng ban, chức danh hoặc ngày làm từ file nâng lương.
- Tự suy đoán nhân viên theo họ tên khi thiếu/sai `MS`.
