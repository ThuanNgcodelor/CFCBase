# Kế Hoạch Triển Khai Phân Hệ Quản Lý Nhân Sự

Cập nhật: 2026-07-21  
Trạng thái: đã chốt kiến trúc, Phase 0 template đã triển khai

## 1. Mục Tiêu

Xây dựng một phân hệ quản lý nhân sự độc lập trong BookingBase để `MANAGER` có thể:

- Quản lý hồ sơ nhân sự, phòng ban, chức vụ và điều kiện lao động.
- Thêm, sửa, xem chi tiết, ngừng làm việc và xử lý sai sót dữ liệu.
- Theo dõi tăng/giảm nhân sự theo tháng.
- Tạo snapshot danh sách nhân sự từng tháng.
- Import/preview/validate và export Excel.
- Quản lý CCCD, BHXH, BHYT, liên hệ, quá trình công tác và ngày nghỉ phép.
- Xem lịch sử thay đổi và truy vết người thao tác.

## 2. Kiến Trúc Đã Chốt

### 2.1 Employee tách hoàn toàn khỏi User

- `Employee` là miền dữ liệu HR riêng, không phải `User` mở rộng.
- Không có `user_id`, foreign key hoặc đồng bộ ngầm `User -> Employee`.
- Tài khoản dùng để đăng nhập và hồ sơ nhân sự có vòng đời độc lập.
- Không sửa flow login, register, profile hoặc booking để phục vụ HR.

### 2.2 Danh mục HR riêng

Tạo riêng các danh mục:

- `hr_departments`: phòng ban HR.
- `hr_positions`: chức vụ HR.
- `hr_working_conditions`: điều kiện/môi trường lao động.

Không tái sử dụng `Department` hoặc dữ liệu chức vụ hiện tại của BookingBase.

### 2.3 Phân quyền

- Chỉ role hiện có `MANAGER` được truy cập phân hệ HR.
- `ADMIN` không tự động được cấp quyền HR.
- Backend dự kiến dùng namespace `/api/v1/hr/**`.
- Frontend dự kiến dùng route `/manager/hr`.
- Mọi kiểm tra quyền phải nằm ở backend; ẩn menu frontend không thay thế authorization.

### 2.4 Không gộp flow

- Không tái sử dụng booking approval cho nghỉ phép hoặc biến động nhân sự.
- Không gộp dữ liệu HR với calendar phòng/xe.
- Luồng phê duyệt nghỉ phép, nếu triển khai, là flow HR độc lập.

## 3. Quy Ước Excel

### 3.1 Nguồn chuẩn

- File gốc: `docs/Danh sách nhân sự 2026.xlsx`.
- SHA-256 khóa tại Phase 0: `3e88290c865b73870c6557ff06b8273fcff012f22225c094526d020c39359a60`.
- `T6-26` là sheet chuẩn duy nhất về dữ liệu, công thức và định dạng.
- File trong `docs/hr-normalized/` chỉ là hiện vật phân tích, không dùng làm template export.
- File gốc không được sửa hoặc save lại bằng thư viện Excel.

### 3.2 Cấu trúc workbook mục tiêu

- Hai sheet nghiệp vụ bắt buộc: `Tăng` và `Giảm`.
- Sheet tháng có tên `T1-26` đến `T12-26`.
- Chỉ tạo sheet tháng khi người quản lý chủ động mở/tạo tháng đó.
- Template gốc hiện dùng `TĂNG` và `GIAM`; Phase 0 giữ nguyên để không tác động workbook nguồn. Việc chuẩn hóa tên hiển thị thực hiện trong phase export sau khi có test reference/formula.

### 3.3 Cột ngày nghỉ phép

- Dùng cột `AM` đang trống trong `T6-26`.
- Không insert cột vì `AN101:CQ101` đang chứa dữ liệu phụ phải giữ đúng tọa độ.
- `AM4` là `NGÀY NGHỈ PHÉP`.
- `AM5:AM333` chỉ được chuẩn bị style và để trống ở Phase 0.
- Backend sẽ tính và lưu snapshot; Excel chỉ nhận giá trị số đã tính ở phase sau.

