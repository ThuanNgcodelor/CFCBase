# Chấm công công nhân — dữ kiện, mẫu đối chiếu và câu hỏi cho HR

- Ngày lưu: **11/09/2026**.
- Dự án: **CFCBase**.
- Trạng thái: **Đã cập nhật quy tắc nền và danh mục ca theo ngữ cảnh mới; chờ người dùng/HR review các mục còn đánh dấu chưa rõ**.
- Phạm vi: chức năng **Chấm công công nhân** trong một tab riêng.
- Mục đích: giữ lại dữ kiện của cuộc trao đổi để HR trả lời và người tiếp tục công việc không phải suy đoán lại.
- Hiện tại chỉ lưu tài liệu nghiệp vụ. Chưa triển khai tab công nhân, chưa sửa cách tính chấm công hiện hành và chưa thay đổi hai file Excel gốc.

## 0. Quyết định nghiệp vụ chốt ngày 11/09/2026

Các quyết định dưới đây là phạm vi triển khai phiên bản đầu theo xác nhận mới nhất của người dùng:

1. **Trưởng ca phân ca ngoài hệ thống.** CFCBase hiện không nhận được bảng phân ca; đầu vào duy nhất là file chấm công. Hệ thống sẽ nhận diện ca từ chuỗi lượt chấm. Trường hợp không nhận diện chắc chắn phải đưa vào danh sách cần kiểm tra, không tự chọn ca tùy ý.
2. **Công không tính bằng tổng giờ chia 8.** Hệ thống nhận diện loại ca và quy đổi thẳng sang các mức được phép là 1; 1,5; hoặc 2 công.
3. **Ca ngày bắt đầu khoảng 06:00:**
   - Kết thúc khoảng 14:00: 1 công.
   - Kết thúc theo nhóm ca 16:00 và các ca mẫu kết thúc 17:12–17:34: 1,5 công.
   - Kết thúc quanh 18:00, gồm hai ví dụ 17:59 và 18:01: 2 công.
   - Để biểu diễn “khoảng dao động”, phiên bản đầu dùng cửa nhận mốc 18:00 từ **17:45 trở đi**; đây là cấu hình có thể điều chỉnh. Ra muộn hơn vẫn tối đa 2 công nếu không có quy tắc khác được duyệt.
4. **Không làm tròn số công thập phân bằng công thức chung.** Sau khi nhận diện ca/mốc checkout, kết quả được chuẩn hóa trực tiếp về 1; 1,5; hoặc 2. Vì vậy các kết quả cũ 1,40–1,45 thuộc nhóm 1,5 sẽ thành 1,5; không áp dụng kiểu cứ có số lẻ là làm tròn lên.
5. **Ca đêm:** nhận diện từ lượt vào trong khoảng **17:00 đến trước 19:00** và lượt ra trong khoảng **04:00 đến trước 06:00 sáng hôm sau**, tính cho ngày bắt đầu ca. Vì vậy vào lúc 18 giờ mấy và ra lúc 04 giờ mấy vẫn là ca đêm hợp lệ. Một ca đêm hợp lệ hoặc đã được người có quyền xác nhận được tính **1,5 công và 50.000 đồng phụ cấp ca đêm**.
6. **Phụ cấp ca đêm lưu riêng:** `số ca đêm × 50.000 đồng`; không cộng 50.000 vào số công và không gộp vào cột tăng ca. Ca đêm thiếu một lượt chỉ nhận phụ cấp sau khi được xác nhận. Ca 31/08 của mẫu Cường đã được xác nhận 1,5 công nên cũng thuộc diện hưởng 50.000 đồng.
7. **Không trừ giờ nghỉ giữa ca trong bước quy đổi công.** Với dữ liệu hiện có, không đủ thông tin để tính giờ nghỉ thực tế. Đi trễ/về sớm được lưu để thống kê và kiểm tra riêng, chưa tự trừ công.
8. **Ca qua ngày/tháng phải ghép theo thời điểm đầy đủ.** Lượt ra sáng hôm sau thuộc ca bắt đầu hôm trước; mỗi lượt chỉ dùng một lần. Cuối tháng có thể đọc thêm lượt đầu tháng sau nhưng phải ghi công và phụ cấp về tháng/ngày bắt đầu ca.
9. **Danh mục ca được thu gọn theo thực tế sử dụng:** bỏ `CongNhan` ở dòng số 2 của ảnh, `KCS-Ca1`, `ThoiVu` và `CN-6h-5h`; giữ `HC`, `KCS-Ca2`, `CN-6h-15h`, `CN-6h-18h`, `CN-6h-20h` và `CN-18h-5h`. Ca `CN-6h-18h` có thể hoàn tất khoảng 17:00. Ca đêm `CN-18h-5h` dùng cửa nhận thực tế: vào từ 17:00 đến trước 19:00, ra từ 04:00 đến trước 06:00 sáng hôm sau. Không yêu cầu lượt chấm khớp tuyệt đối tên ca.

