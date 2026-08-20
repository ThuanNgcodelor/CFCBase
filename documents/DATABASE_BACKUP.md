# Backup Và Restore Database

Cập nhật: 2026-07-21

## Chính sách hiện tại

- Backup logical toàn bộ MySQL `booking_db` mỗi giờ vào phút `05`.
- Systemd user linger đã bật cho `david-nguyen`, nên timer tiếp tục hoạt động sau logout và được khởi tạo lại sau reboot.
- Mỗi file chứa database/schema, tables, indexes, foreign keys, triggers, routines, events và toàn bộ data dạng INSERT.
- Dùng `--single-transaction` để không dừng website và giữ snapshot nhất quán cho InnoDB.
- File được gzip, kiểm tra hợp lệ rồi atomic rename; bản cũ chỉ bị xóa sau khi bản mới thành công.
- Giữ đúng 24 bản gần nhất trong `backups/database/`; thư mục này bị Git ignore.
- Backup chứa dữ liệu thật, quyền file là `600`, quyền thư mục là `700`.

## Lệnh vận hành

Backup thủ công:

```bash
./deployserver/linux/backup-database.sh
```

Xem timer và log:

```bash
systemctl --user list-timers bookingbase-backup.timer
journalctl --user -u bookingbase-backup.service
```

Restore một file:

```bash
./deployserver/linux/restore-database.sh backups/database/booking_db_YYYY-MM-DD_HH-MM-SS.sql.gz
```

Restore yêu cầu nhập chính xác `RESTORE` và luôn tạo thêm một backup khẩn cấp trước khi import. Sau restore nên restart backend để làm mới persistence context/cache; Redis không nằm trong logical database backup.

## Cấu hình tùy chọn

- `BOOKINGBASE_BACKUP_DIR`: đổi thư mục lưu.
- `BOOKINGBASE_BACKUP_KEEP`: số bản giữ lại, mặc định `24`.
- `BOOKINGBASE_DB_CONTAINER`: container, mặc định `booking_db`.
- `BOOKINGBASE_DB_NAME`: database, mặc định `booking_db`.

Không truyền password trong command line. Script đọc `MYSQL_USER`/`MYSQL_PASSWORD` bên trong container và dùng `MYSQL_PWD` chỉ trong process con.

## Giới hạn

24 bản trên cùng ổ đĩa bảo vệ khỏi xóa/sửa nhầm và cho phép quay lại theo giờ, nhưng không bảo vệ khi mất máy hoặc hỏng ổ cứng. Nên đồng bộ thêm ít nhất một bản backup hằng ngày sang thiết bị/cloud độc lập, có mã hóa và kiểm soát truy cập.
