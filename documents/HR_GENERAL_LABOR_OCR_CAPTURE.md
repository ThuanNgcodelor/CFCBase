# OCR điện thoại → máy tính cho LĐ phổ thông

Phạm vi: **Thêm lao động phổ thông**. Không thêm nút ghép điện thoại ở Nhân sự/Thử việc, không thay quy tắc chấm công hoặc tạo biến động. Cập nhật source ngày 10/09/2026; chưa nghiệm thu production/hai điện thoại thật.

## Cách dùng

1. Máy tính: **LĐ phổ thông → Thêm lao động → Chụp bằng điện thoại → Tạo mã QR ghép điện thoại**.
2. Đăng nhập trên điện thoại bằng **cùng tài khoản** hiển thị trên máy tính, rồi quét QR bằng camera. Nếu chưa đăng nhập, trang đăng nhập sẽ đưa trở lại đúng phiên chụp. Không cần cùng Wi-Fi, nhưng cả hai phải truy cập được website HTTPS.
3. Chọn CCCD mặt trước/mặt sau/giấy tờ khác → mở camera hoặc chọn ảnh → kiểm tra/chụp lại → **Gửi ảnh lên máy tính**. Sau khi server nhận ảnh, máy tính tự cập nhật. Gửi cùng mặt CCCD thay mặt cũ; giấy tờ khác được thêm riêng.
4. Chụp đủ giấy tờ của **một người** rồi bấm **Chụp xong — Đọc thông tin**, trên điện thoại hoặc máy tính. Kết quả chỉ về sau khi provider OCR xử lý; chuyển ảnh và đọc OCR là hai bước riêng.
5. Máy tính: **Kiểm tra và điền vào hồ sơ**. Ô trống được chọn sẵn; ô có thông tin nhập tay chỉ thay khi bạn đánh dấu. Hủy áp dụng không sửa form. Không đọc được/không chắc thì sửa thủ công.
6. **Lưu hồ sơ** hoặc **Lưu và xuất hợp đồng** theo luồng hiện tại. Chỉ thao tác lưu này mới chạy onboarding/biến động; OCR không tự tạo người. Lưu thành công sẽ kết thúc phiên và dọn ảnh/kết quả tạm.

Không dùng lại QR người trước cho người sau. Mở form thêm mới để tạo phiên mới.

## Đóng, hủy và khôi phục kết nối

- **Ẩn bảng — tiếp tục nhận ảnh**: chỉ đóng drawer; phiên vẫn nhận ảnh. Bấm **Mở phiên chụp điện thoại** để xem lại.
- **Hủy phiên chụp**: hỏi xác nhận, dừng nhận ảnh, xóa ảnh và kết quả tạm trên server. Không xóa những trường đã áp dụng vào form.
- **Bỏ phiên cũ để tạo QR mới**: dùng khi phiên đã kết thúc/hết hạn. Không hồi sinh phiên cũ.
- Mất mạng khi gửi: ảnh chưa gửi vẫn ở bộ nhớ điện thoại, bấm gửi lại. Cùng mã lượt tải không tạo ảnh trùng. Không tải lại trang điện thoại trước khi gửi nếu muốn giữ ảnh chưa gửi.
- WebSocket báo thay đổi ngay; nếu mất WebSocket, khi trang đang hiển thị sẽ đối soát bằng API mỗi 5 giây. Khi mạng/trang hoạt động trở lại sẽ lấy snapshot mới. Không tự gọi lại AI do reconnect.
- URL form máy tính chứa `?capture=<id>` giúp lấy lại ảnh/kết quả sau reload. **Các trường nhập tay và hợp đồng trong form chưa lưu không được tự khôi phục sau reload**; đây không phải chức năng autosave hồ sơ. Không chia sẻ URL form để mở một nhân viên khác.
- Hai form mở từ **Thêm lao động** có phiên khác nhau. Nếu chủ động sao chép nguyên URL có `capture` sang tab khác, cả hai cùng xem phiên đó.

## Bảo vệ dữ liệu