### 3.4 Quy tắc tăng/giảm theo tháng

- Nhân sự tăng có hiệu lực tháng nào thì xuất hiện trong snapshot từ tháng đó trở đi.
- Nhân sự giảm có hiệu lực tháng nào thì không còn trong snapshot cuối tháng đó và các tháng sau.
- Dữ liệu đã giảm vẫn giữ trong hồ sơ, lịch sử và audit; không hard-delete nghiệp vụ.
- Snapshot tháng đã `CLOSED` là bất biến. Điều chỉnh về sau phải tạo bản ghi điều chỉnh, không sửa lén lịch sử.
- Trạng thái tháng dự kiến: `DRAFT`, `OPEN`, `CLOSED`, `EXPORTED`.

## 4. Mô Hình Dữ Liệu Dự Kiến

- `hr_employees`: hồ sơ nhân sự cốt lõi, không có `user_id`.
- `hr_employee_identity`: CCCD/giấy tờ định danh.
- `hr_employee_insurance`: BHXH, BHYT và thông tin liên quan.
- `hr_employee_contacts`: địa chỉ, điện thoại, liên hệ khẩn cấp.
- `hr_departments`, `hr_positions`, `hr_working_conditions`: danh mục HR độc lập.
- `hr_employee_movements`: sự kiện tăng, giảm, chuyển đơn vị/chức vụ và điều chỉnh.
- `hr_monthly_rosters`: kỳ snapshot tháng.
- `hr_monthly_roster_items`: snapshot từng nhân sự, gồm JSON snapshot và ngày phép tại thời điểm chốt.
- `hr_excel_template_versions`: phiên bản template, checksum và trạng thái sử dụng.
- Nhóm bảng nghỉ phép sẽ được thiết kế riêng ở Phase 7–8.

Các field nhạy cảm phải được mask ở danh sách, kiểm soát quyền ở API, không ghi vào log và có audit khi export/xem chi tiết.

## 5. Giao Diện Manager Dự Kiến

Phân hệ `/manager/hr` có navigation riêng:

1. Tổng quan.
2. Danh sách nhân sự.
3. Tăng/Giảm.
4. Danh sách theo tháng.
5. Nghỉ phép.
6. Phòng ban HR.
7. Chức vụ HR.
8. Điều kiện lao động.
9. Import/Export.
10. Nhật ký thay đổi.

Trang chi tiết nhân sự dự kiến có các tab: thông tin chung, công việc, bảo hiểm, định danh, liên hệ, đào tạo, nghỉ phép, tăng/giảm, lịch sử tháng và audit.

## 6. Kế Hoạch Theo Phase

### Phase 0 — Khóa template và hợp đồng dữ liệu

Trạng thái: **đã triển khai**.

- Khóa SHA file nguồn và chọn `T6-26` làm canonical sheet.
- Tạo template v1 bằng raw OOXML patch giới hạn.
- Chỉ thêm scaffold `T6-26!AM4:AM333`, không dịch cột.
- Sinh manifest không chứa PII.
- Kiểm tra mọi OOXML part ngoài `sheet12.xml` giữ nguyên nội dung.
- Kiểm tra formula map, sheet order/state, merge, comment, filter, pane, printer settings, VML, cached errors và external link không đổi.
- Không thay đổi backend, frontend, database hoặc server đang chạy.

Chi tiết: [hr-template/PHASE_0_TEMPLATE_REPORT.md](hr-template/PHASE_0_TEMPLATE_REPORT.md).

### Phase 1 — Schema HR độc lập

- Thêm migration framework/versioned migration trước khi tạo bảng HR.
- Tạo bảng, index, constraint và audit fields.
- Không liên kết `hr_employees` với `users`.
- Có migration rollback/backup và test bảo toàn dữ liệu.

### Phase 2 — Import baseline T6-26

