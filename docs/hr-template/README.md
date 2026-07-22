# HR Excel — Phase 0.1

Trạng thái: **hoàn thành ngày 2026-07-22**. Phase 1 chưa bắt đầu.

## Artifact đang dùng

| Artifact | Vai trò | SHA-256 |
| --- | --- | --- |
| `docs/Danh sách nhân sự 2026.xlsx` | File gốc bất biến để đối chiếu | `3e88290c865b73870c6557ff06b8273fcff012f22225c094526d020c39359a60` |
| `archive/baseline-values-2026-user-formatted-source.xlsx` | Bản người dùng đã format, khóa làm build input | `8c4d54aa757fc75a16a5ab15b031c1245668a0dfdc4a99afb42f6ea143fef195` |
| `baseline-values-2026.xlsx` | Baseline sạch dùng cho Phase 2 | `d8f4ff9e292b68d1ec50b623159ef34095f7441d3487fa1e422140f0fdeaadbe` |

Ba workbook đều chứa dữ liệu nhân sự thật, chỉ lưu local, bị `.gitignore` và có quyền `600`. Không gửi các file này như blank template công khai.

## Contract cuối Phase 0.1

- Chỉ còn đúng ba sheet vật lý, đều hiển thị: `GIAM`, `TĂNG`, `T6-26`.
- `T6-26` chỉ còn vùng `A1:AH333`; hàng nhân sự là `5:333`.
- `AH4 = NGÀY NGHỈ PHÉP`; `AH5:AH333` để trống.
- Có 329 nhân sự và 329 mã nhân viên duy nhất.
- Không còn sheet ẩn, công thức ô, shared-string chứa dữ liệu sheet đã xóa, external link hoặc relationship mồ côi.
- Giữ nguyên 29 giá trị `#N/A` legacy ở cột `Z` dưới dạng literal để Phase 2 báo là dữ liệu cần xác minh; không đổi thành chuỗi nghiệp vụ hợp lệ.
- Giữ 18 comment tại `T6-26`, hai comment tại `GIAM`, toàn bộ `styles.xml`, định dạng ô, row height và column width của vùng được giữ.
- Freeze pane: hàng 8 cho `GIAM`/`TĂNG`, ô `F5` cho `T6-26`.
- `T6-26` có filter `A4:AH333`, print area `A1:AH333`, A4 landscape và fit một trang theo chiều ngang.

## Đối chiếu với file gốc

- `T6-26`: 33 cột x 329 hàng = `10.857/10.857` ô khớp, `0` sai lệch.
- `GIAM`: 130 ô có dữ liệu khớp, `0` sai lệch.
- `TĂNG`: 119 ô có dữ liệu khớp, `0` sai lệch.
- 18/18 comment `T6-26` khớp sau mapping cột.

Mapping `T6-26`:

```text
Mới A:J  <- Gốc A:J
Mới K:P  <- Gốc L:Q
Mới Q:U  <- Gốc T:X
Mới V:AG <- Gốc AA:AL
Mới AH   <- Cột ngày nghỉ phép mới, để trống
```

Các cột gốc `K`, `R`, `S`, `Y`, `Z` bị loại là cột helper/lookup/validation, không phải dữ liệu hồ sơ chính. Chi tiết đầy đủ ở [báo cáo Phase 0.1](PHASE_0_1_BASELINE_REPORT.md).

## Tạo lại và kiểm tra

Chạy từ thư mục gốc dự án:

```bash
python3 scripts/hr-template/build-baseline-values-2026.py
python3 scripts/hr-template/verify-baseline-values-2026.py
unzip -t "docs/hr-template/baseline-values-2026.xlsx"
```

Builder luôn đọc từ archive đã khóa checksum, không dùng file output hiện tại làm đầu vào. Output được ghi theo kiểu temp -> verify -> atomic replace và đặt quyền `600`.

Verifier kiểm tra deterministic transform, ZIP/OOXML relationships, sheet/range/formula/comment/style, permission, manifest và đối chiếu lại file gốc. Manifest chỉ chứa checksum/số đếm, không chứa tên, email hoặc giá trị hồ sơ nhân sự.

## Bước tiếp theo

- Chỉ bắt đầu Phase 1 khi có yêu cầu riêng của người dùng.
- Phase 2 sẽ preview/validate dữ liệu tại `T6-26!A4:AH333`; không insert trực tiếp khi upload.
- Blank template dành cho import/export sẽ là artifact riêng ở Phase 6, không dùng baseline có PII để phát tán.
