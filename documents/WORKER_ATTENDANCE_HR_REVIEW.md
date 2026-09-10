# Chấm công công nhân — dữ kiện, mẫu đối chiếu và câu hỏi cho HR

- Ngày lưu: **10/09/2026**.
- Dự án: **CFCBase**.
- Trạng thái: **Đã phân tích file mẫu; chờ HR bổ sung quy tắc trước khi triển khai**.
- Phạm vi: chức năng **Chấm công công nhân** trong một tab riêng.
- Mục đích: giữ lại dữ kiện của cuộc trao đổi để HR trả lời và người tiếp tục công việc không phải suy đoán lại.
- Hiện tại chỉ lưu tài liệu nghiệp vụ. Chưa triển khai tab công nhân, chưa sửa cách tính chấm công hiện hành và chưa thay đổi hai file Excel gốc.

## 1. Kết luận và giới hạn đã thống nhất

Mẫu **Đỗ Đình Cường — B124 — tháng 08/2026** có kết quả mong đợi là **45 công**, theo lịch ca người dùng cung cấp và các xác nhận trong cuộc trao đổi.

- 11 ca ngày × 1,5 = **16,5 công**.
- 19 ca đêm × 1,5 = **28,5 công**.
- Ngày 09/08 không bắt đầu ca mới = **0 công**.
- Giữ đủ **31 ngày** trong bảng, dù có ngày công bằng 0.
- Đây là **30 ca được quy đổi thành 45 công**, không phải 45 ngày đi làm.
- 29 ca ghép được đủ lượt vào/ra theo lịch đã cung cấp. Riêng ca bắt đầu 31/08 thiếu giờ ra 01/09 trong file nhưng được tính **1,5 công theo xác nhận của người dùng**.

Kết quả này đủ làm mẫu nghiệm thu đầu tiên. Chưa được suy rộng rằng mọi nhân viên, mọi ca đêm hoặc mọi trường hợp thiếu giờ đều áp dụng cùng quy tắc.

## 2. Nguồn dữ liệu và cách sử dụng

### 2.1 File giờ chấm đầu vào

[CongXn.xlsx](../CongXn.xlsx)

- Sheet: `Giờ chấm công`.
- Phạm vi: `A1:H281`, gồm 2 dòng tiêu đề và 279 dòng dữ liệu.
- Tiêu đề: `GIỜ CHẤM CÔNG (01-Aug-26 - 31-Aug-26)`.
- Có **9 mã nhân viên**, mỗi mã **31 dòng**: B124, B126, B128, B129, B138, B143, B144, B159, C086.
- Nhân viên đầu tiên: **B124 — Đỗ Đình Cường**, các dòng Excel **3–33**.
- Cột: A = STT; B = mã NV; C = tên; D = phòng ban; E = ngày; F = thứ; G/H = lần chấm 1/2.
- Phòng ban của mẫu Cường đang trống.
- Đây là file giờ chấm theo ngày do Time Attendance xuất, không phải bảng phân ca. File chỉ có hai cột lượt chấm; chưa biết phần mềm máy đã lọc/gộp các lượt vân tay khác trước khi xuất hay chưa.
- Không có dữ liệu ngày **01/09/2026** trong file này.

SHA-256 tại thời điểm lưu:

```text
955c0ce0c57f48d7f88a0c2c78b7fde60c6f7cc021a7d2a2186f32a0854da16c
```

### 2.2 Mẫu bảng tổng hợp đầu ra

[Copy of Thong_Ke_Thang_Cong_10_09_2026_aac584b4-8f5c-4861-94a2-bb35cbeeffc4.xlsx](<../Copy of Thong_Ke_Thang_Cong_10_09_2026_aac584b4-8f5c-4861-94a2-bb35cbeeffc4.xlsx>)

