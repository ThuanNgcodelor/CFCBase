#!/usr/bin/env bash
set -Eeuo pipefail

CONTAINER_NAME="${BOOKINGBASE_DB_CONTAINER:-booking_db}"
DATABASE_NAME="${BOOKINGBASE_DB_NAME:-booking_db}"
OUTPUT_FILE="${1:-}"

log() {
  printf '[BookingBase Legacy Snapshot] %s\n' "$*" >&2
}

fail() {
  printf '[BookingBase Legacy Snapshot] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -n "$OUTPUT_FILE" ]] || fail "Cach dung: $0 <output.tsv>"
command -v docker >/dev/null 2>&1 || fail "Khong tim thay lenh docker."
docker inspect "$CONTAINER_NAME" >/dev/null 2>&1 || fail "Khong tim thay container $CONTAINER_NAME."
[[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" == true ]] \
  || fail "Container $CONTAINER_NAME khong chay."

read_query() {
  local query="$1"
  docker exec "$CONTAINER_NAME" sh -c '
    : "${MYSQL_USER:?MYSQL_USER is missing}"
    : "${MYSQL_PASSWORD:?MYSQL_PASSWORD is missing}"
    exec env MYSQL_PWD="$MYSQL_PASSWORD" mysql \
      --user="$MYSQL_USER" \
      --batch \
      --skip-column-names \
      --database="$1" \
      --execute="$2"
  ' sh "$DATABASE_NAME" "$query"
}

mkdir -p -- "$(dirname -- "$OUTPUT_FILE")"
TEMP_FILE="${OUTPUT_FILE}.tmp.$$"
trap 'rm -f -- "$TEMP_FILE"' EXIT
: > "$TEMP_FILE"

mapfile -t legacy_tables < <(read_query "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'hr\\_%'
    AND table_name <> 'flyway_schema_history'
  ORDER BY table_name;
")

(( ${#legacy_tables[@]} > 0 )) || fail "Khong tim thay bang BookingBase legacy."
for table_name in "${legacy_tables[@]}"; do
  [[ "$table_name" =~ ^[A-Za-z0-9_]+$ ]] || fail "Ten table khong an toan: $table_name"
  row_count="$(read_query "SELECT COUNT(*) FROM \`$table_name\`;")"
  [[ "$row_count" =~ ^[0-9]+$ ]] || fail "Khong doc duoc row count cua $table_name."
  printf '%s\t%s\n' "$table_name" "$row_count" >> "$TEMP_FILE"
done

chmod 600 "$TEMP_FILE"
mv -- "$TEMP_FILE" "$OUTPUT_FILE"
trap - EXIT
log "Da luu count cua ${#legacy_tables[@]} bang vao $OUTPUT_FILE (khong chua noi dung PII)."
