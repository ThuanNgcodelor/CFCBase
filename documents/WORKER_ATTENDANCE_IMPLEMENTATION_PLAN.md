# Kế hoạch triển khai Chấm công ca sản xuất

- Ngày lập: **11/09/2026**.
- Phạm vi: **Công nhân và KCS** trong chức năng Chấm công của CFCBase.
- Trạng thái: **Phase 1–6 đã hoàn tất ở source và kiểm thử local; Phase 7 chưa shadow/nghiệm thu production**.
- Nguồn nghiệp vụ: [WORKER_ATTENDANCE_HR_REVIEW.md](WORKER_ATTENDANCE_HR_REVIEW.md).
- Hướng sử dụng: [WORKER_ATTENDANCE_USAGE_GUIDE.md](WORKER_ATTENDANCE_USAGE_GUIDE.md).

## 1. Mục tiêu

Từ file giờ chấm do Time Attendance xuất, hệ thống phải:

1. Giữ nguyên toàn bộ dòng ngày và dấu chấm gốc để đối soát.
2. Ghép đúng ca cùng ngày hoặc qua ngày/tháng.
3. Nhận diện `HC`, `KCS-Ca2`, `CN-6h-15h`, `CN-6h-18h`, `CN-6h-20h` và `CN-18h-5h`.
4. Quy đổi trực tiếp về 0; 1; 1,5; hoặc 2 công, không tạo số lẻ kiểu 1,43.
5. Tính riêng 50.000 đồng cho mỗi ca đêm hợp lệ/đã được xác nhận.
6. Không tự suy ra phép hoặc loại nghỉ. Phần này do anh Thọ xác nhận ở quy trình riêng.
7. Cho HR kiểm tra và xác nhận những trường hợp thiếu dấu chấm, mơ hồ hoặc chịu ảnh hưởng bởi sự cố máy.
8. Hiển thị trên web và xuất Excel từ cùng một kết quả đã xác nhận.

Luồng chấm công hành chính hiện tại phải tiếp tục hoạt động trong suốt quá trình triển khai.

## 2. Quyết định về sự cố máy chấm công

Người dùng xác nhận có sự cố máy vào buổi tối ngày 17/08/2026. Thời gian bắt đầu/kết thúc chính xác, máy và phạm vi nhân viên bị ảnh hưởng chưa có trong file Excel nên không được tự suy đoán.

Sự cố máy được xử lý như một sự kiện nghiệp vụ, không phải hàng loạt nhân viên cùng “quên chấm”:

- HR khai báo khoảng thời gian sự cố, mô tả, phạm vi phòng ban/mã nhân viên hoặc toàn công ty.
- Hệ thống tìm các ca có lượt bị thiếu trong khoảng ảnh hưởng và đưa ra danh sách đề xuất.
- Nếu một phía có dấu chấm thật và phía còn lại bị thiếu đúng khoảng sự cố, hệ thống có thể đề xuất công theo ca nhận diện.
- Hệ thống không tạo một thời điểm chấm giả. Trường `check_in_at` hoặc `check_out_at` thực tế vẫn để trống.
- Kết quả chỉ được tính chính thức sau khi người có quyền xác nhận; quyết định lưu lý do `DEVICE_OUTAGE`, người xác nhận và thời gian xác nhận.
- Không có cả hai lượt chấm thì mặc định 0 công/cần kiểm tra, không tự tạo ca chỉ vì có sự cố.
- Một sự cố có thể được áp dụng hàng loạt nhưng từng ca bị ảnh hưởng vẫn phải truy vết được về sự cố đó.

Trước khi nhập sự cố 17/08 vào dữ liệu thật, HR cần chọn chính xác thời gian và phạm vi ảnh hưởng trên màn hình. Việc này không chặn triển khai chức năng.

## 3. Kiến trúc chức năng

### 3.1 Giao diện

Giữ một mục **Chấm công** trên menu. Bên trong chia:

- **Hành chính:** chức năng hiện có.
- **Ca sản xuất:** chức năng mới.

Trong **Ca sản xuất** có các chế độ xem:

- Tất cả.
- Công nhân.
- KCS.
- Cần kiểm tra.
- Sự cố máy.
- Đã xác nhận.

Đây là các chế độ xem trên cùng dữ liệu, không tạo bảng/import riêng cho từng phòng ban.

### 3.2 Nhóm chính sách

Không dùng phòng ban làm luật tính công duy nhất. Mỗi nhân viên được gắn một nhóm chính sách theo thời gian hiệu lực:

- `OFFICE`: hành chính.
- `PRODUCTION_WORKER`: công nhân sản xuất.
- `KCS`: có thể nhận diện HC hoặc KCS ca 2 theo từng ngày.

`HrWorkforceGroup.GENERAL_LABOR` có thể hỗ trợ đề xuất `PRODUCTION_WORKER`, nhưng không thay thế bảng chính sách chấm công theo thời gian. KCS không được gắn cứng theo toàn bộ phòng ban.

Miễn chấm không phải một nhóm chính sách. Nó là ngoại lệ có thời gian hiệu lực được kiểm tra riêng, vì một nhân viên vẫn thuộc nhóm chính sách bình thường trước và sau chuyến công tác.

## 4. Mô hình dữ liệu đề xuất

Migration đã triển khai là `V21__add_hr_production_attendance.sql`. Không sửa lại V15/V16 đã chạy.

### 4.1 `hr_attendance_shift_policies`

Lưu cấu hình ca có phiên bản:

- `code`, `name`, `policy_group`.
- Giờ chuẩn bắt đầu/kết thúc.
- Cửa nhận lượt vào/ra.
- `crosses_midnight`.
- `night_allowance_amount`.
- `priority`, `active`, `valid_from`, `valid_to`.
- Audit/version theo chuẩn HR hiện tại.

Ca dùng để nhận diện loại công việc; mức công ca ngày được quyết định bởi bảng ngưỡng riêng ở mục 4.2. Seed ban đầu:

| Mã ca | Nhóm | Cách xác định kết quả |
|---|---|---|
| `HC` | OFFICE/KCS | 1 công theo ca |
| `KCS_CA2` | KCS | 1 công theo ca |
| `CN_6_15` | PRODUCTION_WORKER | Theo ngưỡng ca ngày, nhóm 1 công |
| `CN_6_18` | PRODUCTION_WORKER | Theo ngưỡng ca ngày; có thể là 1,5 hoặc 2 tùy mốc ra đã cấu hình |
| `CN_6_20` | PRODUCTION_WORKER | Theo ngưỡng ca ngày, tối đa 2 công |
| `CN_18_5` | PRODUCTION_WORKER | 1,5 công + 50.000 đồng |

Các cửa thời gian là cấu hình, không hard-code vào Java.

### 4.2 `hr_attendance_work_credit_rules`

Tách quy đổi công khỏi tên ca để không mâu thuẫn giữa tên `CN-6h-18h` và giờ ra thực tế:

- Nhóm chính sách/ca áp dụng.
- Mốc giờ ra từ/đến hoặc điều kiện tương ứng.
- `work_value` chỉ nhận 0; 1; 1,5; hoặc 2.
- `valid_from`, `valid_to`, `priority`, version và audit.

Seed thử nghiệm cho nhóm ca ngày:

- Nhóm kết thúc khoảng 14:00 → 1 công.
- Nhóm kết thúc khoảng 16:00 và các mẫu 17:12–17:34 → 1,5 công.
- Từ mốc cấu hình thử nghiệm 17:45 trở đi → 2 công.

Khoảng 17:35–17:44 và hai phía của mọi ranh giới phải có hành vi cấu hình rõ ràng hoặc đi vào `NEEDS_REVIEW`; không để khoảng thời gian vô tình rơi qua nhánh mặc định. Mốc 17:45 chỉ được chốt production sau khi HR nghiệm thu thêm dữ liệu sát biên.

### 4.3 `hr_employee_attendance_policies`

- `employee_id`.
- `policy_group`.
- `valid_from`, `valid_to`.
- `source`, `reason`.
- Không cho phép hai chính sách hiệu lực chồng lấn cho cùng nhân viên.