Mốc 17:45 là giá trị cấu hình ban đầu được chọn để bao phủ ý “dao động quanh 18:00” và vẫn giữ các ca mẫu kết thúc 17:12–17:34 ở mức 1,5. Khi có thêm ca thực tế sát mốc, người quản lý có thể điều chỉnh cấu hình mà không sửa thuật toán.

Trong tài liệu này, câu **“bỏ số 2”** đang được hiểu là bỏ dòng thứ 2 trong danh sách ca của ảnh (`CongNhan 06:00–04:00`), **không phải bỏ mức 2 công**. Ký hiệu `CN` trong các tên `CN-...` được hiểu là **Công nhân**, không phải Chủ nhật, theo ngữ cảnh của danh sách ca. Hai cách hiểu này được ghi rõ để người dùng sửa lại nếu ý ban đầu khác.

## 1. Kết luận và giới hạn đã thống nhất

Mẫu **Đỗ Đình Cường — B124 — tháng 08/2026** có kết quả mong đợi là **45 công**, theo lịch ca người dùng cung cấp và các xác nhận trong cuộc trao đổi.

- 11 ca ngày × 1,5 = **16,5 công**.
- 19 ca đêm × 1,5 = **28,5 công**.
- Ngày 09/08 không bắt đầu ca mới = **0 công**.
- Giữ đủ **31 ngày** trong bảng, dù có ngày công bằng 0.
- Đây là **30 ca được quy đổi thành 45 công**, không phải 45 ngày đi làm.
- 29 ca ghép được đủ lượt vào/ra theo lịch đã cung cấp. Riêng ca bắt đầu 31/08 thiếu giờ ra 01/09 trong file nhưng được tính **1,5 công theo xác nhận của người dùng**.
- Có **19 ca đêm**. Với đơn giá đã chốt là 50.000 đồng/ca, mẫu này có **950.000 đồng phụ cấp ca đêm**. Khoản này tách khỏi 45 công và chỉ là kết quả mong đợi khi cả 19 ca được xác nhận hợp lệ.

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

Người dùng gửi ảnh màn hình `Ca làm việc`. Bảng dưới giữ nguyên dữ liệu nhìn thấy trong ảnh để truy vết, đồng thời thêm hướng xử lý mới. Giá trị cũ không tự động trở thành công thức tính của CFCBase.