- Sheet: `Sheet1`.
- Tiêu đề tại dòng 3; hai dòng tiêu đề cột 4–5; dữ liệu Cường tại dòng 6.
- Mẫu được gửi hiện chỉ có **một dòng nhân viên**, không phải tổng hợp đầy đủ cả 9 người của file đầu vào.
- Các ngày 1–31: `D6:AH6`. Tổng ngày công: `AI6 = 39,68`.
- Các ô ngày công và tổng ở dòng 6 là **giá trị đã xuất**, không có công thức Excel để truy ngược chính xác thuật toán của Time Attendance.
- Dùng **bố cục** làm mẫu đầu ra; **không dùng số công cũ làm đáp án chuẩn**.
- Tên file chứa ngày xuất 10/09/2026; kỳ đang đối chiếu là **tháng 08/2026**, xác định từ file giờ chấm và lịch ngày/thứ tương ứng.

Các nhóm cột cần bảo lưu khi thiết kế xuất:

| Vị trí | Nội dung trong mẫu |
|---|---|
| A:C | STT, mã nhân viên, tên nhân viên |
| D:AH | Ngày 1–31, có hàng thứ trong tuần |
| AI | Ngày công |
| AJ:AK | Tăng ca: BT, CN |
| AL:AN | Số phút: Trễ, Sớm, TC |
| AO:AR | Nghỉ: Phép, Lễ, N.Có Lương, N.Không Lương |

Dòng Cường còn có `Sớm = 395`, `TC = 395`, `N.Không Lương = 2`; các giá trị này chỉ được ghi nhận từ file lỗi, **chưa được HR xác nhận là đúng**. Các nhóm tăng ca/nghỉ cần định nghĩa và nguồn dữ liệu riêng trước khi tự tính.

SHA-256 tại thời điểm lưu:

```text
c69e6efd2af006a5c9589cdb96d3d71e1d80cae15f346ee1f214c73d1caef3cf
```

### 2.3 Ảnh cấu hình Time Attendance Pro

Người dùng gửi ảnh màn hình `Ca làm việc`. Bảng bên trái hiển thị các mục sau; tên và giá trị chỉ ghi lại theo ảnh, **không coi là quy tắc mới đã được phê duyệt**:

| Tên ca trong ảnh | Giờ vào | Giờ ra | Giờ | Công |
|---|---|---|---:|---:|
| HC | 07:30 | 16:30 | 8 | 1 |
| CongNhan | 06:00 | 04:00 | 22 | 4 |
| KCS-Ca1 | 07:30 | 22:30 | 15 | 1,5 |
| KCS-Ca2 | 13:00 | 22:00 | 9 | 1 |
| ThoiVu | 06:00 | 05:00 | 23 | 4 |
| CN-6h-15h | 06:00 | 15:00 | 9 | 1 |
| CN-6h-18h | 06:00 | 18:00 | 12 | 1,5 |
| CN-6h-20h | 06:00 | 20:00 | 14 | 2 |
| CN-6h-5h | 06:00 | 05:00 | 23 | 3,5 |
| CN-18h-5h | 18:00 | 05:00 | 11 | 1,5 |

Ảnh chưa chứng minh cửa nhận lượt vào/ra, lịch phân ca và các tùy chọn của ca đang áp dụng cho Cường. Không thể chỉ từ ảnh này kết luận chính xác nguyên nhân rớt công.

## 3. Các phát biểu và xác nhận của người dùng

### 3.1 Lịch ca Cường được cung cấp

- 01–03/08: ca sáng/ngày.
- 04–08/08: ca đêm, kết thúc sáng 09/08.
- 09/08: nghỉ sau khi kết thúc ca ngày 08, không bắt đầu ca mới.
- 10–17/08: ca ngày.
- 18–31/08: ca đêm.

Lịch trên do **người dùng cung cấp**, không phải lịch ca ghi sẵn trong Excel. Việc ghép ca trong mẫu đã sử dụng thông tin này.

### 3.2 Quy đổi được mô tả