Phòng ban và `workforce_group` chỉ dùng để đề xuất khi tạo cấu hình; kết quả đã xác nhận phải giữ snapshot nhóm chính sách đã áp dụng.

### 4.4 `hr_attendance_punches`

Lưu dấu chấm bất biến:

- `import_id`, `employee_id`, `employee_code`.
- `punched_at` dạng ngày giờ đầy đủ.
- `source_row_number`, `source_column`, `raw_value`.
- `normalized_name`, trạng thái đối chiếu nhân viên.
- Khóa chống trùng theo import + dòng + cột.

Không gán cố định G là check-in và H là check-out. Mọi cột G–J có dữ liệu đều được giữ.

### 4.5 `hr_attendance_shifts`

Lưu ca đã ghép hoặc đề xuất:

- Nhân viên, `work_date` là ngày bắt đầu ca.
- `check_in_punch_id`, `check_out_punch_id`.
- `check_in_at`, `check_out_at` dạng ngày giờ đầy đủ.
- `shift_policy_id`, `work_credit_rule_id` và snapshot mã/phiên bản đã áp dụng.
- `work_value`, `night_allowance_amount`.
- Trạng thái: `AUTO_MATCHED`, `NEEDS_REVIEW`, `CONFIRMED`, `REJECTED`.
- `resolution_type`: `NORMAL`, `MISSING_PUNCH`, `DEVICE_OUTAGE`, `MONTH_BOUNDARY`, `MANUAL_OVERRIDE`.
- `explanation`, `confirmed_at`, `confirmed_by_actor`.
- Ràng buộc một dấu chấm không được dùng cho hai ca đã xác nhận.

### 4.6 `hr_attendance_shift_adjustments`

Lịch sử bất biến cho mọi điều chỉnh:

- Ca bị sửa.
- Trước/sau dưới dạng JSON đã làm sạch.
- Lý do bắt buộc.
- Người thao tác và thời gian.
- Liên kết sự cố máy nếu có.

Không ghi đè làm mất quyết định cũ.

### 4.7 `hr_attendance_incidents`

- Loại `DEVICE_OUTAGE`.
- `started_at`, `ended_at`.
- Phạm vi: toàn công ty, phòng ban, nhóm chính sách hoặc danh sách nhân viên.
- Mô tả, trạng thái `DRAFT`, `CONFIRMED`, `CANCELLED`.
- Người tạo/xác nhận và audit.

### 4.8 `hr_attendance_exemptions`

Thay danh sách mã toàn cục bằng cấu hình có hiệu lực:

- Nhân viên/mã nhân viên.
- `valid_from`, `valid_to`.
- Lý do như đi công tác/thị trường.
- Trạng thái và người xác nhận.

Dữ liệu gốc vẫn được giữ; mặc định người miễn chấm không đi vào KPI và bảng công chính.

## 5. Luồng xử lý dữ liệu

### Bước 1 — Import

1. Chọn kỳ và tải một hoặc nhiều file.
2. Lưu checksum, cấu hình/phiên bản chính sách và metadata nguồn.
3. Đọc đầy đủ mã, tên, ngày và mọi lượt chấm G–J.
4. Làm sạch `_x0000_` ở tên hiển thị nhưng giữ `raw_value`.
5. Đối chiếu nhân viên bằng mã; không tạo nhân viên mới từ file chấm công.
6. Lưu dấu chấm gốc trước khi chạy nhận diện.

### Bước 2 — Dựng chuỗi thời gian

1. Gom dấu chấm theo nhân viên.
2. Sắp xếp bằng ngày giờ đầy đủ.
3. Đọc thêm đầu tháng kế tiếp/cuối tháng trước khi cần ghép ca qua kỳ.
4. Đánh dấu các khoảng miễn chấm trước khi tạo ca.

### Bước 3 — Nhận diện ca