| STT trong ảnh | Tên ca trong ảnh | Giờ vào | Giờ ra | Công cũ | Hướng xử lý khi review CFCBase |
|---:|---|---|---|---:|---|
| 1 | HC | 07:30 | 16:30 | 1 | Giữ làm lựa chọn giờ hành chính, gồm trường hợp nhân sự KCS làm hành chính. |
| 2 | CongNhan | 06:00 | 04:00 | 4 | **Bỏ khỏi danh mục cấu hình mới.** Đây là cách hiểu của yêu cầu “bỏ số 2”. |
| 3 | KCS-Ca1 | 07:30 | 22:30 | 1,5 | **Bỏ khỏi danh mục cấu hình mới.** |
| 4 | KCS-Ca2 | 13:00 | 22:00 | 1 | Giữ như một lựa chọn của KCS; KCS có thể làm ca 2 hoặc giờ hành chính. |
| 5 | ThoiVu | 06:00 | 05:00 | 4 | **Bỏ khỏi danh mục cấu hình mới.** |
| 6 | CN-6h-15h | 06:00 | 15:00 | 1 | **Giữ trong danh mục cấu hình mới.** |
| 7 | CN-6h-18h | 06:00 | 18:00 | 1,5 | Giữ như nhóm ca ngày; giờ ra thực tế có thể khoảng 17:00 vì người lao động đã hoàn tất việc. Không bắt buộc đúng 18:00. |
| 8 | CN-6h-20h | 06:00 | 20:00 | 2 | **Giữ trong danh mục cấu hình mới.** |
| 9 | CN-6h-5h | 06:00 | 05:00 | 3,5 | **Bỏ khỏi danh mục cấu hình mới.** |
| 10 | CN-18h-5h | 18:00 | 05:00 | 1,5 | **Giữ.** Cửa nhận thực tế: vào từ 17:00 đến trước 19:00, ra từ 04:00 đến trước 06:00 sáng hôm sau. Trường hợp vào lúc 18 giờ mấy và ra lúc 04 giờ mấy vẫn tính 1,5 công và hưởng 50.000 đồng phụ cấp đêm. |

Ảnh chưa chứng minh cửa nhận lượt vào/ra, lịch phân ca và các tùy chọn của ca đang áp dụng cho từng người. Vì CFCBase chỉ nhận file chấm công, tên ca trên chỉ giúp xây dựng cửa nhận diện; không được coi là lịch phân ca thực tế.

Các tổ hợp ca đêm đã được xác nhận rõ để dùng làm mẫu kiểm thử:

| Giờ vào | Giờ ra hôm sau | Kết quả |
|---|---|---|
| 17:30 | 04:30 | 1,5 công + 50.000 đồng phụ cấp đêm |
| 17:30 | 05:30 | 1,5 công + 50.000 đồng phụ cấp đêm |
| 18:30 | 04:30 | 1,5 công + 50.000 đồng phụ cấp đêm |
| 18:30 | 05:30 | 1,5 công + 50.000 đồng phụ cấp đêm |

Các ví dụ trên xác nhận hệ thống xét theo **cửa thời gian**, không yêu cầu đúng cặp 18:00–05:00 và không giảm công vì chênh lệch trong cửa đã cho phép.

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
| 06:00 → quanh 18:00 hoặc muộn hơn | 2 công | 17:59 và 18:01 đã được xác nhận; mốc chuyển chính xác giữa nhóm 17:34 và 17:59 cần kiểm thử bằng cấu hình |
| Ca đêm | Được mô tả 17:00 → 05:00 hôm sau | Khung giờ chính xác và các biến thể cần HR xác nhận |
| Ca đêm cuối tháng của Cường | Vẫn 1,5 công dù thiếu giờ ra 01/09 trong file | Người dùng trả lời “câu 2 vẫn tính là 1.5 công nhé” |
| 1,43; 1,42; 1,45 trong file cũ | Phải làm tròn lên 1,5 | Người dùng nhấn mạnh 39,68 là sai |
| 06:00 → khoảng 16:00 | 1,5 công | Xác nhận mới ngày 11/09/2026 |
| 06:00 → 17:59 hoặc 18:01 | 2 công | Xác nhận mới; coi là khoảng dao động quanh mốc 18:00 |
| Ca đêm hợp lệ/đã xác nhận | 1,5 công + 50.000 đồng | Phụ cấp ca đêm được lưu riêng khỏi số công |

Mẫu đối chiếu đã thống nhất sử dụng **1,5 công cho 19 ca đêm của Cường**, gồm ca cuối tháng theo xác nhận trên. Do đó kết quả nghiệm thu của mẫu là **45 công + 950.000 đồng phụ cấp ca đêm**. Đây chưa phải bảng hệ số cho ngày lễ, Chủ nhật hoặc các nhóm công nhân khác.

### 3.3 Các mâu thuẫn đã xử lý

