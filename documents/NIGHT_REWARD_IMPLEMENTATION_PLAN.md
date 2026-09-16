# Kế hoạch triển khai — Thưởng gắn bó ca đêm

> **Trạng thái:** Kế hoạch nghiệp vụ/kỹ thuật, chưa thay đổi số tiền lương hoặc tạo khoản chi trả.
>
> **Nguồn chính sách:** Thông báo chương trình thưởng gắn bó lâu dài và ca đêm của Công ty, hiệu lực từ **01/08/2026**.
> **Cập nhật:** 16/09/2026 (Asia/Ho_Chi_Minh).

## 1. Mục tiêu

Tạo một module riêng để Phòng TCHC và Kế toán có thể:

1. Đếm đúng **ca đêm hợp lệ** của từng người trong từng tháng.
2. Chốt một kết quả thưởng tháng có bằng chứng là các ca nguồn đã chốt.
3. Bảo lưu số tháng đạt điều kiện dù các tháng sau không đạt.
4. Theo dõi hai chu kỳ độc lập: thưởng ca đêm định kỳ 12 tháng và thưởng gắn bó 24 tháng.
5. Tạo khoản chờ chi trả, đối soát với payroll và giữ lịch sử không thể sửa/xóa âm thầm.

Module này **không dùng** chỉ số vận hành `Ca đêm + tăng ca` làm điều kiện thưởng. Chỉ số đó hiện cộng số ca đêm với số ca có 2 công; chính sách mới chỉ yêu cầu số ca đêm hợp lệ.

## 2. Hiện trạng đã có trong CFCBase

Ca sản xuất đã lưu được nền tảng cần thiết, nhưng chưa có sổ thưởng dài hạn:

| Nội dung | Hiện có | Giới hạn hiện tại |
| --- | --- | --- |
| Dấu chấm và ngày nguồn | Lưu theo file import, nhân viên, ngày và cột nguồn G–J | Là dữ liệu chấm công, chưa là chứng từ thưởng |
| Ca đã ghép | Lưu `employee`, `workDate`, mã ca, công, phụ cấp, trạng thái, người xác nhận | Có thể bị ảnh hưởng nếu ADMIN mở khóa kỳ để sửa |
| Ca đêm tháng | Báo cáo tháng đếm ca đã `CONFIRMED` theo người | Tính động; chưa chốt snapshot `đạt/không đạt` |
| Ca đêm `CN_18_5` | Ca qua ngày, 1,5 công, phụ cấp đêm hiện hành | Phụ cấp đêm không được dùng làm điều kiện thưởng lâu dài |
| Đối soát | Có lịch sử điều chỉnh, dấu chưa dùng và dòng trùng nguồn | Chưa có ledger/bút toán thưởng |
| Payroll/Telegram | Có import lương, snapshot campaign, PDF và gửi Telegram | Chưa nhận khoản thưởng từ attendance |

Vì vậy, câu trả lời chính xác ở thời điểm này là: **ca đêm đã được lưu theo từng nhân viên/ngày/tháng import; nhưng hệ thống chưa lưu “10 đêm đạt điều kiện”, số tháng bảo lưu, tiến độ 12/24 hay khoản thưởng phải trả.**

## 3. Quy tắc tính theo thông báo

### 3.1 Một ca được tính là ca đêm hợp lệ

Một ca chỉ được đưa vào chương trình khi đồng thời thỏa các điều kiện:

1. Thuộc một chính sách ca có cờ riêng `counts_toward_night_reward = true`; mặc định có thể áp dụng cho `CN_18_5` sau khi HR xác nhận.
2. Thuộc người lao động đủ đối tượng tham gia ở tháng đó.
3. Ca có trạng thái `CONFIRMED`, có công lớn hơn 0 và thuộc file chấm công đã chốt.
4. Được đếm duy nhất theo **mã nhân viên + ngày bắt đầu ca**. Ca 31/08–01/09 thuộc tháng 08, không được đếm hai lần.
5. Không bị thay thế bởi revision mới hoặc bị vô hiệu do mở khóa/điều chỉnh có kiểm soát.