| Tình huống | Dữ kiện/xác nhận | Phạm vi chắc chắn |
|---|---|---|
| 06:00 → 14:00 | 1 công | Ví dụ được người dùng nêu |
| 06:00 → 16:30 | 1,5 công | Ví dụ được người dùng nêu |
| Các ca ngày của Cường ra khoảng 17 giờ | 1,5 công | Đã hỏi cụ thể 01/08: 05:54–17:31 và 16/08: 05:53–17:12; người dùng trả lời “Câu 1 là 1.5 công” |
| 06:00 → 18:00 hoặc 18:59; có khi chấm ra 20–21 giờ | 2 công | Người dùng nêu; ngưỡng, thời gian nghỉ và giới hạn chưa rõ |
| Ca đêm | Được mô tả 17:00 → 05:00 hôm sau | Khung giờ chính xác và các biến thể cần HR xác nhận |
| Ca đêm cuối tháng của Cường | Vẫn 1,5 công dù thiếu giờ ra 01/09 trong file | Người dùng trả lời “câu 2 vẫn tính là 1.5 công nhé” |
| 1,43; 1,42; 1,45 trong file cũ | Phải làm tròn lên 1,5 | Người dùng nhấn mạnh 39,68 là sai |

Mẫu đối chiếu đã thống nhất sử dụng **1,5 công cho 19 ca đêm của Cường**, gồm ca cuối tháng theo xác nhận trên. Chưa có bảng hệ số áp dụng cho toàn bộ loại ca/nhóm công nhân.

### 3.3 Mâu thuẫn phải giữ lại để hỏi HR

1. Mô tả ban đầu có câu **“8 tiếng là 1 công, 12 tiếng sẽ là 1 công”**. Các ví dụ và xác nhận sau lại dùng 1,5 hoặc 2 công. Không xóa thông tin này; hỏi xem có nhóm ca/nhóm người khác áp dụng 12 tiếng = 1 công hay đó là nhầm diễn đạt.
2. Ảnh cũ ghi `CN-6h-18h = 1,5 công`, còn người dùng nêu `06:00 → 18:00 = 2 công`. Quy định mới và cấu hình cũ đang không trùng nhau.
3. Người dùng mô tả đêm `17:00 → 05:00`, ảnh có `18:00 → 05:00`, còn giờ thực tế của Cường cũng thay đổi theo giai đoạn. Cần phân biệt giờ chuẩn với khoảng cho phép chấm.
4. Quy tắc làm tròn mới xác nhận các ví dụ cụ thể, **chưa có cơ sở áp dụng chung công thức làm tròn lên bậc 0,5** cho mọi giá trị như 1,01 hoặc 1,51.

## 4. Cách hiểu lượt chấm và ca qua ngày

- **Lượt chấm:** một thời điểm máy ghi nhận.
- **Ngày lịch:** ngày hiển thị trên dòng Excel.
- **Ca làm việc:** một lượt vào được ghép với lượt ra, có thể ở ngày hôm sau.
- **Ngày tính công của mẫu:** ngày **bắt đầu ca**.
- **Công:** đơn vị quy đổi theo quy định, không đồng nhất với số ngày lịch hoặc mặc nhiên bằng số giờ chia 8.

Không gán cố định G = vào, H = ra. Một dòng trong giai đoạn ca đêm thường chứa **ra của ca trước** và **vào của ca mới**.

Ví dụ:

| Lượt chấm | Vai trò theo lịch được cung cấp |
|---|---|
| 24/08 17:21 | Vào ca ngày 24 |
| 25/08 05:46 | Ra ca ngày 24 |
| 25/08 16:55 | Vào ca ngày 25 |
| 26/08 05:52 | Ra ca ngày 25 |

Phải ghép 24/08 17:21 với 25/08 05:46; 25/08 16:55 với 26/08 05:52. Mỗi lượt chấm chỉ được sử dụng một lần.

Thứ Bảy/Chủ nhật không mặc định là nghỉ đối với công nhân. Cường có làm cuối tuần trong mẫu. Không tự chuyển ngày cuối tuần thành 0 hoặc tự suy ra nghỉ phép/nghỉ không lương từ việc thiếu lượt chấm.

## 5. Đối chiếu đủ 31 ngày của Đỗ Đình Cường

Nguồn giờ: `Giờ chấm công!G3:H33`. Nguồn công cũ: `Sheet1!D6:AH6`.

“Ca bắt đầu” được xác định theo lịch người dùng cung cấp. Công mong đợi là kết quả nghiệp vụ đang dùng cho mẫu này, không phải số công có sẵn trong `CongXn.xlsx`.

