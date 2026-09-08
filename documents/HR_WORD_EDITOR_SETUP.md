# Bật sửa Word trực tiếp trên CFCBase

## Trạng thái

Đã thêm code tích hợp ONLYOFFICE: mở mẫu/hợp đồng → chỉnh trên web → kết thúc phiên → nhận bản nháp qua callback có JWT → xem trước → lưu phiên bản vào kho. Migration V19 lưu phiên sửa và bản nháp. **Chưa chạy Document Server hoặc kiểm thử tích hợp live/production.** Người dùng xác nhận hiện chưa có Document Server.

Không có Document Server thì nút Sửa trực tiếp sẽ báo cần cấu hình, không biến preview thành editor giả. Các chức năng upload/download cũ vẫn sử dụng được. Không thay đổi payroll trong đợt này.

## 1. Chuẩn bị Document Server

Chạy dịch vụ riêng bằng `docker-compose.word-editor.yml`; không ghép database của ONLYOFFICE vào DB nhân sự. Chọn image tag/digest và edition phù hợp sau khi kiểm tra điều kiện cấp phép, tài nguyên và kiến trúc CPU với tài liệu nhà cung cấp; không tự dùng `latest` ở production. Cấu hình mẫu cố ý yêu cầu biến `ONLYOFFICE_IMAGE` thay vì ngầm chọn edition/version.

Tạo biến môi trường trên máy chạy Docker (không commit secret):

```dotenv
ONLYOFFICE_IMAGE=onlyoffice/documentserver:<tag-da-kiem-tra>
ONLYOFFICE_PORT=8088
WORD_EDITOR_JWT_SECRET=<secret-ngau-nhien-it-nhat-32-byte>
```

Sau khi đặt biến, chạy từ thư mục CFCBase:

```sh
docker compose -f docker-compose.word-editor.yml up -d
docker compose -f docker-compose.word-editor.yml ps
```

Đây là hướng dẫn để quản trị chạy, chưa được agent chạy triển khai. Container chỉ bind `127.0.0.1:8088`; cần reverse proxy HTTPS hoặc tunnel tại một hostname riêng, ví dụ **hostname minh họa** `docs.example.com`. Proxy phải chuyển WebSocket và giữ Host/X-Forwarded-Proto đúng. `/healthcheck` phải trả `true`. Nếu proxy/tunnel ở container khác thì `127.0.0.1` không phải host máy chủ; cấu hình mạng upstream theo thực tế, không mở cổng ra internet không bảo vệ.

Giữ `JWT_ENABLED=true`, `JWT_HEADER=X-Onlyoffice-JWT`, `JWT_IN_BODY=true` như Compose. Không dùng JWT đăng nhập CFCBase làm secret Document Server. Không bật `ALLOW_META_IP_ADDRESS`, không tắt kiểm tra chứng chỉ. Mặc định chặn tải tới IP private; cấu hình dưới dùng hostname HTTPS public của backend. Nếu cần mạng nội bộ, phải thiết kế allowlist/egress riêng trước khi mở quyền private IP.

