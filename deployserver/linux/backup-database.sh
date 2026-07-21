#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BOOKINGBASE_BACKUP_DIR:-$ROOT_DIR/backups/database}"
CONTAINER_NAME="${BOOKINGBASE_DB_CONTAINER:-booking_db}"
DATABASE_NAME="${BOOKINGBASE_DB_NAME:-booking_db}"
KEEP_COUNT="${BOOKINGBASE_BACKUP_KEEP:-24}"
LOCK_FILE="${XDG_RUNTIME_DIR:-/tmp}/bookingbase-database-backup.lock"
TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
FINAL_FILE="$BACKUP_DIR/${DATABASE_NAME}_${TIMESTAMP}.sql.gz"
TEMP_FILE="$BACKUP_DIR/.${DATABASE_NAME}_${TIMESTAMP}.sql.gz.tmp"

log() {
  printf '[BookingBase Backup] %s\n' "$*"
}

fail() {
  printf '[BookingBase Backup] ERROR: %s\n' "$*" >&2
  exit 1
}

for command_name in docker gzip zgrep flock find sort sed; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Khong tim thay lenh '$command_name'."
done

[[ "$KEEP_COUNT" =~ ^[1-9][0-9]*$ ]] || fail "BOOKINGBASE_BACKUP_KEEP phai la so nguyen duong."

mkdir -p -- "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || fail "Mot tien trinh backup khac dang chay."

cleanup() {
  rm -f -- "$TEMP_FILE"
}
trap cleanup EXIT

docker inspect "$CONTAINER_NAME" >/dev/null 2>&1 || fail "Khong tim thay container $CONTAINER_NAME."
[[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" == true ]] \
  || fail "Container $CONTAINER_NAME khong chay."

log "Dang export toan bo schema va data cua $DATABASE_NAME..."
docker exec "$CONTAINER_NAME" sh -c '
  : "${MYSQL_USER:?MYSQL_USER is missing}"
  : "${MYSQL_PASSWORD:?MYSQL_PASSWORD is missing}"
  exec env MYSQL_PWD="$MYSQL_PASSWORD" mysqldump \
    --user="$MYSQL_USER" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --events \
    --hex-blob \
    --no-tablespaces \
    --set-gtid-purged=OFF \
    --default-character-set=utf8mb4 \
    --databases "$1" \
    --add-drop-database
' sh "$DATABASE_NAME" | gzip -9 > "$TEMP_FILE"

[[ -s "$TEMP_FILE" ]] || fail "File backup rong."
gzip -t "$TEMP_FILE" || fail "File gzip khong hop le."
zgrep -q -m1 'CREATE DATABASE' "$TEMP_FILE" || fail "Backup thieu CREATE DATABASE."
zgrep -q -m1 'CREATE TABLE' "$TEMP_FILE" || fail "Backup thieu CREATE TABLE."

chmod 600 "$TEMP_FILE"
mv -- "$TEMP_FILE" "$FINAL_FILE"
trap - EXIT

mapfile -t old_backups < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DATABASE_NAME}_*.sql.gz" \
    -printf '%T@ %p\n' | sort -nr | sed -n "$((KEEP_COUNT + 1)),\$s/^[^ ]* //p"
)
if (( ${#old_backups[@]} > 0 )); then
  rm -f -- "${old_backups[@]}"
fi

file_size="$(du -h "$FINAL_FILE" | cut -f1)"
backup_count="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DATABASE_NAME}_*.sql.gz" | wc -l)"
log "Thanh cong: $FINAL_FILE ($file_size). Dang giu $backup_count/$KEEP_COUNT ban."