| Ngày 08/2026 | Gốc lần 1 | Gốc lần 2 | Ca bắt đầu | Vào ca | Ra ca ghép đúng | Công cũ | Công mong đợi |
|---|---|---|---|---|---|---:|---:|
| 01 | 05:54 | 17:31 | Ngày | 01/08 05:54 | 01/08 17:31 | 1,44 | 1,5 |
| 02 | 05:56 | 17:16 | Ngày | 02/08 05:56 | 02/08 17:16 | 1,41 | 1,5 |
| 03 | 05:50 | 17:34 | Ngày | 03/08 05:50 | 03/08 17:34 | 1,45 | 1,5 |
| 04 | 17:53 | — | Đêm | 04/08 17:53 | 05/08 05:02 | 1,5 | 1,5 |
| 05 | 05:02 | 17:55 | Đêm | 05/08 17:55 | 06/08 05:01 | 1,5 | 1,5 |
| 06 | 05:01 | 17:54 | Đêm | 06/08 17:54 | 07/08 05:08 | 1,5 | 1,5 |
| 07 | 05:08 | 17:56 | Đêm | 07/08 17:56 | 08/08 04:59 | 1,5 | 1,5 |
| 08 | 04:59 | 17:50 | Đêm | 08/08 17:50 | 09/08 04:58 | 1,5 | 1,5 |
| 09 | 04:58 | — | Không có ca mới | — | 04:58 thuộc ca ngày 08 | 0 | 0 |
| 10 | 05:52 | 17:27 | Ngày | 10/08 05:52 | 10/08 17:27 | 1,43 | 1,5 |
| 11 | 05:50 | 17:25 | Ngày | 11/08 05:50 | 11/08 17:25 | 1,43 | 1,5 |
| 12 | 05:52 | 17:24 | Ngày | 12/08 05:52 | 12/08 17:24 | 1,42 | 1,5 |
| 13 | 05:50 | 17:29 | Ngày | 13/08 05:50 | 13/08 17:29 | 1,43 | 1,5 |
| 14 | 05:58 | 17:23 | Ngày | 14/08 05:58 | 14/08 17:23 | 1,42 | 1,5 |
| 15 | 05:55 | 17:21 | Ngày | 15/08 05:55 | 15/08 17:21 | 1,42 | 1,5 |
| 16 | 05:53 | 17:12 | Ngày | 16/08 05:53 | 16/08 17:12 | 1,40 | 1,5 |
| 17 | 05:54 | 17:26 | Ngày | 17/08 05:54 | 17/08 17:26 | 1,43 | 1,5 |
| 18 | 17:24 | — | Đêm | 18/08 17:24 | 19/08 05:49 | 1,5 | 1,5 |
| 19 | 05:49 | 17:23 | Đêm | 19/08 17:23 | 20/08 05:50 | 1,5 | 1,5 |
| 20 | 05:50 | 17:21 | Đêm | 20/08 17:21 | 21/08 05:50 | 1,5 | 1,5 |
| 21 | 05:50 | 17:22 | Đêm | 21/08 17:22 | 22/08 05:48 | 1,5 | 1,5 |
| 22 | 05:48 | 17:21 | Đêm | 22/08 17:21 | 23/08 05:49 | 1,5 | 1,5 |
| 23 | 05:49 | 17:21 | Đêm | 23/08 17:21 | 24/08 05:48 | 1,5 | 1,5 |
| 24 | 05:48 | 17:21 | Đêm | 24/08 17:21 | 25/08 05:46 | 1,5 | 1,5 |
| 25 | 05:46 | 16:55 | Đêm | 25/08 16:55 | 26/08 05:52 | 0 | 1,5 |
| 26 | 05:52 | 17:20 | Đêm | 26/08 17:20 | 27/08 05:48 | 1,5 | 1,5 |
| 27 | 05:48 | 17:17 | Đêm | 27/08 17:17 | 28/08 05:46 | 1,5 | 1,5 |
| 28 | 05:46 | 17:24 | Đêm | 28/08 17:24 | 29/08 05:55 | 1,5 | 1,5 |
| 29 | 05:55 | 17:04 | Đêm | 29/08 17:04 | 30/08 05:51 | 1,5 | 1,5 |
| 30 | 05:51 | 16:59 | Đêm | 30/08 16:59 | 31/08 05:56 | 0 | 1,5 |
| 31 | 05:56 | 17:08 | Đêm | 31/08 17:08 | Thiếu dữ liệu 01/09 | 0 | 1,5 |

