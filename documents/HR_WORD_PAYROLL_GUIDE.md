# Mẫu Word, bản chỉnh sửa và theo dõi gửi lương

Cập nhật source: 07/09/2026. Đây là hướng dẫn cho phần đã triển khai trong repository, **không phải xác nhận đã deploy production**.

## 1. Phạm vi đã có

| Hạng mục | Trạng thái |
|---|---|
| Kho phiên bản mẫu Word cho văn phòng, LĐPT, thử việc | Đã có; upload, xem trước, tải, áp dụng, quay lại mẫu gốc |
| Giữ biến Word khi bị tách nhiều run định dạng | Đã có và có test |
| Xem trước bản hợp đồng đã xuất | Đã có; thư viện `docx-preview`, iframe sandbox |
| Tải bản hợp đồng đã sửa bằng Word lên | Đã có cho hợp đồng lao động; tạo bản độc lập, không ghi đè bản gốc |
| Sửa Word trực tiếp trong web / ONLYOFFICE | Đã có code tích hợp và callback JWT; cần bật Document Server. Xem [cấu hình](HR_WORD_EDITOR_SETUP.md). Chưa kiểm thử live |
| PDF chuẩn phân trang từ cùng bản đã lưu | Chưa có |
| Mở lại campaign theo file lương sau refresh | Đã có; chọn lại file để tải trạng thái từ server |
| Phân trang preview lương và kết quả từng người | Đã có |
| Snapshot tin nhắn và xem đúng nội dung gửi | Đã có cho campaign mới từ V18 |
| Kiểm tra binding Telegram ngay trước gửi | Đã có; thay đổi/thu hồi liên kết sẽ bỏ qua, không đổi sang chat khác |
| Phân loại lỗi gửi không chắc chắn | Đã có; không tự retry khi chưa rõ tin đã tới Telegram hay chưa |
| Phục hồi worker sau restart, đối soát UNCERTAIN | Chưa có giao diện/worker phục hồi tự động |
| PDF phiếu lương, kho PDF theo nhân viên/tháng, dashboard nâng cao | Chưa có |

Không coi toàn bộ Phase 4B/4C hoặc Phase 5 đã hoàn tất.

## 2. Đổi mẫu chung

1. Vào **HR → Mẫu Word** (hoặc **Nhân sự → Chi tiết → Hợp đồng → Quản lý mẫu Word**).
2. Chọn loại mẫu, bấm **Tải mẫu đang dùng**.
3. Chỉnh bố cục, font, nội dung cố định bằng Microsoft Word. Giữ các biến như `{{FULL_NAME}}`; không đổi tên/xóa biến.
4. Chọn file `.docx` tối đa 15 MB, nhập ghi chú và **Lưu phiên bản mẫu**.
5. Xem trước phiên bản rồi bấm **Áp dụng**. Upload chưa tự thay mẫu đang dùng.
6. Tạo bản hợp đồng mới để lấy mẫu mới. Các hợp đồng đã xuất vẫn giữ nguyên bytes và SHA-256 cũ.

Muốn quay về mặc định: **Xem mẫu gốc → Dùng lại mẫu gốc**. Phiên bản upload vẫn được giữ để tải/đối chiếu. Mẫu lưu trong database, không cần sửa file classpath/rebuild để đổi mẫu sau lần triển khai này.

Preview HTML chỉ để kiểm tra nội dung và bố cục tương đối; phân trang/font có thể khác Word. Chưa có bảo đảm preview PDF giống bản in. File được dựng trong iframe sandbox, không gửi dữ liệu hợp đồng tới dịch vụ preview công cộng.

## 3. Sửa riêng một hợp đồng và lưu lại

1. Vào **Nhân sự → Chi tiết → Hợp đồng → Xem các bản đã xuất**.
2. **Tải bản này**, sửa bằng Word rồi lưu `.docx`.
3. Trên đúng bản gốc, chọn **Tải bản đã sửa lên**, chọn file và ghi chú.
4. **Lưu bản chỉnh sửa** tạo một bản riêng có mã, hash, thời gian, người tạo; provenance lưu nguồn bản gốc và ghi chú trong snapshot.
5. Dùng **Xem trước / Tải bản này** trên phiên bản mới để lấy chính file đã lưu, không render lại từ dữ liệu nhân sự.

Sửa Word **không đồng bộ ngược** tên, lương, phòng ban hoặc thông tin pháp lý vào hồ sơ nhân sự. Nếu cần đổi dữ liệu hồ sơ, sửa tại form HR. Tạo bản Word mới từ hồ sơ cũng không lấy nội dung chỉnh riêng trong Word làm mẫu chung. Hợp đồng đã hủy không cho tạo/tải lên bản sửa mới. Bản scan đã ký vẫn lưu tại Hồ sơ & giấy tờ; chưa liên kết khóa ngoại đến phiên bản Word.

