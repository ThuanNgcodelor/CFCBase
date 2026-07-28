# CFC People Operations — Google Apps Script

Ứng dụng HR này gồm:

- React/Vite ở `src/client`.
- Dịch vụ Apps Script ở `src/server`.
- Artifact duy nhất được phép đẩy lên Google ở `dist`.

`clasp` phải dùng `rootDir: "dist"`. Không đẩy trực tiếp `src/client`, vì Apps
Script không hỗ trợ câu lệnh ES module `import`.

## 1. Chuẩn bị một lần

### Google Sheet dữ liệu

Tạo một Google Sheet trống dành riêng cho HR và lấy ID nằm giữa `/d/` và
`/edit` trong URL. Lần mở ứng dụng đầu tiên sẽ tự tạo 10 sheet dữ liệu chuẩn.

Không dùng trực tiếp file `.xlsx` làm cơ sở dữ liệu. Ứng dụng hiện không tự
import workbook HR cũ; việc nhập/migrate dữ liệu cũ là một quy trình riêng.

### Mẫu hợp đồng thử việc

Mở file `backend/src/main/resources/hr/templates/probation-contract-template.docx`
trên Google Drive, chọn lưu/chuyển đổi thành Google Docs native, rồi lấy File ID
của Google Docs đó.

Mẫu phải có đúng một lần cho mỗi placeholder:

```text
{{CONTRACT_NO}}
{{CONTRACT_YEAR}}
{{SIGN_DAY}}
{{SIGN_MONTH}}
{{SIGN_YEAR}}
{{CANDIDATE_TITLE}}
{{FULL_NAME}}
{{NATIONALITY}}
{{DATE_OF_BIRTH}}
{{BIRTH_PLACE}}
{{PERMANENT_ADDRESS}}
{{CITIZEN_ID}}
{{CITIZEN_ID_ISSUED_DATE}}
{{CITIZEN_ID_ISSUED_PLACE}}
{{PROBATION_CONTRACT_TYPE}}
{{PROBATION_START_DATE}}
{{PROBATION_END_DATE}}
{{POSITION_NAME}}
{{JOB_DESCRIPTION}}
{{BASE_SALARY_TEXT}}
{{SALARY_NOTE}}
{{DEPARTMENT_RULE_NOTE}}
```

Tạo thêm một thư mục Google Drive riêng để chứa hợp đồng sinh ra và lấy Folder
ID. Không bật chia sẻ công khai cho Sheet, mẫu hoặc thư mục này.

### Script Properties

Trong Apps Script chọn **Project Settings → Script properties** và khai báo:

| Key | Bắt buộc | Giá trị |
| --- | --- | --- |
| `APP_ENV` | Có | `production` |
| `PRIMARY_SPREADSHEET_ID` | Có | ID Google Sheet HR |
| `PROBATION_TEMPLATE_FILE_ID` | Khi sinh HĐ | ID Google Docs mẫu |
| `DOCUMENT_ROOT_FOLDER_ID` | Khi sinh HĐ | ID thư mục Drive riêng |
| `APP_RELEASE_VERSION` | Nên có | Ví dụ `2026.07.28.1` |
| `PROBATION_TEMPLATE_VERSION` | Không | Mặc định `V1` |
| `PROBATION_PLACEHOLDER_SCHEMA_VERSION` | Không | Mặc định `PC22_V1` |
| `MAX_PAGE_SIZE` | Không | Mặc định `500` |
| `INTERNAL_ACTOR_ID` | Không | Mặc định `HR_INTERNAL_SERVICE` |
| `INTERNAL_ACTOR_NAME` | Không | Mặc định `HR Internal Service` |

Không dán các ID Drive/Sheet vào mã nguồn.

## 2. Build và kiểm tra trước khi push

```bash
cd /home/david-nguyen/Works/BookingBase/QuanLyNhanSu_AppScripts
npm run check
```

Lệnh trên kiểm tra cú pháp server, chạy test nền tảng, build React thành
`dist/Index.html`, build server thành `dist/Code.js`, copy manifest và kiểm tra
artifact. Nếu thành công, `dist` chỉ có các file Apps Script hợp lệ.