Không dùng `night_allowance_amount > 0` làm quy tắc chính thức: phụ cấp ca đêm có thể đổi theo chính sách lương, còn quyền tham gia chương trình thưởng là một chính sách riêng.

### 3.2 Kết quả của một tháng

| Kết quả | Điều kiện | Tác động |
| --- | --- | --- |
| `QUALIFIED` | Có từ 10 ca đêm hợp lệ | Cộng 01 tháng đủ điều kiện vào cả hai chu kỳ |
| `NOT_QUALIFIED` | Dưới 10 ca, không có ngoại lệ được duyệt | Không cộng tháng mới; giữ nguyên tiến độ cũ |
| `QUALIFIED_EXCEPTION` | Dưới 10 ca nhưng có quyết định ngoại lệ do Công ty duyệt | Cộng 01 tháng đủ điều kiện, giữ rõ số ca thực tế và lý do |
| `EXCLUDED` | Không thuộc đối tượng chương trình trong tháng | Không cộng, không coi là lỗi chấm công |
| `SUPERSEDED` | Bản kết quả cũ bị thay thế sau mở khóa/tính lại | Không xóa lịch sử; bản mới là bản đang hiệu lực |

Một tháng có 12 ca đêm vẫn chỉ tạo **01 tháng đủ điều kiện**. Hai ca dư không chuyển sang tháng sau.

### 3.3 Hai chu kỳ độc lập

| Nhánh quyền lợi | Ghi nhận mỗi tháng đạt | Chu kỳ | Khoản đủ điều kiện chi |
| --- | ---: | ---: | ---: |
| Thưởng ca đêm định kỳ | 500.000 đồng | 12 tháng đạt | 6.000.000 đồng |
| Thưởng gắn bó ca đêm | 1.000.000 đồng | 24 tháng đạt | 24.000.000 đồng |

Các tháng đạt **không cần liên tục**. Bộ đếm của hai nhánh không được dùng chung:

- Đạt tháng thứ 12: phát sinh quyền chi 6.000.000 đồng của nhánh định kỳ; nhánh gắn bó vẫn đang ở `12/24`.
- Đạt tháng thứ 24: phát sinh 6.000.000 đồng của chu kỳ định kỳ thứ hai và 24.000.000 đồng của nhánh gắn bó.
- Sau 24 tháng đạt, tổng quyền lợi đã đến hạn theo chính sách là **36.000.000 đồng**.

### 3.4 Ví dụ 10 → 8 → 12

| Tháng | Ca đêm hợp lệ | Kết quả | Định kỳ | Gắn bó |
| --- | ---: | --- | ---: | ---: |
| Tháng 1 | 10 | Đạt | 1/12 | 1/24 |
| Tháng 2 | 8 | Không đạt, bảo lưu | 1/12 | 1/24 |
| Tháng 3 | 12 | Đạt, chỉ tính một tháng | 2/12 | 2/24 |

Tháng 2 không làm mất kết quả tháng 1. Tháng 3 không bù hai ca thiếu của tháng 2; nó chỉ tăng bộ đếm thêm một tháng đạt.

Nếu một người đạt tối thiểu 10 ca đêm trong **12 tháng khác nhau** kể từ 01/08/2026, họ đủ quyền nhận **6.000.000 đồng** định kỳ. Điều này tương đương ít nhất 120 ca đêm, nhưng hệ thống xét theo từng tháng, không gom lẻ ca giữa các tháng.

### 3.5 Quy tắc đã được xác nhận

Quy tắc dưới đây đã được chốt trong trao đổi nghiệp vụ ngày 16/09/2026 và là test case nền của module:

```text
Tháng 1: 10 ca đêm hợp lệ  → đạt  → 1/12 và 1/24
Tháng 2: dưới 10 ca đêm    → không đạt, bảo lưu nguyên 1/12 và 1/24
Tháng 3: 12 ca đêm hợp lệ  → đạt  → 2/12 và 2/24
```

Điều này xác nhận rõ hai quy tắc: **không reset khi một tháng fail** và **một tháng đạt từ 10 ca trở lên chỉ cộng đúng một tháng**, kể cả khi có 12 ca.

## 4. Điểm phải chốt bằng văn bản trước khi lập trình

Các điểm dưới đây làm thay đổi quyền tiền, nên không được tự suy diễn từ source hoặc thông báo:

1. **Đối tượng:** chỉ công nhân trực tiếp sản xuất hay bao gồm KCS/nhân viên khác thuộc Khối Sản xuất?
2. **Ngày xác định nhân viên chính thức:** lấy trạng thái vào ngày đầu tháng, cuối tháng hay bất kỳ ngày nào trong tháng?
3. **Ca được tính:** chỉ `CN_18_5` hay mọi ca có cờ tham gia chương trình trong cấu hình?
4. **Ca thủ công/sự cố máy:** khi đã được HR xác nhận, có được xem là ca đêm hợp lệ không?
5. **Ngoại lệ do Công ty:** ai đề nghị, ai duyệt, chứng từ bắt buộc là gì và các mã lý do chuẩn nào được dùng?
6. **Chu kỳ vừa đủ nhưng chưa chi:** thông báo ghi “sau khi chi trả ... bộ đếm trở về 0”. Nếu payroll trả chậm, các tháng đạt tiếp theo sẽ được giữ ở đâu? Khuyến nghị là lưu thành các credit đang chờ mở chu kỳ mới, không bỏ sót và cũng không reset trái quy chế.
7. **Chấm dứt/kỷ luật, qua đời, suy giảm khả năng lao động:** thế nào là quyết định hợp lệ và “toàn bộ khoản tích lũy” có gồm phần chưa đủ chu kỳ theo tỷ lệ hay không?
8. **Thuế/hạch toán:** kế toán xác định cách thể hiện và khấu trừ; hệ thống không tự suy ra.

## 5. Thiết kế dữ liệu đề xuất

Không thêm một cột tổng vào `hr_employees`, cũng không ghi tiền trực tiếp vào `hr_attendance_shifts`. Dùng sổ cái riêng để có thể kiểm toán.

### 5.1 Chính sách và cấu phần

- `hr_night_reward_programs`: phiên bản chương trình, hiệu lực từ 01/08/2026, đối tượng áp dụng, ngưỡng 10 và trạng thái hiệu lực.
- `hr_night_reward_track_rules`: hai nhánh `PERIODIC_NIGHT` và `LOYALTY_NIGHT`, số tiền credit, độ dài chu kỳ, mức chi khi đủ chu kỳ. Ràng buộc `credit_amount × required_qualified_months = payout_amount`.
- Bổ sung cờ `counts_toward_night_reward` vào chính sách ca có version hiệu lực, thay vì suy ra từ số tiền phụ cấp.

### 5.2 Chốt kết quả tháng và bằng chứng

- `hr_night_reward_monthly_qualifications`: một kết quả/tháng/nhân viên/chương trình/revision; lưu số ca thực tế, trạng thái, lý do, actor, thời gian chốt, hash snapshot và liên kết dữ liệu attendance.
- `hr_night_reward_qualification_shifts`: danh sách các ca nguồn đã được dùng. Khi mở chi tiết phải xem được đúng 10 hoặc 12 ngày ca, mã ca, file import và revision nguồn.
- `hr_night_reward_exceptions`: hồ sơ ngoại lệ, mã lý do chuẩn, người đề nghị/duyệt, mô tả và liên kết chứng từ nếu có.

### 5.3 Chu kỳ, quyền chi và ledger

- `hr_night_reward_cycles`: chu kỳ đang mở/matured của mỗi người cho từng nhánh; số tháng đạt hiện tại và trạng thái.
- `hr_night_reward_ledger`: append-only các bút toán `MONTH_CREDIT`, `MONTH_REVERSAL`, `CYCLE_MATURED`, `SPECIAL_SETTLEMENT`, `FORFEITURE`, `PAYROLL_EXPORTED`, `PAID`, `PAYMENT_REVERSAL`.
- `hr_night_reward_entitlements`: khoản đã đủ điều kiện chi, số tiền, nhánh, chu kỳ, trạng thái `DRAFT → APPROVED → EXPORTED_TO_PAYROLL → PAID/VOID`.
- Giai đoạn tích hợp payroll: `hr_night_reward_payroll_allocations` liên kết một entitlement với import/lần trả lương cụ thể, không sửa campaign đã gửi.

