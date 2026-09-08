# Triển khai sửa Word trực tiếp trên production Linux

Tài liệu này dành riêng cho máy chủ CFCBase đang chạy bằng bộ script trong `deployserver/linux/`. Mục tiêu là cấu hình một lần, sau đó mỗi lần deploy chỉ chạy:

```bash
./deployserver/linux/build-prod.sh
```

Lệnh trên build frontend, build backend, chạy migration Flyway, khởi động MySQL/Redis, ONLYOFFICE Document Server, backend và Cloudflare Tunnel. Không cần chạy riêng `docker compose` cho ONLYOFFICE sau khi hoàn tất cấu hình bên dưới.

> Trạng thái code: phần tích hợp editor, callback JWT, bản nháp và kho phiên bản đã có trong dự án. Việc chạy các lệnh production trong tài liệu này phải thực hiện trên máy chủ Linux; chưa được xác nhận là đã deploy live chỉ vì code đã tồn tại trong repository.

## Prompt giao cho AI trên máy chủ production

Có thể gửi nguyên khối dưới đây cho AI đang truy cập terminal production:

```text
Bạn đang triển khai ONLYOFFICE cho CFCBase trên Linux. Làm đúng từng bước trong
documents/HR_WORD_EDITOR_SETUP.md và dừng sau mỗi mục CHECKPOINT để báo kết quả.

Quy tắc bắt buộc:
- Không in, ghi log hoặc gửi WORD_EDITOR_JWT_SECRET vào chat.
- Không sửa/xóa dữ liệu DB, không chạy docker compose down -v, không xóa volume.
- Không dùng --initialize-hr-schema vì production hiện hành đã dùng Flyway.
- Không git pull nếu worktree đang bẩn hoặc chưa xác nhận đúng branch.
- Chỉ tạo DNS docs.cfcbooking.io.vn khi đã xác nhận tunnel ID đúng.
- Nếu một checkpoint thất bại thì dừng, đọc log và báo lỗi; không bỏ qua.
- Sau khi người vận hành tự dán secret vào deployserver/linux/.env, chỉ kiểm tra
  độ dài và sự tồn tại, tuyệt đối không hiển thị giá trị.

Mục tiêu cuối: chạy duy nhất ./deployserver/linux/build-prod.sh, sau đó kiểm tra
local health, public health, backend và mở thử editor bằng một mẫu không có dữ
liệu cá nhân.
```

## Luồng triển khai chính xác

### Bước 1 — vào đúng dự án và kiểm tra máy chủ

```bash
cd /duong-dan-thuc-te/toi/CFCBase
pwd
git branch --show-current
git status --short
docker --version
docker compose version
cloudflared --version
java -version
node --version
free -h
df -h .
```

Điều kiện qua bước:

- `pwd` kết thúc bằng `/CFCBase` và có `deployserver/linux/build-prod.sh`.
- Đang ở đúng branch deploy. Nếu `git status --short` có thay đổi, dừng để phân loại; không tự xóa hoặc ghi đè.
- Docker Compose, cloudflared, JDK 21+ và Node hoạt động.
- Nên có ít nhất khoảng 4 GB RAM khả dụng cho Document Server và còn đủ dung lượng Docker. Nếu máy nhỏ hơn, cần nâng tài nguyên hoặc theo dõi tải kỹ trước khi dùng thật.

**CHECKPOINT 1:** báo branch, trạng thái worktree, RAM và dung lượng trống; không gửi nội dung `.env`.

### Bước 2 — đưa phiên bản code mới lên máy chủ

Dùng đúng cách phát hành code hiện có của máy chủ. Nếu production lấy code trực tiếp từ Git và worktree sạch:

```bash
git fetch --all --prune
git pull --ff-only
git log -1 --oneline
```

Phải thấy các file sau:

```bash
test -f docker-compose.word-editor.yml
test -f deployserver/linux/.env.example
test -f backend/src/main/resources/db/migration/V19__hr_word_editor_sessions.sql
```

Không chạy ứng dụng ở bước này.

**CHECKPOINT 2:** xác nhận commit đang deploy và ba file đều tồn tại.

### Bước 3 — tạo hostname ONLYOFFICE trên Cloudflare một lần

Script Linux hiện dùng tunnel:

```text
745ab8be-c55c-4e72-b985-d918206ca82f
```

Kiểm tra credential đã có:

```bash
test -r "$HOME/.cloudflared/745ab8be-c55c-4e72-b985-d918206ca82f.json"
```

Nếu `docs.cfcbooking.io.vn` chưa được route tới tunnel này, chạy đúng một lần:

```bash
cloudflared tunnel route dns 745ab8be-c55c-4e72-b985-d918206ca82f docs.cfcbooking.io.vn
```

Nếu Cloudflare báo DNS record đã tồn tại, không tạo chồng record. Kiểm tra record hiện tại trong Cloudflare và chỉ tiếp tục khi nó thuộc đúng tunnel CFCBase. `run.sh` sẽ tự sinh ingress:

```text
docs.cfcbooking.io.vn -> http://localhost:8088
```