1. Câu cũ **“12 tiếng = 1 công”** không dùng cho phiên bản chấm công công nhân này. Quy tắc mới theo loại ca/mốc giờ có hiệu lực ưu tiên.
2. Ảnh cấu hình Time Attendance cũ ghi `CN-6h-18h = 1,5`, nhưng quy tắc mới chốt nhóm kết thúc quanh 18:00 là 2 công. CFCBase dùng quy tắc mới; ảnh cũ chỉ phục vụ phân tích nguyên nhân báo cáo cũ bị sai.
3. `17:00 → 05:00` và `18:00 → 05:00` được coi là các biến thể trong cửa nhận ca đêm, không bắt buộc dấu vân tay đúng từng phút theo giờ chuẩn.
4. Các giá trị 1,40–1,45 được chuẩn hóa thành 1,5 vì thuộc cùng nhóm ca. Không dùng công thức làm tròn số học cho 1,01; 1,24; 1,51 hoặc các số lẻ khác.

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

## 7. Bảng quyết định nghiệp vụ

Các câu Q01–Q05 đã được người dùng trả lời và chốt thành quy tắc nền. Các mục còn thiếu dữ liệu được xử lý bằng cấu hình hoặc luồng kiểm tra thủ công, không được âm thầm suy đoán.

| Mã | Câu hỏi cần HR xác nhận | Vì sao cần | HR trả lời |
|---|---|---|---|
| Q01 | Có bảng phân ca theo người/ngày/tổ không? Ca có luân phiên theo chu kỳ hay đổi linh hoạt? Nếu không có bảng, HR đang xác định ca bằng cách nào? | 05:50 có thể là vào ca ngày hoặc ra ca đêm; không luôn nhận diện chắc chắn chỉ từ một dòng | Trưởng ca phân ca nhưng hệ thống không có dữ liệu phân ca. Phiên bản đầu nhận diện từ lượt chấm; ca mơ hồ đưa ra kiểm tra thủ công. |
| Q02 | Danh sách ca đang áp dụng, giờ chuẩn bắt đầu/kết thúc và công cho mỗi ca? Đêm 17–05 và 18–05 có phải hai ca khác nhau không? | Ảnh cũ, mô tả và giờ thực tế chưa đồng nhất | Loại `CongNhan` dòng 2, `KCS-Ca1`, `ThoiVu` và `CN-6h-5h`. Giữ `HC`, `KCS-Ca2`, `CN-6h-15h`, `CN-6h-18h`, `CN-6h-20h` và `CN-18h-5h`. `CN-6h-18h` có thể ra khoảng 17:00. `CN-18h-5h` dùng cửa vào 17:00–trước 19:00 và cửa ra 04:00–trước 06:00 hôm sau; toàn bộ khoảng này vẫn là ca đêm 1,5 công. |
| Q03 | Bảng ngưỡng cho 1 / 1,5 / 2 công là gì? Ví dụ vào 06:00, ra 14:00, 15:00, 16:00, 16:29, 16:30, 17:59, 18:00, 18:01, 20:00, 21:00? | Chưa biết ngưỡng chính xác và cách xử lý sát ranh giới | 06–14 = 1; nhóm kết thúc khoảng 16:00 và mẫu 17:12–17:34 = 1,5; từ cửa nhận 17:45 quanh mốc 18:00 trở đi = 2, tối đa 2. Các mốc là cấu hình. |
| Q04 | Làm tròn theo bậc cố định hay chỉ một số khoảng? 1,01; 1,24; 1,26; 1,49; 1,51 được tính bao nhiêu? | Ví dụ 1,42–1,45 lên 1,5 chưa xác định toàn bộ quy tắc | Không làm tròn số học. Nhận diện nhóm rồi trả đúng 1; 1,5; hoặc 2. Các số lẻ ngoài nhóm không được dùng làm đầu ra. |
| Q05 | Tính theo giờ thực tế, theo ca đăng ký hay mốc checkout? Có trừ nghỉ trưa/nghỉ giữa ca không? | Không thể mặc định lấy tổng giờ chia 8; chưa biết có phải tính số lẻ rồi làm tròn hay quy đổi trực tiếp | Tính theo ca nhận diện và mốc checkout; không lấy giờ chia 8, không trừ nghỉ giữa ca do file không có dữ liệu nghỉ. Ca đêm hợp lệ/đã xác nhận được thêm 50.000 đồng riêng. |
| Q06 | Ca cho phép chấm vào sớm/muộn, chấm ra sớm/muộn bao nhiêu phút? Đi trễ/về sớm có trừ công hay chỉ thống kê? | Tránh rớt như 16:55/16:59 và hiểu các trường hợp 17:53–05:02 | Giờ chấm có khoảng dao động. `CN-6h-18h` có thể kết thúc khoảng 17:00. `CN-18h-5h` nhận lượt vào 17:00–trước 19:00 và lượt ra 04:00–trước 06:00 hôm sau. Với ca ngày, mốc 2 công thử nghiệm bắt đầu 17:45. Đi trễ/về sớm chỉ thống kê/cảnh báo trong phiên bản đầu. |
| Q07 | Có nhóm công nhân/ca nào áp dụng 12 tiếng = 1 công không? Hay phát biểu ban đầu là nhầm? | Giải quyết mâu thuẫn với ví dụ 1,5 và 2 công | Không áp dụng 12 tiếng = 1 công trong phạm vi này. Dùng bảng quy đổi mới. |
| Q08 | Thiếu lượt vào hoặc ra giữa tháng xử lý thế nào? Không có cả hai lượt thì sao? Ai xác nhận? | Ngoại lệ ca 31 đã chốt không đồng nghĩa được tự điền/tính cho mọi ca thiếu lượt | Thiếu một lượt: cần kiểm tra/xác nhận, giữ giờ thiếu là trống. Không có cả hai lượt: 0 công, không tự tạo ca. |
| Q09 | Quy tắc ca đêm cuối tháng tính 1,5 có áp dụng toàn bộ công nhân/tháng không? Có thể xuất kèm sáng ngày đầu tháng sau và cuối tháng trước không? | Ghép ca qua ranh giới kỳ và tránh cộng trùng | Ghép lượt đầu tháng sau về ngày bắt đầu ca tháng trước. Nếu vẫn thiếu, người có quyền xác nhận. Ca đêm đã xác nhận được 1,5 công và 50.000 đồng. |
| Q10 | Có ca nối tiếp/ca kéo dài hơn một ngày hoặc nhiều lần ra vào không? File hai lượt/ngày có giữ đủ lượt gốc không? | Thiếu lượt do báo cáo đã gộp sẽ không thể tái tạo chắc chắn | Chưa trả lời |
| Q11 | 1,5/2 công đã bao gồm tăng ca hay tăng ca còn tính riêng? BT, CN, TC có ý nghĩa và đơn vị gì? | Tránh tính cùng thời gian hai lần | Phiên bản đầu coi 1/1,5/2 là kết quả công cuối của ca. Phụ cấp đêm 50.000 đồng tính riêng. Chưa tự tính BT/CN/TC khi chưa có định nghĩa. |
| Q12 | Chủ nhật/lễ có hệ số riêng? Nguồn xác nhận phép/nghỉ có lương/không lương là đâu? | Không suy ra lý do nghỉ từ lượt vân tay; mẫu có đi làm cuối tuần | Chưa trả lời |
| Q13 | Ca đêm và nghỉ sau ca cần ký hiệu gì trong file xuất? Có cần tổng số ca đêm, công ngày/đêm riêng không? | Chốt nội dung xuất ngoài việc giữ bố cục mẫu | Xuất thêm số ca đêm và tổng phụ cấp ca đêm; chi tiết web hiển thị loại ca. Ngày nghỉ sau ca chỉ có 0 công nếu không bắt đầu ca mới. |
| Q14 | Nhân viên không có trong danh mục CFCBase, mã trùng hoặc đổi mã được xử lý thế nào? Ai được điều chỉnh và xác nhận bảng công? | Chốt đối chiếu nhân viên và trách nhiệm sửa số liệu | Đối chiếu theo mã nhân viên. Mã thiếu/trùng/không tồn tại phải đưa ra kiểm tra; người quản lý HR xác nhận và mọi điều chỉnh phải lưu lý do/lịch sử. |