## 4. Theo dõi gửi lương

1. Import Excel như trước; dùng phân trang để kiểm tra đủ dòng.
2. Tạo hàng đợi, xem **Kết quả từng người nhận → Xem tin** để kiểm tra nội dung đã lưu trước khi bắt đầu gửi.
3. **Bắt đầu gửi** là thao tác riêng; xem preview không gửi Telegram.
4. Sau refresh, chọn lại file trong lịch sử để mở campaign đã có; không tạo lại đợt gửi.
5. Theo dõi trạng thái, số lần thử, thời gian và lý do của từng dòng.

Campaign mới lưu `message_snapshot` khi tạo; preview và gửi dùng cùng chuỗi đó. Campaign cũ có thể chưa có snapshot: giao diện báo rõ không có bản đối chiếu, không giả định đã lưu nội dung lịch sử. Các dòng cũ tiếp tục tương thích luồng gửi hiện hành.

### Lỗi và retry

- `RETRYABLE`: chưa cấu hình token (chưa gọi mạng), hoặc Telegram trả giới hạn tốc độ; sửa cấu hình/chờ đủ số giây được báo rồi thao tác gửi lại.
- `REJECTED`: Telegram trả lỗi từ chối 4xx; kiểm tra bot/người nhận trước khi gửi lại.
- `UNCERTAIN`: mất xác nhận, lỗi mạng, phản hồi 5xx/không hợp lệ. Tin có thể đã tới Telegram; nút retry không lấy những dòng này để tránh gửi trùng.
- Dòng bị thu hồi/thay đổi binding được **Bỏ qua**. Không tự chuyển phiếu lương sang chat mới.
- Lỗi lịch sử chưa phân loại cũng không được nút retry lấy lại; cần đối soát.

Hiện chưa có phục hồi worker bị dừng đột ngột. Nếu đợt bị kẹt SENDING sau restart, **không sửa trạng thái hàng loạt hoặc gửi lại bằng SQL**; cần đối soát riêng những tin có thể đã gửi trước khi phục hồi. Retry không bảo đảm exactly-once cho toàn hệ thống. Việc đổi bot còn cần quy trình cutover/re-verify, không chỉ đổi username.

Phân loại dựa trên `ok`, `error_code`, `retry_after` của [Telegram Bot API](https://core.telegram.org/bots/api#making-requests); không lưu raw response có thể chứa thông tin nhạy cảm. Dạng TEXT vẫn là chế độ duy nhất được hỗ trợ; yêu cầu PDF bị từ chối rõ, không âm thầm đổi chế độ.

## 5. Migration, kiểm tra và phần tiếp theo

- V17: hai bảng kho mẫu và phiên bản; giữ nguyên mẫu classpath làm mặc định.
- V18: thêm `hr_payroll_deliveries.message_snapshot` nullable; không sửa nội dung tin đã gửi trước đây.
- Backup DB trước khi deploy. Deploy backend + frontend cùng bản; để Flyway chạy V17/V18. Không chạy migration tay song song với Flyway, không sửa migration đã áp dụng.
- Sau deploy: upload mẫu thử → preview → áp dụng → tạo hợp đồng thử; upload bản chỉnh sửa → tải lại đối chiếu hash. Dùng dữ liệu thử, không gửi lương thật để kiểm tra giao diện.
- Kiểm thử local gồm DOCX split-run, migration/kho mẫu, snapshot campaign, scope người nhận, phân loại lỗi Telegram. Test dùng H2/mock, không xác nhận MySQL production hoặc Telegram live.

Thứ tự tiếp theo:

1. Chọn vị trí/URL ONLYOFFICE Document Server và thiết lập JWT, HTTPS, kết nối hai chiều backend–Document Server; không đưa secret vào git.
2. Thêm draft/revision riêng, khóa phiên sửa, callback có xác thực, kiểm soát nguồn URL tải file, lưu idempotent; chỉ báo Đã lưu sau khi backend đã nhận bytes.
3. Chốt bản đã lưu → chuyển PDF từ chính revision đó → lưu hash/tệp → tải DOCX/PDF cùng bản. Kiểm thử font tiếng Việt và mất kết nối khi save.
4. Hoàn thiện worker lease/recovery và màn đối soát tin không xác định, audit thao tác gửi/retry, chống trùng theo nhân viên/kỳ lương với quy trình gửi bản điều chỉnh.
5. Kho PDF phiếu lương, liên kết nhân viên/tháng/campaign; PDF tùy chọn, TEXT mặc định; dashboard và runbook production.