**CHECKPOINT 3:** xác nhận hostname đã route đúng tunnel; chưa cần public health thành công vì container chưa chạy.

### Bước 4 — tạo và dán secret vào `.env`

Không commit secret. Nếu chưa có file cấu hình production:

```bash
cd /duong-dan-thuc-te/toi/CFCBase
umask 077
touch deployserver/linux/.env
chmod 600 deployserver/linux/.env
```

Sinh secret 64 ký tự hex:

```bash
openssl rand -hex 32
```

Tự sao chép giá trị vừa sinh. Mở file:

```bash
nano deployserver/linux/.env
```

Giữ nguyên toàn bộ cấu hình đang có và thêm khối sau ở cuối file. Thay duy nhất dòng secret bằng giá trị vừa sinh:

```dotenv
# WORD EDITOR
WORD_EDITOR_ENABLED=true
ONLYOFFICE_IMAGE=onlyoffice/documentserver:9.4.0
ONLYOFFICE_PORT=8088
WORD_EDITOR_DOCUMENT_SERVER_URL=https://docs.cfcbooking.io.vn
WORD_EDITOR_BACKEND_URL=https://api.cfcbooking.io.vn
WORD_EDITOR_JWT_SECRET=DAN_SECRET_64_KY_TU_VAO_DAY
```

Nếu file đã có các khóa `WORD_EDITOR_*` hoặc `ONLYOFFICE_*`, sửa giá trị hiện có, không thêm khóa trùng. Secret này dùng chung cho Spring Boot và container ONLYOFFICE vì cả hai cùng nạp `deployserver/linux/.env`.

Sau khi lưu, kiểm tra mà không in secret:

```bash
chmod 600 deployserver/linux/.env
set -a
source deployserver/linux/.env
set +a
test "$WORD_EDITOR_ENABLED" = "true"
test "$WORD_EDITOR_DOCUMENT_SERVER_URL" = "https://docs.cfcbooking.io.vn"
test "$WORD_EDITOR_BACKEND_URL" = "https://api.cfcbooking.io.vn"
test "${#WORD_EDITOR_JWT_SECRET}" -ge 32
test -n "$ONLYOFFICE_IMAGE"
printf 'Cau hinh Word editor hop le; secret length=%s\n' "${#WORD_EDITOR_JWT_SECRET}"
unset WORD_EDITOR_JWT_SECRET
```

Chỉ báo độ dài; không chạy `cat .env`, `env`, `printenv` hoặc lệnh debug làm lộ secret.

**CHECKPOINT 4:** báo `Cau hinh Word editor hop le` và độ dài, không báo giá trị secret.

### Bước 5 — backup trước deploy

```bash
./deployserver/linux/backup-database.sh
```

Ghi lại đường dẫn file backup mà script trả về. Không tiếp tục nếu backup thất bại.

**CHECKPOINT 5:** xác nhận backup tồn tại và có kích thước lớn hơn 0.

### Bước 6 — deploy bằng một lệnh

```bash
./deployserver/linux/build-prod.sh
```

Không chạy `--initialize-hr-schema`. Trong lần đầu, Docker sẽ tải image Document Server nên có thể lâu hơn các lần deploy sau. Script tự:

1. Build frontend và backend.
2. Khởi động DB/Redis.
3. Khởi động ONLYOFFICE và chờ `/healthcheck` tối đa 180 giây.
4. Khởi động backend; Flyway tự chạy V19.
5. Khởi động Cloudflare Tunnel gồm hostname `docs.cfcbooking.io.vn`.

Nếu bất kỳ phần nào thất bại, script dừng và in log liên quan; không được tuyên bố deploy thành công.

**CHECKPOINT 6:** cuối lệnh phải có `Production dang chay` và hiện URL Word.

### Bước 7 — nghiệm thu kỹ thuật

Kiểm tra container và local health:

```bash
set -a
source deployserver/linux/.env
set +a
docker compose -f docker-compose.word-editor.yml --project-directory . ps documentserver
curl -fsS "http://127.0.0.1:${ONLYOFFICE_PORT:-8088}/healthcheck"
curl -fsSI http://127.0.0.1:8080/
systemctl --user is-active bookingbase-backend.service
systemctl --user is-active bookingbase-tunnel.service
```

Kiểm tra qua Internet:

```bash
curl -fsS https://docs.cfcbooking.io.vn/healthcheck
curl -fsSI https://docs.cfcbooking.io.vn/web-apps/apps/api/documents/api.js
curl -fsSI https://cfcbooking.io.vn/
```

Kết quả bắt buộc:

- Local và public `/healthcheck` trả `true`.
- File `documents/api.js` trả HTTP 200.
- Backend và tunnel ở trạng thái `active`.
- Trang CFCBase trả HTTP thành công.

**CHECKPOINT 7:** báo riêng từng kết quả local/public/backend/tunnel; không gộp thành “đã ổn” nếu còn một lỗi.

## Cách dùng sau khi triển khai