Trước khi nghiệm thu production cần lấy thêm vài ca thực tế sát 17:45, ca thiếu lượt giữa tháng và ca qua tháng để kiểm thử cửa nhận. Không cần HR diễn giải bằng công thức lập trình.

## 8. Hướng chức năng đã chốt cho phiên bản đầu

Đây là phạm vi đã đủ để bắt đầu thiết kế/triển khai. Các mốc giờ phải nằm trong cấu hình để có thể hiệu chỉnh sau nghiệm thu.

1. Tab **Chấm công công nhân** riêng, có cấu hình nghiệp vụ riêng để không làm thay đổi chấm công hành chính hiện hành.
2. Import file giờ chấm; chọn/nhận diện kỳ, mã nhân viên và các lượt chấm. Lưu bản gốc để đối soát, không ghi đè giờ gốc khi điều chỉnh.
3. Đối chiếu lịch ca; ghép lượt vào/ra qua ngày theo thời gian đầy đủ; không tái sử dụng một lượt cho hai ca.
4. Quy đổi trực tiếp từng ca theo nhóm mốc đã cấu hình rồi mới cộng tháng; không tính số công thập phân trung gian và không làm tròn số học.
5. Nhận diện các ứng viên HC, KCS ca 2, ca ngày công nhân và ca đêm công nhân theo cửa thời gian; trường hợp một chuỗi lượt có thể khớp nhiều ca phải đưa ra review. Kết quả công chỉ nhận 0; 1; 1,5; hoặc 2; không lưu số lẻ kiểu 1,43.
6. Tính phụ cấp đêm riêng bằng số ca đêm hợp lệ/đã xác nhận nhân 50.000 đồng. Lưu số ca, đơn giá và thành tiền để đối soát.
7. Xem chi tiết trên web: ngày bắt đầu ca, loại ca, ngày giờ vào/ra, công, phụ cấp đêm và lý do. Hiển thị rõ dữ liệu thiếu, ghép chưa chắc chắn và ngoại lệ cuối tháng; không âm thầm biến chúng thành 0.
8. HR kiểm tra/điều chỉnh với lý do; lưu người sửa và lịch sử; xác nhận bảng công.
9. Xuất bảng ngang theo mẫu: một người/một dòng, đủ ngày trong kỳ, tổng công, số ca đêm, phụ cấp đêm và các nhóm cột bổ sung có đủ dữ liệu.
10. Xem trên web và xuất Excel dùng cùng kết quả đã xác nhận. Giữ khả năng đối chiếu ngược mỗi ô công về các lượt chấm và quy tắc đã áp dụng.

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
- [ ] Ca đêm vào lúc 17:00, 17:30 hoặc 18 giờ mấy và ra lúc 04 giờ mấy hoặc 05 giờ mấy hôm sau đều được nhận diện; kiểm thử ít nhất các cặp 17:30–04:30, 17:30–05:30, 18:30–04:30 và 18:30–05:30, tất cả đều bằng **1,5 công + 50.000 đồng**.
- [ ] Lượt nằm ngoài cửa ca đêm không bị tự động xóa hoặc tự động cho 0 công; hệ thống đưa ra danh sách cần kiểm tra.
- [ ] B124 có 19 ca đêm và **950.000 đồng** phụ cấp đêm; phụ cấp không làm thay đổi tổng 45 công.
- [ ] File xuất và số hiển thị trên web khớp nhau.
- [ ] Bổ sung tháng 9 không làm cộng trùng ca 31/08.
- [ ] Kiểm tra thêm nhân viên khác và các mốc quy đổi sau khi HR cung cấp đáp án.

### Điểm tiếp tục công việc

Có thể bắt đầu đọc source và thiết kế tab **Chấm công công nhân** theo mục 0 và mục 8. Trước khi production cần kiểm thử nhiều nhân viên, đặc biệt các lượt sát cửa 17:45, ca thiếu lượt và ca qua tháng. Phân tích mẫu 45 công chưa tự chứng minh nhận diện đúng cho toàn bộ công nhân.
