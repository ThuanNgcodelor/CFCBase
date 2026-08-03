# CFC People Operations — Google Apps Script

Ứng dụng HR này gồm:

- React/Vite ở `src/client`.
- Dịch vụ Apps Script ở `src/server`.
- Artifact duy nhất được phép đẩy lên Google ở `dist`.

`clasp` phải dùng `rootDir: "dist"`. Không đẩy trực tiếp `src/client`, vì Apps
Script không hỗ trợ câu lệnh ES module `import`.

## 1. Chuẩn bị một lần

### Google Sheet dữ liệu

Dùng một Google Sheet riêng cho HR và lấy ID nằm giữa `/d/` và `/edit` trong
URL. Lần mở ứng dụng đầu tiên sẽ tự tạo các sheet dữ liệu chuẩn.

Nếu dữ liệu cũ đang ở file `.xlsx`, hãy mở/import file đó thành Google Sheets
trước. Tab danh sách cũ (ví dụ `T6-26`) phải nằm trong chính Sheet được cấu hình
bởi `PRIMARY_SPREADSHEET_ID`. Ứng dụng sẽ đọc tab cũ, cho xem trước, rồi chỉ ghi
vào các sheet chuẩn sau khi người dùng xác nhận. Tab nguồn không bị xóa, đổi tên
hoặc ghi đè.

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
4. Giữ **Only myself** nếu chỉ một tài khoản HR vận hành. Manifest mặc định dùng
   `MYSELF`; ứng dụng không có màn hình đăng nhập riêng.
5. Nếu công ty dùng Google Workspace và nhiều nhân sự HR cần truy cập, đổi
   `webapp.access` trong `appsscript.json` thành `DOMAIN`, build lại rồi deploy.
   Không dùng `ANYONE` hoặc `ANYONE_ANONYMOUS` cho dữ liệu nhân sự.
6. Chọn **Deploy**, cấp quyền Sheets, Drive và Docs, rồi mở URL `/exec`.

Khi cập nhật code lần sau:

```bash
npm run check
npx @google/clasp push
```

Sau đó vào **Deploy → Manage deployments → Edit → New version → Deploy** để URL
Web App hiện tại chạy bản mới. URL `/dev` trong **Test deployments** luôn chạy
mã mới nhất nhưng chỉ dành cho người có quyền sửa project.

## 5. Dùng hệ thống lần đầu

### Nhập danh sách cũ

1. Mở **Nhập dữ liệu**.
2. Bấm **Xem trước dữ liệu**. Với file hiện tại, kết quả mong đợi là tab
   `T6-26`, hàng tiêu đề `4`, tổng cộng `336` dòng và không có dòng lỗi.
3. Kiểm tra số dòng hợp lệ, trùng và cảnh báo. Xem trước là thao tác chỉ đọc.
4. Tích ô xác nhận và bấm **Xác nhận nhập 336 hồ sơ**. Chỉ bấm một lần và chờ
   thông báo hoàn tất.
5. Hệ thống tự tạo/tái sử dụng Phòng ban, Chức vụ, Điều kiện làm việc; hồ sơ
   được nhập ở trạng thái `ACTIVE`. Chạy lại vẫn an toàn vì mã nhân sự đã có sẽ
   được bỏ qua.
6. Tải lại **Tổng quan** và **Nhân sự**; số đang làm việc phải là `336`.

### Vận hành tiếp theo

1. Mở **Nhân sự → Thêm nhân sự** để tạo hồ sơ `DRAFT` khi có người mới.
2. Mở **Tăng / Giảm**, tạo bản nháp, xem trước rồi xác nhận biến động.
3. Mở **Danh sách tháng**, chọn đúng tháng cần báo cáo và bấm **Tải Excel**.
   File tải xuống chỉ gồm `TĂNG`, `GIẢM` và tab danh sách `T<THÁNG>-<NĂM>`,
   không còn các sheet kỹ thuật tiếng Anh.
4. Mở **Thử việc → Mẫu công việc**, tạo mẫu `DRAFT`, điền đủ lương, mô tả và
   nội quy, sau đó **Kích hoạt**.
5. Tạo ứng viên, chọn mẫu đang `ACTIVE`, nhập đủ CCCD/địa chỉ/thời gian thử
   việc, rồi bấm **Sinh HĐ**. Hệ thống tạo Google Doc, PDF và DOCX trong thư mục
   Drive riêng.
6. Sau hợp đồng: **Bắt đầu → Đạt/Không đạt → Chuyển nhân sự**. Hồ sơ chuyển đổi
   được tạo ở trạng thái nhân sự `DRAFT`.

### Giới hạn của bản Apps Script

Danh sách thuộc/không thuộc biên chế của từng tháng được chiếu theo ngày hiệu
lực và kỳ baseline. Tuy nhiên các trường hồ sơ có thể thay đổi như lương, hợp
đồng và địa chỉ chưa có bảng snapshot theo tháng; khi cần tái xuất lịch sử tuyệt
đối sau các thay đổi này, phải bổ sung mô hình snapshot/effective-date trước.

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

Dashboard chỉ đọc các sheet chuẩn như `EMPLOYEES`; nó không đọc trực tiếp tab
`T6-26`. Mở **Nhập dữ liệu → Xem trước dữ liệu → Xác nhận nhập** để chuyển dữ
liệu cũ vào schema chuẩn.

### Không nhận diện được tab dữ liệu cũ

Kiểm tra tab nguồn:

- Nằm trong Google Sheet có ID đúng với `PRIMARY_SPREADSHEET_ID`.
- Không trùng tên một sheet chuẩn.
- Hàng tiêu đề nằm trong 25 dòng đầu.
- Có ít nhất hai cột `MÃ SỐ` và `HỌ VÀ TÊN`.

Ứng dụng không nhận file `.xlsx` từ trình duyệt; cần import file vào Google
Sheets trước.

### Báo `Không xác định được kỳ dữ liệu nền`

Tên tab nguồn cần chứa kỳ theo dạng `T6-26` hoặc `T6-2026` trước lần xác nhận
import đầu tiên. Hệ thống chỉ lưu kỳ chuẩn hóa `2026-06` trong audit, không lưu
tên tab nguồn vì tên đó có thể chứa thông tin cá nhân.

### Push xong nhưng giao diện vẫn là bản cũ

Tạo **New version** trong **Manage deployments**. `clasp push` không tự đổi
version của deployment `/exec`.

### File tháng vẫn có các sheet tiếng Anh

Bạn đang dùng deployment cũ hoặc tải trực tiếp toàn bộ Google Sheet. Hãy tạo
**New version** cho Web App, sau đó tải bằng nút **Tải Excel** trong
**Danh sách tháng**. Bản mới sinh một workbook tạm riêng, tải về cho trình
duyệt rồi xóa workbook tạm.

### Không sinh được DOCX/PDF

Kiểm tra hai Script Properties của mẫu/thư mục, quyền truy cập Google Drive,
và mẫu phải là Google Docs native. Manifest đã bật Advanced Drive service v3;
nếu project dùng Google Cloud project tiêu chuẩn, Drive API cũng phải được bật
trong Google Cloud Console.