### Tổng theo nhóm

| Nhóm ngày | Số ca | Công cũ | Công mong đợi |
|---|---:|---:|---:|
| 01–03 | 3 ca ngày | 4,30 | 4,50 |
| 04–08 | 5 ca đêm | 7,50 | 7,50 |
| 09 | 0 ca mới | 0 | 0 |
| 10–17 | 8 ca ngày | 11,38 | 12,00 |
| 18–31 | 14 ca đêm | 16,50 | 21,00 |
| **Tổng** | **30** | **39,68** | **45,00** |

Đối chiếu chênh lệch:

- 11 ca ngày từ tổng 15,68 lên 16,50: **+0,82 công**.
- Ngày 25, 30, 31 từ 0 lên 1,5 mỗi ngày: **+4,50 công**.
- **39,68 + 0,82 + 4,50 = 45,00 công**.

39,68 là **số sai trong báo cáo cũ**, không phải cơ sở chuẩn để xây thuật toán. Tổng 45 được dựng lại từ lịch ca, giờ chấm và quy tắc đã trao đổi.

## 6. Các ngày dễ hiểu nhầm và giả thuyết rớt công

### Ngày 09

`08/08 17:50 → 09/08 04:58` là ca ngày 08. Ngày 09 không có ca mới nên 0 là đúng. Không được coi 04:58 là lượt vào ngày 09 rồi tự bổ sung lượt ra và cộng thêm công.

### Ngày 25 và 30

- Ngày 25: `25/08 16:55 → 26/08 05:52` có đủ cặp giờ.
- Ngày 30: `30/08 16:59 → 31/08 05:56` có đủ cặp giờ.
- Mỗi khoảng là 12 giờ 57 phút theo thời điểm chấm; đây là thời gian giữa hai lượt, **không mặc nhiên là thời gian được trả công sau khi trừ nghỉ**.
- Hai lượt vào bị rớt đều trước 17:00, trong khi lượt vào 17:04 ngày 29 được phần mềm cũ tính.
- **Giả thuyết:** cửa nhận giờ vào ca đêm có thể bắt đầu từ 17:00, hoặc lịch nhận diện ca/cấu hình khác khiến hai lượt này bị ghép sai.
- **Chưa xác nhận nguyên nhân chính xác:** chưa có lịch phân ca và cấu hình chi tiết của Time Attendance. File Excel chỉ chứa kết quả xuất.

### Ngày 31

- `31/08 05:56` đã là lượt ra của ca ngày 30.
- `31/08 17:08` là lượt vào ca ngày 31 theo lịch người dùng cung cấp.
- Không có lượt ra sáng 01/09 trong file đang đọc. Chưa thể kết luận người lao động quên chấm; có thể lượt chấm đơn giản nằm ngoài phạm vi file tháng 8.
- Người dùng xác nhận **vẫn tính 1,5 công**.
- Đề xuất khi triển khai: lưu 1,5 công kèm lý do áp dụng quy định cuối tháng, giữ giờ ra thực tế trống. Không tạo một giờ chấm giả như 05:00 hoặc 06:00 rồi trình bày là dữ liệu máy.
- Khi bổ sung file tháng 9, phải ghép lượt ra này về ca tháng 8 và tránh cộng lại ở tháng 9. Phạm vi ngoại lệ cho các ca cuối tháng khác còn cần HR xác nhận.

## 7. Câu hỏi để HR trả lời

HR có thể điền trực tiếp cột cuối. Các câu hỏi chưa có câu trả lời không được tự biến thành quy định mặc định khi triển khai.