Mọi bảng theo convention HR hiện có: UUID `VARCHAR(36)`, actor/timestamps, `row_version`, unique constraints và indexes theo `employee_id + month + status`. Khi triển khai thực tế, kiểm tra migration cao nhất rồi mới đặt tên V26 để không va chạm nhánh khác.

## 6. Luồng chốt thưởng tháng

Không tạo tiền ngay khi bấm **Chốt file** của một import; một tháng có thể có nhiều file.

```text
Toàn bộ import tháng đã chốt
        ↓
Kiểm tra: không PREVIEWED, không NEEDS_REVIEW, không trùng ngày nguồn
        ↓
Tạo bản nháp kết quả ca đêm theo từng nhân viên
        ↓
HR duyệt ngoại lệ có hồ sơ (nếu có)
        ↓
Chốt thưởng tháng + snapshot ca nguồn + ledger
        ↓
Tạo entitlement nếu vừa đủ mốc 12 hoặc 24
        ↓
Kế toán duyệt / đưa vào kỳ lương / đánh dấu đã trả
```

Điều kiện bắt buộc trước khi chốt:

1. Có ít nhất một import `CONFIRMED` của tháng và không còn import `PREVIEWED`.
2. Không còn ca `NEEDS_REVIEW` trong phạm vi tháng.
3. Không có trùng `employeeCode + workDate` giữa các file. Báo cáo chấm công hiện có thể đối soát/khử trùng để hiển thị; với tiền thưởng phải **chặn chốt** và yêu cầu xử lý trùng.
4. Chỉ lấy các ca đúng cấu hình chương trình, `CONFIRMED`, công dương và thuộc đối tượng chương trình.
5. Thao tác chốt phải idempotent, optimistic-lock và được audit.

## 7. Mở khóa, sửa sau chốt và bảo vệ tài chính

| Sự kiện | Cách xử lý bắt buộc |
| --- | --- |
| ADMIN mở khóa chấm công trước khi tạo payroll | Đánh dấu qualification bị ảnh hưởng là `STALE`, tạo revision mới và bút toán đảo; không sửa mất lịch sử |
| Đã xuất sang payroll nhưng chưa trả | Khóa sửa tự động; yêu cầu workflow điều chỉnh/reversal có lý do và phê duyệt |
| Đã trả | Không thay số dư quá khứ; tạo nghiệp vụ điều chỉnh tài chính riêng |
| Điều chuyển khỏi ca đêm | Ngừng tháng đạt mới; giữ nguyên tiến độ đã bảo lưu khi còn làm việc |
| Kỷ luật buộc chấm dứt | Xử lý quyền chưa chi qua quyết định HR được duyệt; không tự suy từ trạng thái nhân sự |
| Qua đời/suy giảm khả năng lao động | Tạo `SPECIAL_SETTLEMENT` với hồ sơ/duyệt; không xóa lịch sử |

## 8. UX/UI đề xuất

Tạo trang độc lập, không nhét vào bảng chấm công:

`/manager/hr/attendance/night-rewards`

### 8.1 Tổng quan tháng

- Trạng thái sẵn sàng chốt và các blocker: file chưa chốt, ca cần xử lý, trùng nguồn.
- KPI: người đủ điều kiện, chưa đủ, ngoại lệ, quyền đến hạn, tiền chờ payroll.
- Nút **Tạo bản nháp**, **Chốt thưởng tháng**, **Xuất đối soát**; nút chốt hiện rõ hậu quả và người được phép thao tác.

### 8.2 Danh sách nhân viên

- `Ca đêm tháng này: 8/10`, `10/10`, `12/10`.
- Hai tiến độ tách riêng: **Định kỳ 7/12** và **Gắn bó 7/24**.
- Trạng thái quyền: chưa đến hạn / chờ duyệt / đã xuất payroll / đã trả.
- Không gọi phần 1.500.000 đồng là “đã nhận” trước khi entitlement đủ chu kỳ và payroll xác nhận.

### 8.3 Chi tiết và kiểm toán

- Timeline tháng từ 08/2026, từng ca nguồn, file/revision attendance, ngoại lệ, actor/lý do.
- Tab **Ngoại lệ** với chứng từ và workflow duyệt.
- Tab **Kỳ chi trả** để Finance quản lý entitlement.
- Tab **Lịch sử** chỉ thêm revision/reversal, không xoá dữ liệu.