1. Đăng nhập CFCBase bằng tài khoản ADMIN hoặc MANAGER đang hoạt động.
2. Vào **Mẫu Word**, chọn loại mẫu rồi bấm **Sửa mẫu đang dùng**; hoặc vào hồ sơ nhân sự, mở hợp đồng đã xuất và chọn **Sửa trực tiếp trên web**.
3. Chỉnh nội dung ngay trong ONLYOFFICE. Với mẫu chung, không xóa các biến `{{FULL_NAME}}`, `{{CONTRACT_NO}}` và các biến nghiệp vụ khác.
4. Bấm **Kết thúc chỉnh sửa & nhận bản lưu** trong CFCBase.
5. Chờ trạng thái **CFCBase đã nhận bản nháp**. Callback bản cuối của ONLYOFFICE thường đến sau khi editor đóng một khoảng ngắn; không bấm lưu kho trước trạng thái này.
6. Nhập ghi chú rồi chọn **Lưu và áp dụng mẫu**. CFCBase lưu phiên bản và đặt nó làm mẫu đang dùng trong cùng giao dịch.
7. Nếu không muốn giữ thay đổi, chọn **Hủy chỉnh sửa** hoặc **Hủy bản nháp**; mẫu đang dùng không thay đổi.
8. Muốn dùng lại mẫu cũ, vào lịch sử và chọn **Khôi phục**. Muốn sửa nội dung cũ trước khi dùng, chọn **Sửa bản này trên web** rồi lưu thành phiên bản mới.

Lần nghiệm thu đầu tiên chỉ dùng một mẫu thử không có dữ liệu cá nhân. Kiểm tra tiếng Việt, font, bảng, header/footer, biến mẫu và bản xem trước để đối chiếu.

## Xử lý lỗi

### Container không lên hoặc healthcheck không trả `true`

```bash
docker compose -f docker-compose.word-editor.yml --project-directory . ps documentserver
docker compose -f docker-compose.word-editor.yml --project-directory . logs --tail=200 documentserver
free -h
df -h
```

Không dán log lên chat trước khi kiểm tra log có secret/token hay không.

### Local chạy nhưng `docs.cfcbooking.io.vn` lỗi

```bash
systemctl --user status bookingbase-tunnel.service --no-pager
journalctl --user -u bookingbase-tunnel.service -n 100 --no-pager
```

Kiểm tra DNS hostname thuộc đúng tunnel và file runtime `${XDG_RUNTIME_DIR:-/tmp}/bookingbase/cloudflared-config.yml` có route docs tới port 8088. Không đặt Cloudflare Access/browser challenge lên endpoint callback/content nếu Document Server không thể đi qua challenge đó.

### Editor mở nhưng không nhận bản nháp

```bash
tail -n 200 "${XDG_RUNTIME_DIR:-/tmp}/bookingbase/backend.log"
docker compose -f docker-compose.word-editor.yml --project-directory . logs --tail=200 documentserver
```

Kiểm tra:

- `WORD_EDITOR_BACKEND_URL=https://api.cfcbooking.io.vn` truy cập được từ container.
- JWT secret của backend và Document Server thực sự là cùng một giá trị.
- Callback không bị Cloudflare/WAF chặn.
- Không chia sẻ URL phiên hoặc ticket; không ghi callback body/token vào log.

### Tắt tạm editor nhưng giữ dữ liệu

Đổi trong `deployserver/linux/.env`:

```dotenv
WORD_EDITOR_ENABLED=false
```

Sau đó chạy lại:

```bash
./deployserver/linux/build-prod.sh
```

Nếu cần tắt toàn bộ production:

```bash
./deployserver/linux/stop-prod.sh
```

Script stop chỉ dừng container, không xóa volumes. Tuyệt đối không dùng `docker compose down -v` vì sẽ xóa dữ liệu Document Server.

## Ghi chú bảo mật và vận hành

- Container chỉ bind `127.0.0.1:8088`; Cloudflare Tunnel là lớp HTTPS public.
- Giữ `JWT_ENABLED=true`, header `X-Onlyoffice-JWT`, và không dùng JWT đăng nhập CFCBase làm secret Document Server.
- Các API quản lý phiên vẫn yêu cầu ADMIN/MANAGER; content/callback dùng ticket/JWT riêng.
- Backend chỉ nhận file kết quả từ đúng origin Document Server, không theo redirect, giới hạn 15 MB.
- Backup cả DB CFCBase và các Docker volume `word_editor_*`; chưa có job retention tự động cho draft.
- Không dùng tag `latest`. Cấu hình hiện ghim `onlyoffice/documentserver:9.4.0`; khi nâng phiên bản phải đọc release note, backup và nghiệm thu lại trước production.

Tham khảo chính thức: [ONLYOFFICE Docker Document Server](https://github.com/ONLYOFFICE/Docker-DocumentServer), [JWT cho Document Server](https://api.onlyoffice.com/docs/docs-api/additional-api/signature/request/token-in-header/), [callback và trạng thái lưu](https://api.onlyoffice.com/docs/docs-api/usage-api/callback-handler/).