| Mã | Câu hỏi cần HR xác nhận | Vì sao cần | HR trả lời |
|---|---|---|---|
| Q01 | Có bảng phân ca theo người/ngày/tổ không? Ca có luân phiên theo chu kỳ hay đổi linh hoạt? Nếu không có bảng, HR đang xác định ca bằng cách nào? | 05:50 có thể là vào ca ngày hoặc ra ca đêm; không luôn nhận diện chắc chắn chỉ từ một dòng | Chưa trả lời |
| Q02 | Danh sách ca đang áp dụng, giờ chuẩn bắt đầu/kết thúc và công cho mỗi ca? Đêm 17–05 và 18–05 có phải hai ca khác nhau không? | Ảnh cũ, mô tả và giờ thực tế chưa đồng nhất | Chưa trả lời |
| Q03 | Bảng ngưỡng cho 1 / 1,5 / 2 công là gì? Ví dụ vào 06:00, ra 14:00, 15:00, 16:00, 16:29, 16:30, 17:59, 18:00, 18:01, 20:00, 21:00? | Chưa biết ngưỡng chính xác và cách xử lý sát ranh giới | Chưa trả lời |
| Q04 | Làm tròn theo bậc cố định hay chỉ một số khoảng? 1,01; 1,24; 1,26; 1,49; 1,51 được tính bao nhiêu? | Ví dụ 1,42–1,45 lên 1,5 chưa xác định toàn bộ quy tắc | Chưa trả lời |
| Q05 | Tính theo giờ thực tế, theo ca đăng ký hay mốc checkout? Có trừ nghỉ trưa/nghỉ giữa ca không? | Không thể mặc định lấy tổng giờ chia 8; chưa biết có phải tính số lẻ rồi làm tròn hay quy đổi trực tiếp | Chưa trả lời |
| Q06 | Ca cho phép chấm vào sớm/muộn, chấm ra sớm/muộn bao nhiêu phút? Đi trễ/về sớm có trừ công hay chỉ thống kê? | Tránh rớt như 16:55/16:59 và hiểu các trường hợp 17:53–05:02 | Chưa trả lời |
| Q07 | Có nhóm công nhân/ca nào áp dụng 12 tiếng = 1 công không? Hay phát biểu ban đầu là nhầm? | Giải quyết mâu thuẫn với ví dụ 1,5 và 2 công | Chưa trả lời |
| Q08 | Thiếu lượt vào hoặc ra giữa tháng xử lý thế nào? Không có cả hai lượt thì sao? Ai xác nhận? | Ngoại lệ ca 31 đã chốt không đồng nghĩa được tự điền/tính cho mọi ca thiếu lượt | Chưa trả lời |
| Q09 | Quy tắc ca đêm cuối tháng tính 1,5 có áp dụng toàn bộ công nhân/tháng không? Có thể xuất kèm sáng ngày đầu tháng sau và cuối tháng trước không? | Ghép ca qua ranh giới kỳ và tránh cộng trùng | Chưa trả lời |
| Q10 | Có ca nối tiếp/ca kéo dài hơn một ngày hoặc nhiều lần ra vào không? File hai lượt/ngày có giữ đủ lượt gốc không? | Thiếu lượt do báo cáo đã gộp sẽ không thể tái tạo chắc chắn | Chưa trả lời |
| Q11 | 1,5/2 công đã bao gồm tăng ca hay tăng ca còn tính riêng? BT, CN, TC có ý nghĩa và đơn vị gì? | Tránh tính cùng thời gian hai lần | Chưa trả lời |
| Q12 | Chủ nhật/lễ có hệ số riêng? Nguồn xác nhận phép/nghỉ có lương/không lương là đâu? | Không suy ra lý do nghỉ từ lượt vân tay; mẫu có đi làm cuối tuần | Chưa trả lời |
| Q13 | Ca đêm và nghỉ sau ca cần ký hiệu gì trong file xuất? Có cần tổng số ca đêm, công ngày/đêm riêng không? | Chốt nội dung xuất ngoài việc giữ bố cục mẫu | Chưa trả lời |
| Q14 | Nhân viên không có trong danh mục CFCBase, mã trùng hoặc đổi mã được xử lý thế nào? Ai được điều chỉnh và xác nhận bảng công? | Chốt đối chiếu nhân viên và trách nhiệm sửa số liệu | Chưa trả lời |

HR nên gửi kèm bảng quy đổi và vài ca mẫu đã tính đúng, đặc biệt các trường hợp sát ngưỡng, đổi ca, thiếu lượt và qua tháng. Không yêu cầu HR diễn giải bằng công thức lập trình.

