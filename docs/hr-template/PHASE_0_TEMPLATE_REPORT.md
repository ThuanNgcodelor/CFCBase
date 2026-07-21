# Báo Cáo Phase 0 — HR Excel Template v1

Ngày thực hiện: 2026-07-21  
Kết quả: `PASS`

## 1. Artifact

- Nguồn bất biến: `docs/Danh sách nhân sự 2026.xlsx`.
- Template local: `docs/hr-template/Danh sách nhân sự 2026 - template-v1.xlsx`.
- Contract: `docs/hr-template/template-v1-manifest.json`.
- Builder: `scripts/hr-template/build-template-v1.py`.
- Verifier: `scripts/hr-template/verify-template-v1.py`.

| File | SHA-256 |
| --- | --- |
| Source | `3e88290c865b73870c6557ff06b8273fcff012f22225c094526d020c39359a60` |
| Template v1 | `03f5b8dd8da693220f0229db42e2f7e776b6349931957dada1d03f43c3cb2357` |

Workbook nguồn và template đều được đặt quyền `600`; file `.xlsx` được ignore khỏi Git vì chứa PII.

## 2. Baseline đã khóa

Workbook:

- 33 sheet: 28 visible, 5 hidden.
- 141 OOXML part.
- 27.343 công thức.
- 191 vùng merge.
- 261 comment trong 22 comment part.
- 1.370 cell style.
- 6 dòng ẩn và 24 column-dimension ẩn.
- 23 printer-settings part, 22 VML drawing part.
- 1 external workbook link và có `calcChain.xml`.

Sheet `T6-26`:

- OOXML part: `xl/worksheets/sheet12.xml`.
- Dimension: `A1:CQ720`.
- Filter: `A4:CQ362`.
- Freeze pane tại `F1`.
- 329 nhân sự ở hàng 5–333 và 329 mã nhân sự duy nhất.
- 4.150 công thức, 18 comment, 4 vùng merge.
- 11.250 ô có nội dung trước khi tạo template.
- `AM` trống hoàn toàn trong source.
- 56 ô dữ liệu phụ tại `AN101:CQ101` phải giữ đúng tọa độ.

## 3. Thay đổi được cho phép

Chỉ `sheet12.xml` được thay đổi:

- Dùng cột 39 (`AM`) có sẵn, không insert cột.
- Width của `AM` được sao chép từ `AL`; dải default phía sau bắt đầu lại từ `AN`.
- `AM4 = NGÀY NGHỈ PHÉP`, style lấy từ `AL4`.
- Tạo 329 ô trống `AM5:AM333`, style lấy từ ô `AL` cùng dòng; nếu ô `AL` không tồn tại thì dùng default style của cột `AL`.
- Row span chỉ được mở rộng tới cột 39 khi cần.

Tổng cộng template có 330 ô `AM4:AM333`; chỉ `AM4` có nội dung. Không có công thức hoặc giá trị ngày phép được ghi ở Phase 0.

## 4. Invariants đã kiểm tra

- SHA-256 source không đổi.
- Danh sách và thứ tự 141 OOXML part không đổi.
- Mọi part ngoài `sheet12.xml` giống source theo nội dung giải nén.
- Formula count và formula fingerprint toàn workbook/T6-26 không đổi.
- Sheet name/order/state, merge, comment, filter và freeze pane không đổi.
- `styles.xml`, `sharedStrings.xml`, `calcChain.xml`, VML, printer settings và external link không đổi.
- Số nhân sự, mã nhân sự duy nhất và vùng dữ liệu phụ `AN:CQ` không đổi.
- Không phát sinh cached formula error mới.

## 5. Lỗi legacy được giữ nguyên

Phase 0 ghi nhận nhưng không tự sửa:

- Toàn workbook: 1.226 cached errors, gồm 562 `#N/A` và 664 `#REF!`.
- `T6-26`: 165 cached errors, gồm 160 `#N/A` và 5 `#REF!`.
- External workbook link hiện tại vẫn được giữ nguyên.

Đây là baseline để phát hiện regression. Việc làm sạch dữ liệu/công thức phải là task riêng, có đối chiếu nghiệp vụ và không được trộn vào tạo template.

## 6. Phạm vi không thay đổi

- Không sửa backend/POM.
- Không sửa frontend.
- Không thay đổi database.
- Không start, stop, restart hoặc deploy server production.
- Không dùng `openpyxl.save()`, LibreOffice save hoặc Apache POI round-trip trên file nguồn.

## 7. Lệnh kiểm tra lại

```bash
python3 scripts/hr-template/verify-template-v1.py
unzip -t "docs/hr-template/Danh sách nhân sự 2026 - template-v1.xlsx"
sha256sum "docs/Danh sách nhân sự 2026.xlsx"
stat -c '%a %n' \
  "docs/Danh sách nhân sự 2026.xlsx" \
  "docs/hr-template/Danh sách nhân sự 2026 - template-v1.xlsx"
```

Kỳ vọng: verifier `PASS`, unzip không lỗi, source hash đúng baseline và hai workbook có quyền `600`.