Nguồn chính thức: [Docker Document Server](https://github.com/ONLYOFFICE/Docker-DocumentServer), [JWT trong header](https://api.onlyoffice.com/docs/docs-api/additional-api/signature/request/token-in-header/).

## 2. Bật backend

Đặt các biến cho tiến trình backend rồi restart backend sau backup DB và migration:

```dotenv
WORD_EDITOR_ENABLED=true
WORD_EDITOR_DOCUMENT_SERVER_URL=https://docs.example.com
WORD_EDITOR_BACKEND_URL=https://hr.example.com
WORD_EDITOR_JWT_SECRET=<cung-secret-voi-Document-Server>
```

Hai URL chỉ là ví dụ, thay bằng hostname thật, **không** có `/api` hay đường dẫn con. Backend URL phải route được `/api/v1/word-editor/*` tới Spring Boot. Browser lẫn backend phải truy cập được Document Server; Document Server phải truy cập được backend. Không dùng localhost làm URL nếu các tiến trình chạy trên máy/container khác.

Chỉ hai endpoint trao đổi file không dùng JWT đăng nhập người dùng:

- GET `/api/v1/word-editor/{id}/content?ticket=...`: vé ký, gắn phiên, hạn 24h.
- POST `/api/v1/word-editor/{id}/callback`: JWT ONLYOFFICE, đúng document key, chỉ đọc các trường nằm trong chữ ký.

Các API mở phiên, xem trạng thái, bản nháp và lưu phiên bản tại `/api/v1/hr/word-editor/**` vẫn cần ADMIN/MANAGER đang hoạt động; chỉ chủ phiên xem/sửa phiên đó. Không mở public toàn bộ `/api/v1/hr/**`. Không ghi access log query `ticket`, config JWT, body callback hoặc nội dung hợp đồng. Không bật cache cho các API/tài liệu này. Không đặt Cloudflare Access/browser challenge lên callback/content nếu Document Server chưa có cơ chế đi qua phù hợp.

Backend chỉ tải file kết quả từ **đúng origin Document Server** và đường dẫn `/cache/files/`, không theo redirect, tối đa 15 MB. Nếu version/proxy của bạn dùng đường dẫn khác, kiểm tra thực tế rồi sửa allowlist có test; không mở tải URL tùy ý.

## 3. Cách dùng không tải file về máy

1. Vào **Mẫu Word → chọn loại mẫu → Sửa trực tiếp trên web**. Hoặc mở **Nhân sự → Hợp đồng → các bản đã xuất → Sửa trực tiếp trên web** trên bản cần chỉnh.
2. Editor Word hiện ngay trong trang. Chỉnh chữ, bảng, font và căn lề. Với mẫu chung, giữ các biến `{{...}}`.
3. Chọn **Kết thúc chỉnh sửa & nhận bản lưu**. Editor đóng để Document Server gửi bản cuối về backend; thường cần đợi ít nhất khoảng 10 giây.
4. Chỉ khi thấy **CFCBase đã nhận bản nháp**, chọn **Xem bản đã nhận**, nhập ghi chú rồi **Lưu phiên bản vào kho**.
5. Nếu validation báo mất biến mẫu, chọn **Tiếp tục sửa bản nháp** để sửa ngay trên web, không cần download. Bản nháp lỗi vẫn giữ trong DB.
6. Với mẫu chung: quay lại kho mẫu → xem trước phiên bản mới → **Áp dụng**. Chỉnh một hợp đồng riêng không thay hồ sơ HR hoặc mẫu chung.

Nút Save bên trong ONLYOFFICE là lưu phía Document Server. Bước kết thúc và xác nhận ở CFCBase là để tránh báo lưu thành công khi backend chưa nhận bytes. Không đóng máy khi đang chờ. Có thể bookmark URL phiên để xem lại trạng thái; không chia sẻ URL/vé file. Phiên sửa có hạn 24 giờ; bản nháp đã nhận không tự xóa. Bản đã nhận có thể mở thành phiên mới.

Nguồn luồng save: [ONLYOFFICE callback statuses](https://api.onlyoffice.com/docs/docs-api/usage-api/callback-handler/). Chỉ callback final status 2 cập nhật bản nháp; status 4 là không thay đổi. Force-save không bật. Callback lặp không ghi đè bản final; lưu vào kho lặp trả lại cùng id phiên bản.

## 4. Nghiệm thu trước dùng thật

- Dùng mẫu thử không có thông tin cá nhân: mở editor, sửa một câu, kết thúc, đợi nhận bản, lưu, tải lại kiểm tra nội dung.
- Thử 3 loại mẫu và một hợp đồng fixture; chỉnh bảng, tiếng Việt, header/footer. Preview bằng `docx-preview` vẫn chỉ gần đúng phân trang Word.
- Mất kết nối hoặc tắt Document Server: không được hiện thông báo đã lưu. Kiểm tra log đã che secret; giữ bản nháp và dữ liệu Document Server để khôi phục.
- Reload trang khi đang sửa; kiểm tra cùng URL phiên và callback cuối. Không mở cùng phiên trong nhiều tab: Document Server chỉ gửi bản cuối khi người cuối đóng; giao diện có thể phải chờ.
- Gửi callback không JWT/sai JWT/sai key phải bị từ chối; replay callback đã lưu không sinh thêm bản.
- Người khác không đọc được bản nháp dù biết UUID; tài khoản không đăng nhập không gọi được API quản lý phiên.
- Backup cả DB CFCBase lẫn volumes Document Server. Chưa có job dọn phiên nháp: theo dõi dung lượng, đặt chính sách retention trước khi mở rộng số người dùng.

## 5. Giới hạn còn lại

- Chưa triển khai PDF lưu trong CFCBase từ cùng phiên bản hoặc ký số.
- Thử việc hỗ trợ sửa **mẫu chung**; chưa có nút sửa riêng từng hợp đồng thử việc ở màn ứng viên.
- Mỗi lần mở tạo bản nháp độc lập, không ghi đè tài liệu/mẫu active. Đây không phải workflow cùng sửa một bản giữa nhiều người hay tự merge thay đổi.
- Chưa có danh sách mọi draft hoặc dashboard xử lý callback lỗi. URL phiên giữ khả năng truy cập lại; không tuyên bố tự phục hồi sau mọi sự cố.
- Chưa chọn hostname/image edition hay cấu hình DNS/tunnel production. Cần thông tin máy chủ/tên miền và quyền triển khai để bật dùng thật.
