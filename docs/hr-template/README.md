# HR Excel Template v1

Thư mục này quản lý hợp đồng Phase 0 cho template nhân sự.

## File

- `template-v1-manifest.json`: checksum và invariants không chứa dữ liệu PII.
- `PHASE_0_TEMPLATE_REPORT.md`: báo cáo tạo/kiểm tra template.
- `Danh sách nhân sự 2026 - template-v1.xlsx`: file local chứa PII, đã được `.gitignore` và đặt quyền `600`.

File nguồn bất biến nằm tại `docs/Danh sách nhân sự 2026.xlsx` và cũng không được Git theo dõi.

## Tạo template

Từ thư mục gốc dự án:

```bash
python3 scripts/hr-template/build-template-v1.py
```

Script chỉ thực hiện:

1. Kiểm tra SHA-256 file nguồn.
2. Sao chép toàn bộ OOXML package.
3. Patch `xl/worksheets/sheet12.xml` tương ứng `T6-26`.
4. Dùng cột `AM` có sẵn, không insert/shift cột.
5. Ghi `AM4 = NGÀY NGHỈ PHÉP`.
6. Tạo các ô trống có style tại `AM5:AM333`.
7. Verify trước khi atomic move thành template chính thức.
8. Sinh manifest aggregate không chứa PII.

Nếu template đã tồn tại, lệnh chỉ chấp nhận file đúng hợp đồng; file khác sẽ bị từ chối và không bị ghi đè âm thầm.

## Kiểm tra

```bash
python3 scripts/hr-template/verify-template-v1.py
unzip -t "docs/hr-template/Danh sách nhân sự 2026 - template-v1.xlsx"
sha256sum "docs/Danh sách nhân sự 2026.xlsx"
```

Verifier bắt buộc:

- Nguồn đúng checksum đã khóa.
- 141 OOXML part và thứ tự part giữ nguyên.
- Tất cả part ngoài `sheet12.xml` giữ nguyên nội dung giải nén.
- `sheet12.xml` đúng chính xác kết quả patch allowlist.
- Formula fingerprint, cached errors, comments, merges, filter, freeze pane, printer settings, VML và external link không đổi.
- `AN101:CQ101` không bị dịch chuyển.
- `AM5:AM333` còn trống và style tương ứng với `AL` theo từng dòng.

## Bảo mật

- Không đưa workbook vào `backend/src/main/resources` vì Maven sẽ đóng gói nó vào JAR.
- Không commit file `.xlsx` có dữ liệu nhân sự.
- Không gửi workbook lên dịch vụ online để kiểm tra/convert.
- Chỉ manifest, tài liệu và script verifier phù hợp để lưu trong source control.

## Tạo phiên bản mới

Không sửa template v1 tại chỗ. Khi nguồn đã được duyệt thay đổi, cần:

1. Giữ lại checksum/manifest v1.
2. Audit lại source mới.
3. Tạo filename và contract version mới.
4. Chỉ chuyển active version sau khi verifier và UAT đều pass.