- Upload -> parse -> preview -> validate -> confirm; không insert ngay khi upload.
- Mapping 329 nhân sự hàng 5–333.
- Báo lỗi theo sheet/cell/field; không tự sửa dữ liệu mơ hồ.
- Idempotency theo file checksum và khóa nghiệp vụ.
- Lưu batch import và kết quả từng dòng để audit/rollback.

### Phase 3 — Security và API

- Enforce `ROLE_MANAGER` cho `/api/v1/hr/**`.
- API danh sách có pagination, sort và filter.
- API detail dùng DTO, mask PII theo context.
- CRUD, tăng/giảm, mở/chốt tháng, import preview/confirm và export.
- Test 401 khi chưa login và 403 với `ADMIN`/`EMPLOYEE` nếu không được cấp quyền.

### Phase 4 — Giao diện quản lý HR

- Layout/nav riêng cho Manager.
- Danh sách, chi tiết, form thêm/sửa, filter và phân trang.
- Xác nhận rõ trước thao tác giảm, xóa sai dữ liệu hoặc export PII.
- Không load toàn bộ nhân sự một lần.

### Phase 5 — Tăng/Giảm và snapshot tháng

- Sự kiện biến động có ngày hiệu lực, lý do, người thao tác và trạng thái.
- Tạo/chốt/reopen có kiểm soát và audit.
- Kế thừa snapshot tháng trước theo quy tắc tăng/giảm đã chốt.
- Hard-delete chỉ dành cho bản nháp/sai import chưa có reference.

### Phase 6 — Export Excel

- Dùng template version đã khóa, không save trực tiếp file nguồn.
- Dự kiến dùng Apache POI `XSSFWorkbook`; không dùng streaming workbook cho template phức tạp.
- Không gọi formula evaluator và không xóa cached legacy errors.
- Ghi dữ liệu bằng allowlist, sau đó chạy lại contract verifier.
- Chuẩn hóa workbook đầu ra thành `Tăng`, `Giảm`, và các sheet tháng được yêu cầu.

### Phase 7 — Tính và lưu ngày phép

- Rule phép là cấu hình có version/effective date, không hard-code chỉ trong Excel.
- Backend tính từ ngày bắt đầu tính phép đã chốt, điều kiện lao động, thâm niên và chính sách hiện hành.
- Lưu cả kết quả và calculation snapshot để giải thích lại số liệu lịch sử.
- Cho phép điều chỉnh có lý do và audit, không ghi đè mất dấu.

### Phase 8 — Đơn nghỉ và phê duyệt HR

- Flow riêng, không dùng booking approval.
- Quản lý số dư, đơn nghỉ, hủy đơn, phê duyệt và lịch sử.
- Chống trừ phép hai lần bằng transaction/idempotency.

### Phase 9 — Báo cáo, audit và UAT

- Báo cáo headcount, tăng/giảm, bảo hiểm, hồ sơ thiếu và ngày phép.
- Audit export và truy cập dữ liệu nhạy cảm.
- UAT đối chiếu DB, UI và file Excel với dữ liệu thực tế.
- Tài liệu vận hành, backup/restore và rollback.

## 7. Điều Kiện Chuyển Sang Phase 1

- Template v1 và manifest verify `PASS` trên máy phát triển.
- Người dùng mở template bằng Excel/LibreOffice và xác nhận hiển thị `NGÀY NGHỈ PHÉP` đúng format.
- Xác nhận không cần đổi tên các sheet legacy ngay trong template nguồn.
- Chốt field ngày bắt đầu dùng để tính phép và quy tắc effective date cho tăng/giảm.
- Có migration framework trước thay đổi schema production.

## 8. Nguyên Tắc Không Được Vi Phạm

- Không ghi đè file Excel gốc.
- Không làm phẳng công thức thành cached value.
- Không xóa external link, comment, VML, print settings hoặc legacy error trong Phase 0.
- Không commit workbook có PII hoặc đóng gói workbook vào production JAR.
- Không deploy/restart server khi chỉ phát triển và kiểm thử phân hệ HR.
- Không hard-delete lịch sử nhân sự đã phát sinh nghiệp vụ.