## 8. Hướng chức năng dự kiến sau khi HR trả lời

Đây là **đề xuất để tiếp tục**, chưa phải tính năng đã làm hoặc quy trình đã được HR duyệt.

1. Tab **Chấm công công nhân** riêng, có cấu hình nghiệp vụ riêng để không làm thay đổi chấm công hành chính hiện hành.
2. Import file giờ chấm; chọn/nhận diện kỳ, mã nhân viên và các lượt chấm. Lưu bản gốc để đối soát, không ghi đè giờ gốc khi điều chỉnh.
3. Đối chiếu lịch ca; ghép lượt vào/ra qua ngày theo thời gian đầy đủ; không tái sử dụng một lượt cho hai ca.
4. Quy đổi công theo cấu hình HR xác nhận. Nếu có làm tròn thì thực hiện tại cấp ca trước khi cộng tháng, theo phạm vi/ngưỡng được phê duyệt.
5. Xem chi tiết trên web: ngày bắt đầu ca, loại ca, ngày giờ vào/ra, công và lý do. Hiển thị rõ dữ liệu thiếu, ghép chưa chắc chắn và ngoại lệ cuối tháng; không âm thầm biến chúng thành 0.
6. HR kiểm tra/điều chỉnh với lý do; lưu người sửa và lịch sử; xác nhận bảng công.
7. Xuất bảng ngang theo mẫu: một người/một dòng, đủ ngày trong kỳ, tổng công và các nhóm cột bổ sung có đủ dữ liệu.
8. Xem trên web và xuất Excel dùng cùng kết quả đã xác nhận. Giữ khả năng đối chiếu ngược mỗi ô công về các lượt chấm và quy tắc đã áp dụng.

Không tự suy ra phép/nghỉ/tăng ca từ file giờ chấm nếu chưa có định nghĩa hoặc nguồn bổ sung. Không chọn mặc định xóa dòng không chấm. Không dùng bảng kết quả lỗi của Time Attendance làm dữ liệu đầu vào tính công mới.

## 9. Mẫu nghiệm thu và việc còn chờ

### Mẫu Cường đã xác định

- [x] Đã đọc giờ chấm trong Excel và đối chiếu mẫu xuất.
- [x] Đã xác định lịch ca dựa trên dữ kiện người dùng cung cấp.
- [x] Đã đối chiếu 31 ngày, công cũ 39,68 và công mong đợi 45.
- [x] Đã tách nguyên nhân dữ liệu qua ngày/qua tháng khỏi giả thuyết cấu hình phần mềm cũ.
- [x] Đã lưu hai xác nhận về ca ngày 1,5 và ca đêm cuối tháng 1,5; giữ quy tắc làm tròn các ví dụ.

### Khi triển khai phải kiểm tra

- [ ] B124 có đủ 31 ô ngày; ngày 09 = 0; ngày 25, 30, 31 = 1,5; tổng **45,00**.
- [ ] Giữ đủ lượt gốc; một lượt ra sáng không bị tính thêm như lượt vào ca ngày.
- [ ] Ca 31 giữ giờ ra thực tế thiếu và lý do tính 1,5; không bịa dấu vân tay.
- [ ] Các ca ngày mẫu hiển thị 1,5, không còn 1,40/1,41/1,42/1,43/1,44/1,45.
- [ ] File xuất và số hiển thị trên web khớp nhau.
- [ ] Bổ sung tháng 9 không làm cộng trùng ca 31/08.
- [ ] Kiểm tra thêm nhân viên khác và các mốc quy đổi sau khi HR cung cấp đáp án.

### Điểm tiếp tục công việc

Chờ câu trả lời HR ở mục 7 rồi cập nhật quy tắc. Sau đó mới đọc source để thiết kế và triển khai tab công nhân theo phạm vi đã chốt. Phân tích mẫu 45 công không chứng minh hệ thống đã tự nhận ca đúng trên production.

Người dùng đã yêu cầu lưu lại dữ kiện và chuyển sang task **LĐ phổ thông, thao tác thêm lao động phổ thông**. Yêu cầu thay đổi cụ thể của task đó chưa được mô tả trong thời điểm lưu tài liệu này.