## 9. Tích hợp payroll và Telegram

### Giai đoạn đầu — an toàn

Khi entitlement được Finance duyệt, hệ thống xuất Excel **Đề nghị trả thưởng ca đêm** gồm hai cột riêng:

- `Thưởng ca đêm định kỳ`
- `Thưởng gắn bó ca đêm`

Kế toán đối chiếu rồi đưa vào file lương chính thức. Chỉ file lương chính thức mới tính thực nhận, được import và gửi Telegram/PDF.

### Giai đoạn sau — native integration

Sau khi shadow ổn định, thêm payroll allocation trước lúc campaign được tạo:

1. Chỉ entitlement `APPROVED` mới được chọn vào import lương.
2. Payroll snapshot lưu rõ từng khoản thưởng và entitlement nguồn.
3. PDF/Telegram chỉ hiển thị khoản đã ở snapshot lương, không đọc lại attendance động.
4. Campaign đã gửi không thay đổi; điều chỉnh phải tạo khoản/phiếu mới theo quy trình.

## 10. Delivery plan theo phase

Mỗi phase chỉ được đi tiếp khi đạt điều kiện nghiệm thu của chính phase đó. Không có phase nào được phép tự sửa một payroll import hoặc campaign Telegram đã gửi.

### Phase 0 — Đóng băng quy chế và dữ liệu đầu vào

**Mục tiêu:** biến thông báo thành các rule máy có thể kiểm thử, không diễn giải miệng khi đã phát sinh tiền.

**Đầu việc:**

1. Ghi nhận rule đã chốt `10 → fail → 12 = 2 tháng đạt`.
2. Chốt đối tượng phiên bản đầu: khuyến nghị chỉ **công nhân trực tiếp sản xuất**; KCS chỉ được thêm khi có quyết định rõ.
3. Chốt danh sách mã ca/cấu hình được tính và cách xử lý ca manual, sự cố máy.
4. Chốt mẫu ngoại lệ của Công ty, quyền tạo/duyệt và chứng từ tối thiểu.
5. Chốt định nghĩa “đã chi trả” cho việc đóng chu kỳ, cùng phương án giữ các tháng đạt phát sinh khi Finance đang chờ chi.

**Bàn giao:** ma trận nghiệp vụ 1 trang, các mã ngoại lệ, danh sách người có quyền và bộ test 10/8/12.

**Gate sang Phase 1:** TCHC xác nhận ít nhất đối tượng, ca được tính, ngoại lệ và ca qua tháng. Không cần thay đổi payroll ở phase này.

### Phase 1 — Shadow calculator, chỉ đọc dữ liệu chấm công

**Mục tiêu:** chứng minh hệ thống đếm đúng ca đêm theo người/tháng trước khi tạo bất kỳ khoản tiền nào.

**Backend đề xuất:**

- Service đọc duy nhất ca `CONFIRMED` thuộc import tháng đã chốt.
- Đếm duy nhất theo `employeeCode + workDate`; ca qua ngày lấy tháng của `workDate`.
- Chỉ trả kết quả suy ra: `nightShiftCount`, `qualified`, blocker và danh sách ca nguồn.
- Chặn tính thử khi còn import `PREVIEWED`, `NEEDS_REVIEW` hoặc trùng nguồn; không âm thầm khử trùng để xét tiền.

**UI đề xuất:** route độc lập `/manager/hr/attendance/night-rewards` ở chế độ **SHADOW — không tạo quyền lợi**. Danh sách hiển thị `8/10`, `10/10`, `12/10`, và lý do chưa thể đối soát.

**Kiểm thử/ nghiệm thu:** đối chiếu tối thiểu 2–3 tháng với TCHC, bao gồm 10/8/12, ca cuối tháng qua ngày, một ca bị sửa và một trường hợp trùng nguồn.

**Gate sang Phase 2:** TCHC ký xác nhận số ca đêm month-by-month khớp bảng đối chiếu. Không tạo migration tiền thưởng hay ghi ledger trước gate này.