- Mọi API dưới `/api/v1/hr/general-labor/ocr-captures` yêu cầu ACTIVE ADMIN/MANAGER; chủ phiên lấy từ principal. Ngay cả admin khác biết QR cũng không được xem/gửi/xóa ảnh của phiên.
- QR chứa ID ngẫu nhiên, **không chứa access token, mật khẩu hay dữ liệu CCCD**; biết ID không thay thế việc đăng nhập đúng tài khoản.
- Phiên hết hạn sau 30 phút kể từ lúc tạo, không tự gia hạn khi polling. Cấu hình `HR_OCR_CAPTURE_TTL_MINUTES` (giới hạn 5–120). Tối đa 6 ảnh/phiên, 5 MB/ảnh sau nén. Điện thoại nhận ảnh đầu vào tối đa 20 MB, giảm cạnh dài về tối đa 2048 px và chuyển JPEG; backend kiểm tra JPEG/PNG thật, tối đa 25 megapixel.
- Ảnh lưu trong `hr_ocr_capture_images` dưới dạng blob, kết quả trong `hr_ocr_capture_sessions`. API ảnh có xác thực/no-store, không có public URL. Bỏ qua raw output của provider khi lưu kết quả phiên; không ghi raw OCR/provider response vào log.
- Bỏ/thay ảnh xóa nội dung ảnh ngay, chỉ giữ biên nhận lượt tải (ID/hash/loại, không có nội dung ảnh) đến hết phiên để chặn retry cũ phục hồi ảnh đã bỏ. Tối đa 60 lượt ảnh/phiên.
- Hủy/kết thúc xóa dữ liệu tạm ngay; job mỗi phút xóa các phiên đã hết hạn và ảnh qua FK cascade. Khi backend ngừng chạy, job dọn tiếp sau khi backend hoạt động lại. Dữ liệu đã xóa vẫn có thể tồn tại trong backup/binlog theo chính sách máy chủ; cần bảo vệ và quy định retention backup riêng.
- WebSocket chỉ gửi `{sessionId}` tới `/user/queue/ocr-capture`, không gửi ảnh/nội dung giấy tờ. Chặn subscribe trực tiếp vào queue OCR đã resolve, wildcard và client SEND vào kênh OCR. API luôn kiểm tra lại quyền.
- OCR dùng provider/key đang cấu hình, không thêm dịch vụ AI mới. Bấm đọc sẽ gửi bộ ảnh tới provider đó. Hủy sau khi provider đã nhận yêu cầu **không thu hồi được ảnh đã gửi tới provider**; kết quả trả muộn bị bỏ, không được ghi vào phiên đã hủy.
- Ảnh OCR không tự lưu vào kho tài liệu nhân sự. Không đưa ảnh/PII vào localStorage, service-worker cache hoặc sự kiện thông báo chung.

## Vận hành/triển khai

1. Backup database theo quy trình Linux hiện tại trước khi cập nhật code.
2. Deploy cả frontend và backend cùng phiên bản bằng `./deployserver/linux/build-prod.sh` từ thư mục gốc repository; không cần container, queue hay API key mới cho tính năng ghép thiết bị. Giữ nguyên cấu hình provider OCR đang dùng.
3. Backend chạy Flyway **V20__hr_general_labor_ocr_capture.sql** để thêm 2 bảng tạm và index. Không chạy baseline/clean cho database production đã dùng Flyway.
4. Kiểm tra `flyway_schema_history` có V20 thành công. Chưa có migration thì không bật/nhấn tạo QR ở frontend mới.
5. Đảm bảo `VITE_API_URL` trỏ đúng API public HTTPS (không phải localhost), origin được CORS cho phép và reverse proxy chuyển `/ws/**` tới backend. Không thay cấu hình ONLYOFFICE cho tính năng này.
6. Dùng một tài khoản HR thử trên hai trình duyệt/thiết bị, ban đầu dùng ảnh fixture không có dữ liệu thật. Chụp → gửi → đọc → kiểm tra → hủy; chỉ lưu một hồ sơ thử khi đã được phép.

Snapshot nằm trong DB nên khởi động lại backend không làm mất ảnh còn hạn. Worker OCR bị gián đoạn quá 3 phút được chuyển sang trạng thái cho phép đọc lại. Mặc định 2 worker và tối đa 8 job chờ; quá tải trả trạng thái thất bại có thể thử lại. Không giữ transaction DB khi gọi provider. Trong mô hình nhiều backend, sự kiện simple broker không chia sẻ giữa các node; API đối soát vẫn hoạt động, cần nghiệm thu độ trễ trước khi mở rộng.

## Checklist nghiệm thu

