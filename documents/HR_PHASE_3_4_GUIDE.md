# Phase 3–4: hồ sơ nhân sự và kho hợp đồng

Ngày cập nhật: 07/09/2026. Phạm vi bản này là hồ sơ 360°, lịch sử biến động/nhật ký sửa hồ sơ, tra cứu hợp đồng và các bản Word đã xuất. Phần mở rộng kho mẫu Word, upload bản chỉnh sửa và tiến độ Payroll/Telegram nằm tại [HR_WORD_PAYROLL_GUIDE.md](HR_WORD_PAYROLL_GUIDE.md); chưa hoàn tất toàn bộ Phase 5.

## 1. Những gì đã triển khai

| Khu vực | Chức năng |
|---|---|
| Thông tin chi tiết | Thông tin cá nhân, công việc, định danh, bảo hiểm, liên hệ, phép năm; nhắc các ô thông tin cơ bản còn thiếu |
| Lịch sử | Biến động riêng của nhân sự, gồm nháp/xác nhận/hủy và quan hệ điều chỉnh; nhật ký sửa hồ sơ riêng theo người |
| Hợp đồng | Danh sách hợp đồng theo ngày bắt đầu mới nhất, trạng thái đã lưu và nhắc thời hạn trong 30 ngày |
| Các bản đã xuất | Danh sách từng bản Word, ngày xuất, mẫu và mã đối chiếu; tải lại bản cũ hoặc tạo bản mới |
| Hồ sơ & Giấy tờ đính kèm | Tiếp tục sử dụng kho tài liệu hiện có: tải nhiều file, phân loại, tìm kiếm, xem, tải và sửa thông tin tài liệu |

Danh sách lịch sử, hợp đồng và bản Word tải 20 mục/trang; backend giới hạn tối đa 50. API lọc theo nhân sự trước khi phân trang. Danh sách bản Word chỉ lấy metadata, không tải nội dung file hoặc snapshot hồ sơ.

## 2. Cách dùng hồ sơ 360°

1. Đăng nhập bằng tài khoản Admin hoặc Manager đang hoạt động.
2. Chọn **Nhân sự**, tìm theo mã hoặc tên rồi mở **Chi tiết**. Cũng có thể mở Chi tiết từ danh sách Lao động phổ thông.
3. Tab **Thông tin chi tiết** hiển thị hồ sơ và khung **Thông tin cần bổ sung**. Bấm **Chỉnh sửa thông tin** để bổ sung, sau đó lưu.
4. Các mục được kiểm tra ô trống: ngày sinh, CCCD/CMND, số điện thoại, địa chỉ thường trú, phòng ban, chức vụ và ngày vào làm. Khung này không chứng nhận dữ liệu đúng, đủ điều kiện pháp lý hoặc đã có giấy tờ gốc.
5. Mở tab **Lịch sử**:
   - **Biến động tăng / giảm**: xem ngày hiệu lực, phòng ban trước/sau, lý do, quyết định, người tạo/xác nhận/hủy. Có nhãn cho biến động đã được điều chỉnh.
   - **Nhật ký sửa hồ sơ**: xem người thao tác, thời điểm và nhóm thông tin thay đổi. Đây là nhật ký có `entityType=HR_EMPLOYEE`; không phải toàn bộ audit của mọi module liên quan.
6. Dùng phân trang để xem các sự kiện cũ. Biến động nháp chưa làm thay đổi quân số; việc xác nhận vẫn thực hiện tại **Tăng / Giảm**.

Nhật ký hiện có không lưu bản so sánh giá trị cũ/mới của mọi trường. Màn hình không dựng lại các thay đổi quá khứ nếu database chưa từng ghi audit.

## 3. Cách dùng hợp đồng và bản Word

1. Trong Chi tiết nhân sự, mở tab **Hợp đồng**.
2. Kiểm tra số hợp đồng, loại, ngày ký, ngày bắt đầu/kết thúc và trạng thái.
3. Chọn **Xem các bản đã xuất** trên hợp đồng muốn tra cứu. Danh sách bản Word nằm ngay phía dưới.
4. Bấm **Tải bản này** để tải đúng bản đã lưu. Thao tác này không tạo thêm bản và không thay đổi nội dung bản cũ.
5. Bấm **Tạo bản Word mới** để sinh tài liệu từ thông tin hồ sơ hiện tại và mẫu của nhóm nhân sự. Sau khi thành công, bản mới xuất hiện đầu danh sách; bấm **Tải bản này** để tải xuống.
6. Nếu thiếu thông tin bắt buộc khi tạo Word, đọc thông báo lỗi, quay lại **Chỉnh sửa thông tin** để bổ sung rồi tạo lại.

Mỗi lần bấm Tạo bản Word mới tạo một bản riêng. Hai bản có thể trùng tên file; phân biệt bằng thời điểm xuất, mã bản và SHA-256 trong **Thông tin đối chiếu bản xuất**. Bản cũ giữ nguyên nội dung và mẫu tại thời điểm tạo. Hợp đồng đã hủy vẫn tra cứu/tải bản cũ được nhưng không tạo Word mới.

Nút xuất hợp đồng ở đầu trang hiện có vẫn hoạt động: tạo bản mới và tải ngay; bản này cũng nằm trong lịch sử bản xuất của hợp đồng.

### Cách đọc trạng thái và nhắc hạn