### Phase 2 — Sổ thưởng và chốt tháng bất biến

**Mục tiêu:** biến kết quả Shadow đã đúng thành kết quả tháng có thể kiểm toán và bảo lưu.

**Backend/migration đề xuất:**

1. Migration tiếp theo (dự kiến `V26`, phải kiểm tra lại số migration trước lúc code) tạo program, track rule, monthly qualification, nguồn ca, cycle, ledger và entitlement.
2. Seed phiên bản chương trình hiệu lực `2026-08-01`, ngưỡng 10, hai nhánh 500.000/12 và 1.000.000/24.
3. API tạo draft, xem đối soát, chốt tháng và xem timeline nhân viên.
4. Chốt tháng tạo snapshot ca nguồn, bản ghi ledger và/hoặc entitlement một cách idempotent.
5. Khi attendance được mở khóa, qualification chuyển `STALE`; hệ thống tạo revision và bút toán đảo thay vì cập nhật/xóa lịch sử.

**UI đề xuất:** hành động **Tạo bản nháp** → **Kiểm tra** → **Chốt thưởng tháng** có hộp xác nhận rõ số người đạt, fail, ngoại lệ và quyền sắp đến hạn.

**Definition of done:** Tháng 1/2/3 tạo được kết quả `1/12 → 1/12 → 2/12`; chạy lại thao tác chốt không tạo credit/entitlement trùng; mở khóa có audit và không làm mất dữ liệu cũ.

### Phase 3 — Ngoại lệ, timeline và vận hành TCHC

**Mục tiêu:** để TCHC vận hành được các tình huống thực tế mà không sửa số tay trong database.

**Đầu việc:**

- Workflow ngoại lệ Công ty: tạo, đính kèm lý do/chứng từ, duyệt, từ chối, hủy và audit.
- Timeline theo nhân viên từ 08/2026: ca thực tế, kết quả tháng, `Định kỳ x/12`, `Gắn bó x/24`, cycle đã đủ và khoản chờ chi.
- Workflow điều chuyển khỏi ca đêm, mất quyền do kỷ luật, chi trả đặc biệt tử vong/y tế.
- Phân quyền: MANAGER có thể xem/đề nghị; ADMIN/TCHC được chốt và xử lý điều chỉnh; Finance đánh dấu duyệt/đã trả.

**Definition of done:** không có đường nào để tự biến 8 ca thành tháng đạt mà không có hồ sơ ngoại lệ và actor phê duyệt; mọi thay đổi xuất hiện trong lịch sử.

### Phase 4 — Finance handoff, chưa đụng payroll import

**Mục tiêu:** đưa đúng khoản thưởng đã đủ chu kỳ cho Kế toán theo cách an toàn nhất.

**Đầu việc:**

- Khi đủ 12/24, tạo `entitlement` chờ duyệt thay vì cộng vào lương tự động.
- Xuất Excel **Đề nghị trả thưởng ca đêm** với hai cột: định kỳ và gắn bó.
- Kế toán duyệt, chọn kỳ lương dự kiến và đánh dấu `EXPORTED_TO_PAYROLL`/`PAID`.
- Nếu cần điều chỉnh sau xuất, tạo reversal hoặc entitlement điều chỉnh; không sửa lại quyền cũ.

**Definition of done:** Kế toán có thể đối chiếu một chu kỳ mẫu từ ca nguồn → entitlement → file đề nghị trả, không cần truy cập database.

### Phase 5 — Native payroll, PDF và Telegram

**Mục tiêu:** chỉ khi Phase 4 đã nghiệm thu, tự đưa khoản được duyệt vào phiếu lương chính thức.

**Đầu việc:**

1. Chỉ entitlement `APPROVED` được attach vào một payroll import trước khi campaign được tạo.
2. Payload/snapshot payroll lưu mã entitlement và hai khoản thưởng tách riêng.
3. PDF/Text Telegram hiển thị khoản đúng theo snapshot; không đọc attendance động lúc gửi.
4. Campaign đã gửi giữ bất biến. Gửi lại chỉ dùng cùng snapshot, không tạo thêm quyền lợi.

**Definition of done:** một phiếu mẫu có thể truy vết từ Telegram/PDF về payroll snapshot, entitlement, qualification và ca nguồn; retry không gửi hai lần hoặc tự cộng tiền hai lần.

