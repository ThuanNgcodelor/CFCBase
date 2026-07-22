# Báo Cáo Baseline Nhân Sự — Phase 0.1

Ngày hoàn thành: **2026-07-22**
Phạm vi: chỉ workbook/template; không thay đổi backend, frontend, database hoặc server.
Kết luận: **PASS**.

## 1. Artifact đã khóa

| Artifact | Kích thước | SHA-256 |
| --- | ---: | --- |
| File gốc `docs/Danh sách nhân sự 2026.xlsx` | 1.619.832 byte | `3e88290c865b73870c6557ff06b8273fcff012f22225c094526d020c39359a60` |
| Archive bản người dùng format | 810.609 byte | `8c4d54aa757fc75a16a5ab15b031c1245668a0dfdc4a99afb42f6ea143fef195` |
| Baseline Phase 0.1 | 118.239 byte | `d8f4ff9e292b68d1ec50b623159ef34095f7441d3487fa1e422140f0fdeaadbe` |

File gốc và archive format là input bất biến. Builder chỉ sinh lại `baseline-values-2026.xlsx` từ archive, không sửa hai input.

## 2. Đối chiếu dữ liệu với file gốc

### T6-26

| Kiểm tra | Kết quả |
| --- | ---: |
| Hàng nhân sự | 329/329 |
| Mã nhân viên duy nhất | 329/329 |
| Cột nghiệp vụ được mapping | 33 |
| Ô đã so sánh | 10.857/10.857 |
| Sai lệch | 0 |
| Comment đã mapping/so sánh | 18/18 |
| Sai lệch comment | 0 |

Mapping:

```text
Mới A:J  <- Gốc A:J
Mới K:P  <- Gốc L:Q
Mới Q:U  <- Gốc T:X
Mới V:AG <- Gốc AA:AL
Mới AH   <- NGÀY NGHỈ PHÉP mới
```

Năm cột gốc được bỏ có vai trò kỹ thuật:

- `K`: helper giới tính suy ra từ cột `J`.
- `R` và `S`: hai nhánh sao chép ngày làm từ `Q`; cộng lại phủ đủ 329 hàng.
- `Y` và `Z`: lookup/EXACT kiểm tra CCCD, không phải trường quốc tịch hay hồ sơ chính.

### GIAM và TĂNG

| Sheet | Ô có dữ liệu đã so sánh | Sai lệch |
| --- | ---: | ---: |
| `GIAM` | 130 | 0 |
| `TĂNG` | 119 | 0 |

Hai sheet này giữ nguyên dữ liệu lịch sử người dùng đã format. Phase 0.1 không tự sửa năm, nội dung hoặc các vùng đang để trống vì chưa có quyết định nghiệp vụ cho chúng.

## 3. Bảo toàn format bản người dùng

- `styles.xml` giống byte-for-byte với archive format.
- `GIAM`: 990 ô được giữ, 0 sai lệch value/type/style.
- `TĂNG`: 2.353 ô được giữ, 0 sai lệch value/type/style.
- `T6-26`: 11.314 ô trong `A1:AH333` được giữ, 0 sai lệch value/type/style.
- Giữ nguyên hai comment `GIAM`, 18 comment `T6-26` và VML tương ứng.
- Không sửa nội dung header `Z4` của bản người dùng. Cụm từ `Sau sát nhập` có thể chuẩn hóa thành `SAU SÁP NHẬP` ở nhãn UI/schema Phase 1, nhưng không được âm thầm đổi baseline đã khóa.

## 4. Cleanup có chủ đích

| Hạng mục | Trước | Sau |
| --- | ---: | ---: |
| Sheet vật lý | 28 | 3 |
| Sheet ẩn | 25 | 0 |
| OOXML parts | 98 | 17 |
| Used range `T6-26` | `A1:CT1000` | `A1:AH333` |
| Công thức giả `#N/A` | 29 | 0 formula node |
| Giá trị literal `#N/A` còn lại | 29 | 29 |
| Shared-string cell đã chuyển inline | 7.130 | 7.130 |

Cleanup đã:

- Xóa 25 sheet ẩn và toàn bộ worksheet/comment/VML/drawing relationship đi kèm.
- Xóa 667 hàng style rỗng sau hàng 333 và 3.438 cell ngoài schema `A:AH`.
- Xóa 54 giá trị helper tại `AI101:CJ101` cùng các ô style rác phía phải.
- Xóa hai merge rỗng tại hàng 335–336 và empty drawing của `T6-26`.
- Chuyển shared strings của ba sheet còn lại thành inline strings; dữ liệu sheet đã xóa không còn nằm trong package để phục hồi.
- Giữ 29 giá trị lỗi `#N/A` nhưng bỏ node pseudo-formula do LibreOffice tạo.
- Chuẩn hóa vị trí mở file/freeze pane; thêm filter/print contract cho `T6-26`.

## 5. Kiểm thử cuối

- Deterministic builder: **PASS**.
- Strict verifier và manifest exact match: **PASS**.
- ZIP integrity (`unzip -t`): **PASS**.
- Relationship/content-type/dangling part audit: **PASS**.
- LibreOffice headless open và PDF export smoke test: **PASS**.
- Permission workbook/archive/source: `0600`.

PDF chỉ được tạo trong `/tmp` để smoke test, không phải artifact bàn giao.

## 6. Phạm vi chưa làm

- Chưa tạo migration, bảng HR, API, UI, import hoặc export runtime.
- Chưa bắt đầu Phase 1.
- Chưa biến 29 `#N/A` thành dữ liệu hợp lệ; Phase 2 phải hiển thị chúng là trường thiếu/cần xác minh.
- Baseline chứa PII và không phải blank template chia sẻ công khai.