1. Lấy nhóm chính sách có hiệu lực tại ngày bắt đầu ca.
2. Sinh các ứng viên ca phù hợp với nhóm đó.
3. Ưu tiên cặp vào/ra khớp một ca duy nhất và không tái sử dụng dấu chấm.
4. Ca cùng ngày và ca qua ngày dùng hai chiến lược ghép riêng.
5. Nếu không khớp hoặc có nhiều kết quả cùng mức ưu tiên, đặt `NEEDS_REVIEW` thay vì tự cho 0.
6. Không tạo ca nối tiếp/kéo dài hơn một ngày.
7. Nhiều dấu chấm lặp được giữ nguyên; chọn cặp hợp lệ, phần còn lại được đánh dấu chưa sử dụng/để đối soát.

### Bước 4 — Tính công

- Công lấy từ quy tắc quy đổi có version của ca/chính sách đã nhận diện, không lấy tổng giờ chia 8.
- Kết quả hợp lệ chỉ là 0; 1; 1,5; hoặc 2.
- Ca đêm được 1,5 công và 50.000 đồng phụ cấp riêng.
- Chủ nhật/ngày lễ không tự thêm hệ số.
- Phép/nghỉ không được suy ra từ dấu chấm trống.
- Thiếu một lượt luôn vào review; chỉ sự cố máy hoặc quyết định thủ công có lý do mới cho phép xác nhận công.
- Không có cả hai lượt thì 0 công/cần kiểm tra theo chính sách, không tự điền hai lượt.

### Bước 5 — Tính lại

Thêm thao tác **Tính lại theo cấu hình mới**:

- Không yêu cầu tải lại file.
- Chạy lại từ `hr_attendance_punches` bất biến.
- Không sửa batch đã chốt; tạo revision/kết quả tính mới.
- Nếu kỳ đã khóa, chỉ người có quyền mở khóa/điều chỉnh mới được thay đổi.

## 6. API dự kiến

Các API nằm dưới `/api/v1/hr/attendance/production`:

| Method | Endpoint | Mục đích |
|---|---|---|
| GET/PUT | `/shift-policies` | Xem/cập nhật cấu hình ca có version |
| GET/POST | `/employee-policies` | Gán nhóm luật theo nhân viên/thời gian |
| GET/POST | `/exemptions` | Quản lý miễn chấm theo thời gian |
| POST | `/exemptions/{id}/cancel` | Hủy miễn chấm có lý do và optimistic version |
| POST | `/imports` | Import file ca sản xuất |
| POST | `/imports/{id}/recalculate` | Tính lại từ dấu chấm gốc |
| GET | `/imports/{id}/punches` | Xem dấu chấm gốc |
| GET | `/shifts` | Danh sách ca và bộ lọc |
| PUT | `/shifts/{id}/decision` | Chọn ca/điều chỉnh/xác nhận có lý do |
| GET | `/shifts/{id}/adjustments` | Xem lịch sử trước/sau của ca |
| POST | `/shifts/bulk-confirm` | Xác nhận hàng loạt các ca đã chọn |
| GET/POST | `/incidents` | Khai báo sự cố máy |
| POST | `/incidents/{id}/analyze` | Xem các ca có thể bị ảnh hưởng |
| POST | `/incidents/{id}/confirm` | Xác nhận áp dụng sự cố |
| GET | `/summary` | Tổng hợp kỳ đã xác nhận |
| GET | `/summary/export` | Xuất bảng công ngang |

Mọi API ghi dữ liệu lấy actor từ principal đăng nhập, yêu cầu lý do cho điều chỉnh và ghi `HrAuditEvent`. Không nhận actor/user id từ request body.

## 7. Giao diện ca sản xuất

### 7.1 Đầu trang

- Chọn tháng.
- Import nhiều file.
- Trạng thái kỳ: đang xử lý/đã chốt.
- Nút tính lại, xác nhận kỳ, xuất Excel.

### 7.2 KPI

- Tổng nhân viên.
- Tổng công dạng số thập phân.
- Số ca ngày/ca đêm.
- Tổng phụ cấp đêm.
- Số ca cần kiểm tra.
- Số ca chịu ảnh hưởng sự cố máy.
- Số người miễn chấm.

### 7.3 Bảng review

Mỗi dòng hiển thị:

- Mã, tên, phòng ban/nhóm chính sách.
- Ngày bắt đầu ca.
- Toàn bộ dấu chấm gốc.
- Ca đề xuất, giờ vào/ra đã ghép.
- Công, phụ cấp đêm.
- Trạng thái và giải thích vì sao hệ thống chọn/không chọn được ca.
- Liên kết sự cố máy hoặc miễn chấm.
- Nút chọn lại ca, xác nhận, từ chối và xem lịch sử.

Giờ máy và kết quả suy ra phải hiển thị tách biệt. Không cho phép sửa trực tiếp dấu chấm gốc.

### 7.4 Màn hình sự cố máy

1. Chọn bắt đầu/kết thúc sự cố.
2. Chọn phạm vi ảnh hưởng.
3. Nhập lý do.
4. Bấm **Phân tích ảnh hưởng**.
5. Xem từng ca được đề xuất và lý do.
6. Chọn ca hợp lệ rồi xác nhận hàng loạt.
7. Có nút hủy bản nháp/hủy sự cố; không xóa lịch sử sự cố đã xác nhận.

## 8. Tổng hợp và xuất Excel

File xuất giữ bố cục một nhân viên/một dòng:

- STT, mã nhân viên, họ tên.
- Ngày 1–31, giữ đủ ngày trong tháng.
- Tổng công bằng tổng `work_value`, không đếm số dòng có công.
- Số ca đêm và tổng phụ cấp đêm.
- Đi trễ/về sớm nếu đã có quy tắc.
- Các cột phép/nghỉ chỉ nhận dữ liệu đã xác nhận từ quy trình của anh Thọ nếu sau này tích hợp; không tự điền từ chấm công.
- Có sheet đối soát gồm ca cần kiểm tra, dấu chấm chưa dùng, sự cố máy và các điều chỉnh.

Số trên web và Excel phải lấy từ cùng query/kết quả kỳ đã xác nhận.

## 9. Các phase triển khai

### Phase 1 — Nền dữ liệu và cấu hình

**Trạng thái local: Hoàn tất.** V21 tạo 10 bảng mới, seed policy/rule, entity/repository/enums và kiểm thử Flyway/schema đã chạy thành công.

- Tạo migration V21 và entity/repository/enums.
- Seed các ca và ngưỡng quy đổi đã chốt.
- Thêm chính sách theo nhân viên và miễn chấm có thời gian hiệu lực.
- Viết test migration/schema/index/unique constraint.

**Nghiệm thu:** ứng dụng khởi động với DB mới; không ảnh hưởng V15/V16 và tab hành chính.

### Phase 2 — Parser và lưu dấu chấm gốc

**Trạng thái local: Hoàn tất.** Parser giữ ngày trống và toàn bộ lượt G–J. Đã đối soát `CongXn.xlsx` cùng bộ 9 file phòng ban cục bộ: 2.759 dòng, 89 mã và 3.386 lượt chấm. Test bộ phòng ban tự skip nếu fixture cục bộ không có trong checkout.

- Tách parser file khỏi `HrAttendanceService` hiện tại.
- Hỗ trợ G–J, ngày chuỗi/Excel date và tên có `_x0000_`.
- Lưu ngày giờ đầy đủ, mã nguồn dòng/cột và chống trùng.
- Import thử toàn bộ `CongXn.xlsx` và 9 file phòng ban.

**Nghiệm thu:** giữ đủ 2.759 dòng phòng ban/89 mã và toàn bộ dấu chấm; không còn gọi một dòng có giờ là “không chấm”.

### Phase 3 — Máy ghép ca và tính công

**Trạng thái local: Hoàn tất.** Matcher tất định hỗ trợ cùng ngày/qua ngày/qua tháng, không tái sử dụng dấu chấm và giữ trường hợp thiếu lượt ở review. Khi import tháng mới, các batch `PREVIEWED` của tháng liền trước có cùng mã nhân viên được tự tính lại để nhận lượt ra đầu tháng; lượt này được giữ chỗ trước khi tính tháng mới. Đã sửa ánh xạ SQL `TIME` bằng JDBC `LOCAL_TIME` để policy không bị lệch múi giờ.