### Phase 6 — Nghiệm thu production và vận hành lâu dài

**Mục tiêu:** chuyển từ Shadow sang sử dụng chính thức có kiểm soát.

**Đầu việc:**

- Chạy shadow nhiều kỳ lương, soát chéo TCHC/Kế toán và ký xác nhận.
- Backup trước migration, healthcheck schema/API, audit log, cảnh báo dữ liệu chưa chốt và entitlement bị treo.
- Dashboard quản trị: gần đạt 10 ca, gần mốc 12/24, quyền chờ trả, tháng bị `STALE`.
- Cập nhật `PROJECT_MASTER_CONTEXT.md`, hướng dẫn sử dụng và tài liệu rollout sau khi source/test hoàn thành.

**Gate production:** không còn chênh lệch đối soát được giải thích; tất cả test nghiệp vụ pass; backend/frontend cùng version; một kỳ trả thử được Finance ký duyệt.

### Tóm tắt phụ thuộc

| Phase | Có thể làm ngay? | Tác động tiền lương | Phụ thuộc chính |
| --- | --- | --- | --- |
| 0 | Có | Không | HR chốt rule còn mở |
| 1 | Có sau Phase 0 tối thiểu | Không | Attendance đã chốt, dữ liệu đối chiếu |
| 2 | Sau khi Shadow khớp | Chỉ ledger/quyền nội bộ | Migration, audit, approved rules |
| 3 | Song song cuối Phase 2 | Không tự chi tiền | Workflow TCHC/Finance |
| 4 | Sau Phase 2–3 | File đề nghị trả, chưa sửa payroll | Kế toán nghiệm thu |
| 5 | Sau Phase 4 | Có ảnh hưởng phiếu lương/Telegram | Snapshot payroll, E2E acceptance |
| 6 | Sau tất cả phase trước | Production | Backup, deploy, ký nghiệm thu |

## 11. Kiểm thử bắt buộc

1. 10, 8, 12 ca đêm; 12 ca chỉ tạo một tháng đạt, không chuyển 2 ca dư.
2. 10 → 8 → 12 giữ tiến độ `2/12`, `2/24`.
3. Mốc 12 và 24, chạy lại thao tác chốt không tạo entitlement/bút toán trùng.
4. Ca cuối tháng qua ngày được tính đúng tháng bắt đầu và chỉ một lần.
5. Manual override/sự cố máy theo quy chế đã chốt; ngoại lệ Công ty có audit, thiếu do cá nhân không tự pass.
6. Trùng file/ngày chặn finalization.
7. Mở khóa trước/sau xuất payroll và sau trả lương không mất lịch sử.
8. Điều chuyển, kỷ luật, qua đời/y tế theo workflow phê duyệt.
9. Đồng thời hai người chốt tháng; optimistic lock, 401/403 và idempotency.
10. Snapshot payroll/PDF/Telegram không thay đổi sau khi gửi.

## 12. Không nằm trong phạm vi giai đoạn đầu

- Tự suy ra ngày phép/nghỉ từ việc không chấm.
- Tự thay đổi lương cơ bản, công, phụ cấp ca đêm hiện có.
- Tự chi tiền, tự gửi Telegram hoặc thu hồi tiền khi chưa có Finance/HR approval.
- Tự backfill dữ liệu trước 01/08/2026. Backfill sau ngày hiệu lực phải qua Shadow và xác nhận HR.

## 13. Tiêu chí sẵn sàng triển khai code

Chỉ bắt đầu migration/API/UI khi:

1. HR/BGĐ xác nhận các điểm mở ở mục 4.
2. Chấm công ca sản xuất được nghiệm thu tối thiểu ở chế độ SHADOW cho các tháng liên quan.
3. Có người sở hữu nghiệp vụ: TCHC chốt tháng, Finance duyệt/đánh dấu trả.
4. Có mẫu dữ liệu đối chiếu cho ít nhất 10 → 8 → 12 và một trường hợp ngoại lệ Công ty.

Khi đủ các điều kiện này, Phase 1 có thể triển khai trước mà không gây tác động đến payroll đang chạy.
