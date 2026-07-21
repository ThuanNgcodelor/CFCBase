#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
CONTAINER_NAME="${BOOKINGBASE_DB_CONTAINER:-booking_db}"
DATABASE_NAME="${BOOKINGBASE_DB_NAME:-booking_db}"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.sh"

fail() {
  printf '[BookingBase Restore] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ $# -eq 1 ]] || fail "Cach dung: $0 <file.sql.gz>"
BACKUP_FILE="$(realpath -- "$1")"
[[ -r "$BACKUP_FILE" ]] || fail "Khong doc duoc file: $BACKUP_FILE"
gzip -t "$BACKUP_FILE" || fail "File backup gzip khong hop le."

printf '%s\n' \
  "CANH BAO: Restore se thay the database '$DATABASE_NAME' bang:" \
  "  $BACKUP_FILE" \
  "He thong se tao mot backup khan cap truoc khi import."
read -r -p "Nhap chinh xac RESTORE de tiep tuc: " confirmation
[[ "$confirmation" == RESTORE ]] || fail "Da huy restore."

printf '[BookingBase Restore] Tao backup khan cap...\n'
"$BACKUP_SCRIPT"

printf '[BookingBase Restore] Dang import database...\n'
gzip -cd "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" sh -c '
  : "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is missing}"
  exec env MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --default-character-set=utf8mb4
'

table_count="$(docker exec "$CONTAINER_NAME" sh -c '
  exec env MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --batch --skip-column-names \
    -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''$1'\''" 
' sh "$DATABASE_NAME")"
[[ "$table_count" =~ ^[1-9][0-9]*$ ]] || fail "Import xong nhung khong tim thay table."
printf '[BookingBase Restore] Thanh cong. Database co %s table. Hay restart backend neu dang chay.\n' "$table_count"