- Xây bộ matcher tất định theo policy version.
- Hỗ trợ cùng ngày, qua ngày và qua tháng.
- Bảo đảm một dấu chấm chỉ dùng một lần.
- Tính 0/1/1,5/2 và phụ cấp đêm.
- Đưa trường hợp mơ hồ/thiếu lượt vào `NEEDS_REVIEW`.

**Nghiệm thu:** B124 có 31 ô ngày, ngày 09 = 0, ngày 25/30/31 = 1,5, tổng 45 công, 19 ca đêm và 950.000 đồng phụ cấp.

### Phase 4 — Sự cố máy, miễn chấm và review

**Trạng thái local: Hoàn tất.** Có import/recalculate revision, quyết định thủ công, bulk confirm, lịch sử adjustment, exemption tạo/hủy, incident draft/analyze/confirm/cancel và audit. Integration test xác nhận xử lý sự cố không sinh giờ chấm giả.

- CRUD bản nháp/xác nhận/hủy sự cố.
- Phân tích ca bị ảnh hưởng và xác nhận hàng loạt.
- Điều chỉnh ca có lý do và lịch sử trước/sau.
- Tính lại từ dấu chấm gốc.
- Mặc định loại người miễn chấm khỏi KPI nhưng vẫn cho xem đối soát.

**Nghiệm thu:** mô phỏng sự cố tối 17/08; không sinh giờ giả, ca được tính chỉ sau xác nhận và truy vết được về sự cố.

### Phase 5 — Giao diện

**Trạng thái local: Hoàn tất.** Tab **Hành chính/Ca sản xuất** dùng chung route Chấm công. Tab ca sản xuất đã có import nhiều file, KPI, bộ lọc, bảng review desktop/mobile, xem dấu chấm gốc và lịch sử, cấu hình ca/ngưỡng công/chính sách nhân viên/miễn chấm, xử lý sự cố và quyền mở khóa dành riêng cho ADMIN.

- Tách tab Hành chính/Ca sản xuất.
- Thêm bộ lọc Công nhân/KCS/Cần kiểm tra/Sự cố.
- Bảng review, chi tiết dấu chấm và lịch sử.
- Cấu hình ca/chính sách/miễn chấm.
- Responsive cho desktop và điện thoại.

**Nghiệm thu:** HR hoàn thành import → review → xử lý sự cố → xác nhận mà không chỉnh DB/file thủ công.

### Phase 6 — Tổng hợp và xuất Excel

**Trạng thái local: Hoàn tất.** Tổng hợp chỉ đọc file `CONFIRMED`, cộng `BigDecimal work_value`, khử trùng theo mã nhân viên/ngày và cảnh báo dòng nguồn trùng. Excel có sheet **Bảng công** đủ ngày 1–31 và sheet **Đối soát** cho ca bất thường, dòng trùng, dấu chưa dùng và lịch sử điều chỉnh. File đã chốt chỉ xem; ADMIN phải nhập lý do để mở khóa trước khi sửa.

- Tổng công dùng `BigDecimal` và phép cộng `work_value`.
- Xuất đúng bố cục bảng ngang.
- Thêm số ca đêm/phụ cấp và sheet đối soát.
- Khóa kỳ sau xác nhận; điều chỉnh sau khóa phải có quyền/lý do.

**Nghiệm thu:** web và Excel khớp tuyệt đối; không còn 39,68 cho B124.

### Phase 7 — Kiểm thử hồi quy và bật production

**Trạng thái: Chưa nghiệm thu production.** Full suite backend local ngày 11/09/2026 có 188 test case: 187 pass, 0 failure/error và 1 fixture tùy chọn skipped. Frontend build/lint đạt; lint còn 10 cảnh báo unused có sẵn ngoài trang ca sản xuất. Đây không thay thế shadow run và ký nghiệm thu HR.

- Test backend, frontend và migration.
- Chạy shadow trên bộ tháng 08, chưa ghi đè báo cáo chính thức.
- HR soát B124, 9 công nhân và các mẫu KCS/khối văn phòng.
- Bật feature flag sau khi ký nghiệm thu.