- [ ] iPhone Safari: camera, xoay ảnh, gửi 2 mặt, chụp lại; JPEG/PNG fallback nếu không đọc được HEIC.
- [ ] Android Chrome: camera, thư viện ảnh, khóa/mở màn hình, kết nối lại.
- [ ] Hai thiết bị cùng tài khoản nhận đúng ảnh; khác tài khoản nhận 403, kể cả có QR/ID ảnh.
- [ ] Hai form mới độc lập không lẫn ảnh. Reload form khôi phục phiên ảnh, không hứa khôi phục nội dung nhập tay.
- [ ] Ngắt mạng sau gửi rồi gửi lại không tạo ảnh trùng; mất WebSocket vẫn đối soát được.
- [ ] Chụp lại/bỏ ảnh trong lúc AI chạy: kết quả cũ không được áp dụng. Nút đọc cùng lúc không tạo hai job cho cùng snapshot.
- [ ] Hủy/hoàn tất/hết hạn không nhận ảnh hoặc kết quả OCR muộn.
- [ ] Trường nhập tay được giữ mặc định; chỉ trường người dùng chọn mới áp dụng; không tạo nhân viên trước khi bấm lưu.
- [ ] Mẫu OCR chọn ảnh trên máy tính và OCR ở màn Nhân sự cũ vẫn dùng được.
- [ ] Kiểm tra truy vấn snapshot/expiry với `EXPLAIN` trên MySQL staging, log không chứa PII, job dọn dữ liệu hoạt động.

## Source và kiểm thử

- Backend: `HrOcrCaptureController`, `HrOcrCaptureService`, `HrOcrSocketPolicy`, Flyway V20.
- Frontend: `HrGeneralLaborCapture`, `HrGeneralLaborCapturePhone`, `useHrOcrCapture`, `HrOcrCaptureView`, `HrOcrReview`, `hrOcrCaptureApi`, `hrOcrCapture`.
- Test JS: `cd frontend && node --test src/utils/hrOcrCapture.test.js`.
- Test backend: `cd backend && ./mvnw -Dtest=HrOcrCaptureTest,HrOcrSocketPolicyTest,HrSecurityContractTest,HrOcrServiceTest,HrPhase1MigrationTest,HrPhase2RetentionMigrationTest test`.
- Chạy thêm `npm run lint`, `npm run build`, toàn bộ `./mvnw test` trước khi phát hành. Test chọn bằng `-Dtest` vẫn compile toàn bộ test Java: nếu phần khác đang sửa gây lỗi compile, phải xử lý/đối soát thay đổi đó trước khi coi full suite đạt.

Thiết kế dùng [Spring user destinations](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/user-destination.html), [STOMP client reconnect/beforeConnect](https://stomp-js.github.io/api-docs/latest/classes/Client.html) và [HTML capture cho camera điện thoại](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture). UI luôn giữ lựa chọn thư viện ảnh vì camera tùy trình duyệt/thiết bị.

### Kết quả kiểm tra local ngày 10/09/2026

- Build frontend đạt; lint không có error, còn 10 warning unused có sẵn ngoài tính năng mới.
- 5 test JavaScript đạt (return URL an toàn, chọn trường, giữ dữ liệu nhập tay, chống áp dụng cũ, ngày/giới tính không hợp lệ).
- 34 test backend được chọn đạt: capture/service/API, quyền WebSocket, HTTP HR, OCR hiện có và migration V1–V20 trên H2. OCR provider được mock, không gửi dữ liệu thật.
- Full `./mvnw -o test` **chưa đạt bước compile test**: `HrEmploymentContractDocumentServiceTest.java:59` còn gọi `new HrEmploymentContractTemplateProvider()` trong khi constructor đang yêu cầu `HrDocumentTemplateService`. Thay đổi mẫu Word song song được giữ nguyên, không sửa ngoài phạm vi OCR. Để kiểm tra phần OCR độc lập, đã dùng POM tạm ngoài repository chỉ giới hạn `testIncludes` vào 6 lớp test liên quan, không thay dependency hoặc source sản phẩm.
- Chưa kiểm thử camera/UI thật, gọi provider thật, MySQL `EXPLAIN`, proxy/WebSocket production và hai thiết bị vật lý. Cần chạy checklist nghiệm thu phía trên sau khi giải quyết lỗi compile test chung và deploy được phép.