Có thể xem chính xác file nào sẽ được đẩy:

```bash
npx @google/clasp show-file-status
```

Kết quả hợp lệ chỉ gồm:

```text
Code.js
Index.html
appsscript.json
```

## 3. Push mã nguồn

Đăng nhập một lần nếu máy chưa đăng nhập:

```bash
npx @google/clasp login
```

File `.clasp.json` tại thư mục dự án phải có Script ID thật và:

```json
{
  "scriptId": "SCRIPT_ID_CUA_BAN",
  "rootDir": "dist"
}
```

Sau khi `npm run check` thành công:

```bash
npx @google/clasp push
```

`clasp push` thay toàn bộ mã của project Apps Script, nhưng chưa tự cập nhật
phiên bản Web App đang chạy.

## 4. Deploy Web App

Mở project:

```bash
npx @google/clasp open-script
```

Trong Apps Script:

1. Chọn **Deploy → New deployment**.
2. Chọn loại **Web app**.
3. Chọn **Execute as: Me / User deploying** để server dùng quyền Drive và
   Sheet của người triển khai.
4. Chọn phạm vi truy cập phù hợp. Ứng dụng không có màn hình đăng nhập riêng;
   với dữ liệu HR nên ưu tiên tài khoản trong tổ chức hoặc người dùng Google
   được phép, không nên mở anonymous.
5. Chọn **Deploy**, cấp quyền Sheets, Drive và Docs, rồi mở URL `/exec`.

Khi cập nhật code lần sau:

```bash
npm run check
npx @google/clasp push
```

Sau đó vào **Deploy → Manage deployments → Edit → New version → Deploy** để URL
Web App hiện tại chạy bản mới. URL `/dev` trong **Test deployments** luôn chạy
mã mới nhất nhưng chỉ dành cho người có quyền sửa project.

## 5. Dùng hệ thống lần đầu

1. Mở **Danh mục** và tạo Phòng ban, Chức vụ, Điều kiện làm việc.
2. Mở **Nhân sự → Thêm nhân sự** để tạo hồ sơ `DRAFT`.
3. Mở **Biến động**, tạo bản nháp tăng nhân sự, xem trước rồi xác nhận. Nhân sự
   chuyển sang `ACTIVE` và xuất hiện trong danh sách tháng.
4. Mở **Thử việc → Mẫu công việc**, tạo mẫu `DRAFT`, điền đủ lương, mô tả và
   nội quy, sau đó **Kích hoạt**.
5. Tạo ứng viên, chọn mẫu đang `ACTIVE`, nhập đủ CCCD/địa chỉ/thời gian thử
   việc, rồi bấm **Sinh HĐ**. Hệ thống tạo Google Doc, PDF và DOCX trong thư mục
   Drive riêng.
6. Sau hợp đồng: **Bắt đầu → Đạt/Không đạt → Chuyển nhân sự**. Hồ sơ chuyển đổi
   được tạo ở trạng thái nhân sự `DRAFT`.
7. Mở **Danh sách tháng** để xem roster và tải bản Excel từ Google Sheet.

## 6. Lỗi thường gặp

### `Cannot use import statement outside a module`

Nguyên nhân: `.clasp.json` đang dùng `rootDir: "."` và đẩy `src/client`.

Khắc phục:

```bash
npm run check
npx @google/clasp show-file-status
npx @google/clasp push
```

Đồng thời xác nhận `.clasp.json` dùng `"rootDir": "dist"`.

### Mở Web App nhưng chưa có dữ liệu

Đây là trạng thái đúng của Sheet mới. Tạo danh mục và dữ liệu mới trong giao
diện, hoặc thực hiện migration workbook cũ trước khi dùng production.

### Push xong nhưng giao diện vẫn là bản cũ

Tạo **New version** trong **Manage deployments**. `clasp push` không tự đổi
version của deployment `/exec`.

### Không sinh được DOCX/PDF

Kiểm tra hai Script Properties của mẫu/thư mục, quyền truy cập Google Drive,
và mẫu phải là Google Docs native. Manifest đã bật Advanced Drive service v3;
nếu project dùng Google Cloud project tiêu chuẩn, Drive API cũng phải được bật
trong Google Cloud Console.