**Nghiệm thu:** tab hành chính vẫn cho kết quả cũ; ca sản xuất chỉ dùng dữ liệu đã xác nhận; có phương án tắt feature flag mà không mất dữ liệu.

## 10. Bộ kiểm thử bắt buộc

### Quy tắc ca

- 06:00–14:00 → 1.
- Nhóm 06:00–16:00/17:12–17:34 → 1,5.
- Mốc 17:45 và hai phía của mốc phải được test theo cấu hình.
- 17:59/18:01 và nhóm ca dài → 2.
- 13:00–22:00 → KCS ca 2, không phải `NO_PUNCH`.

### Ca đêm

- 17:30–04:30 → 1,5 + 50.000.
- 17:30–05:30 → 1,5 + 50.000.
- 18:30–04:30 → 1,5 + 50.000.
- 18:30–05:30 → 1,5 + 50.000.
- Ca cuối tháng ghép lượt đầu tháng sau về tháng bắt đầu.
- Không cộng lại lượt ra sáng hôm sau thành ca mới.
- Import tháng sau tự tạo revision cho batch tháng trước có cùng mã nhân viên; lượt ra đầu tháng chỉ được dùng đúng một lần giữa hai batch.

### Thiếu lượt và sự cố

- Một lượt, không có sự cố → cần kiểm tra.
- Một lượt nằm trong sự cố đã xác nhận → đề xuất, chưa tự chốt.
- Không có cả hai lượt → không tự tạo ca.
- Hủy sự cố nháp không thay đổi ca.
- Sự cố đã xác nhận có audit và không xóa cứng.

### Dữ liệu thực tế

- `CongXn.xlsx`: đủ 9 người × 31 ngày.
- Bộ `FileChamCong/`: đủ 89 người × 31 ngày.
- A057 KCS khoảng 13:00–22:00 được nhận diện.
- Mã ít chấm ở KD/KHVT chỉ bị loại khi có exemption hiệu lực, không dựa trên số lượt.
- Dấu chấm sau 20:00 không bị loại chỉ vì vượt khung hành chính.
- Dòng có 3–4 dấu chấm giữ đủ dữ liệu và không dùng một dấu cho hai ca.

### Hồi quy

- Import/xem trước/xác nhận/xuất chấm công hành chính vẫn chạy.
- API bảo vệ trả 401 khi không đăng nhập và 403 khi không đủ quyền.
- `git diff --check`, backend test, frontend lint/build.

## 11. Thứ tự code cụ thể

1. V21 + enums/entities/repositories.
2. `HrProductionAttendanceWorkbookParser` và test fixture.
3. `HrProductionShiftMatcher` thuần Java, không phụ thuộc DB, với toàn bộ test biên.
4. Service import/recalculate/summary.
5. Service sự cố, exemption, review và audit.
6. Controller/DTO/API frontend.
7. Tách component `HrAttendance` và xây tab Ca sản xuất.
8. Export Excel và test đối chiếu.
9. Chạy full validation và cập nhật tài liệu sử dụng/deploy.

Không bắt đầu bằng giao diện hoặc sửa trực tiếp `parseRow` hành chính. Phần khó nhất là mô hình dấu chấm đầy đủ và máy ghép ca; hai phần này phải có test trước khi nối UI.

## 12. Điều kiện hoàn tất

Chức năng chỉ được xem là hoàn tất khi:

- Đạt toàn bộ mẫu nghiệm thu B124.
- Không rớt ca KCS 13:00–22:00.
- Sự cố máy được xử lý có phạm vi, xác nhận và audit; không có giờ giả.
- Tổng công cộng đúng 1/1,5/2 thay vì đếm số ngày.
- Phép/nghỉ vẫn thuộc quy trình của anh Thọ.
- Người đi công tác được loại theo exemption có hiệu lực.
- Web và Excel dùng cùng dữ liệu đã xác nhận.
- Tab hành chính không bị thay đổi kết quả.
- Backend tests, frontend lint/build và migration validation đều đạt.
- Trạng thái production được xác minh riêng; test local không được ghi nhận thay cho nghiệm thu production.