| Hiển thị | Ý nghĩa |
|---|---|
| Chờ tăng nhân sự | Hợp đồng READY, đang chờ hoàn tất luồng tăng nhân sự |
| Đã kích hoạt | Hợp đồng đã chuyển EFFECTIVE trong luồng nghiệp vụ |
| Đã hủy | Hợp đồng VOIDED |
| Chưa tới ngày bắt đầu | Ngày bắt đầu nằm trong tương lai |
| Còn N ngày đến hạn | Còn từ 0 đến 30 ngày trước ngày kết thúc |
| Đã qua ngày kết thúc | Ngày kết thúc đã qua |

Nhắc hạn dùng ngày hiện tại tại Việt Nam. Nhắc hạn là thông tin trên màn hình, không tự gia hạn, chấm dứt, gửi thông báo hoặc giảm nhân sự. Trạng thái “Đã kích hoạt” và “Đã qua ngày kết thúc” có thể đồng thời xuất hiện vì chúng thể hiện hai thông tin khác nhau.

### Khi không thấy hợp đồng

Hồ sơ nhập từ Excel có thể chỉ có số/loại hợp đồng trong phần **Công việc**, chưa có bản ghi tại kho hợp đồng. Không tự chuyển số hợp đồng dạng chữ thành hợp đồng chính thức. Hợp đồng được tạo qua tiếp nhận lao động phổ thông hoặc chuyển ứng viên thử việc sang nhân sự sẽ xuất hiện trong kho. Bản này chưa thêm nghiệp vụ tạo hợp đồng thay thế, gia hạn, phụ lục hoặc chữ ký điện tử.

## 4. Lưu bản đã ký và giấy tờ

1. Mở **Hồ sơ & Giấy tờ đính kèm**.
2. Chọn **Thêm 1 hồ sơ** hoặc **Thêm nhiều file (Batch)**.
3. Với bản hợp đồng đã ký, chọn loại **Hợp đồng lao động scan**, nhập số hợp đồng/tên tài liệu để dễ tìm và tải bản scan lên.
4. Dùng bộ lọc loại và ô tìm kiếm để tra cứu; chọn xem hoặc tải trên từng tài liệu.

Tài liệu scan thuộc kho giấy tờ của nhân sự, chưa có liên kết khóa ngoại tới từng hợp đồng. Nhập số hợp đồng nhất quán giúp HR đối chiếu. Xóa tài liệu đính kèm là thao tác riêng có xác nhận và không thể hoàn tác qua giao diện; lịch sử Word đã sinh không có nút xóa ở tab Hợp đồng.

## 5. Cập nhật ứng dụng và kiểm tra sau triển khai

Bản này dùng schema hiện có đến V16, không có migration mới. Cần cập nhật cả backend và frontend. Việc sửa code local không đồng nghĩa website production đã được cập nhật.

Trước khi đưa lên server, dùng quy trình build/deploy hiện hành. Sau khi backend/frontend mới hoạt động:

1. Mở một nhân sự có biến động và một nhân sự không có biến động; kiểm tra lịch sử không lẫn người.
2. Chọn nhân sự có hợp đồng đã xuất; kiểm tra tải được bản cũ.
3. Trên môi trường thử nghiệm, tạo bản Word mới, sửa thông tin hồ sơ rồi tạo bản khác; đối chiếu bản cũ vẫn giữ nguyên.
4. Mở hồ sơ nháp/legacy không có hợp đồng; phải thấy thông báo trống đúng nghĩa, không báo lỗi.
5. Thử màn hình hẹp và đường dẫn trực tiếp `?tab=contracts`, `?tab=history`, `?tab=documents`.

## 6. API và source để bảo trì

Các endpoint mới, dưới quyền HR Admin/Manager:

- `GET /api/v1/hr/employees/{employeeId}/movements?page=0&size=20`
- `GET /api/v1/hr/employees/{employeeId}/profile-audit?page=0&size=20`
- `GET /api/v1/hr/employees/{employeeId}/contracts?page=0&size=20`
- `GET /api/v1/hr/employees/{employeeId}/contracts/{contractId}/documents?page=0&size=20`

Không tìm thấy nhân sự hoặc hợp đồng không thuộc nhân sự trong đường dẫn: trả 404. Không có token hoặc tài khoản EMPLOYEE: bị chặn theo cơ chế JWT/RBAC hiện hành.

Source chính: `HrEmployeeProfileController`, `HrEmployeeProfileQueryService`, `HrActivityQueryService`, `HrEmployeeDetail.jsx`, `HrEmployeeHistoryTab.jsx`, `HrEmployeeContractsTab.jsx`. Tái sử dụng các index sẵn có theo employee/date, contract/generated_at và audit entity/id/time.

Kiểm thử bổ sung: `HrEmployeeProfileHistoryTest` chạy với H2/Flyway, kiểm tra phân tách nhân sự, bản Word cũ, phân trang và quyền sở hữu hợp đồng; `HrSecurityContractTest` kiểm tra các endpoint mới qua security filter; `hrContractStatus.test.js` kiểm tra biên ngày nhắc hạn. Test H2 không thay thế kiểm thử database production.

Kết quả local ngày 07/09/2026: Maven 139 test, 0 failure, 0 error, 1 skipped; test JavaScript nhắc hạn đạt; lint đạt với 11 cảnh báo unused hiện hữu ngoài phần thay đổi; frontend build/PWA đạt; `git diff --check` đạt. Maven cần chạy ngoài sandbox do Mockito self-attach bị chặn trong sandbox. Browser không có kết nối khả dụng, nên chưa nghiệm thu trực quan/mobile hoặc luồng end-to-end trên website thật.
