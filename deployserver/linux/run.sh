#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
JAR_NAME="booking-system-0.0.1-SNAPSHOT.jar"
JAR_PATH="$BACKEND_DIR/target/$JAR_NAME"
TUNNEL_ID="745ab8be-c55c-4e72-b985-d918206ca82f"
CREDENTIAL_FILE="$HOME/.cloudflared/$TUNNEL_ID.json"
RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp}/bookingbase"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
TUNNEL_LOG="$RUNTIME_DIR/cloudflared.log"
TUNNEL_CONFIG="$RUNTIME_DIR/cloudflared-config.yml"
BACKEND_LAUNCHER="$RUNTIME_DIR/start-backend.sh"
TUNNEL_LAUNCHER="$RUNTIME_DIR/start-tunnel.sh"
BACKEND_UNIT="bookingbase-backend.service"
TUNNEL_UNIT="bookingbase-tunnel.service"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.sh"
LEGACY_SNAPSHOT_SCRIPT="$SCRIPT_DIR/capture-legacy-table-counts.sh"
HR_VERIFY_SCRIPT="$SCRIPT_DIR/verify-hr-phase1.sh"
JAVA_OPTS="${JAVA_OPTS:--Xms256m -Xmx768m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -Dfile.encoding=UTF-8}"
HR_LEGACY_SNAPSHOT=""
INITIALIZE_HR_SCHEMA=false

usage() {
  cat <<'EOF'
Cach dung:
  ./deployserver/linux/run.sh
  ./deployserver/linux/run.sh --initialize-hr-schema

--initialize-hr-schema  Chi dung mot lan cho database BookingBase cu chua co
                        flyway_schema_history. Script se backup, baseline version
                        0, chay HR V1 va verify truoc khi mo Cloudflare Tunnel.
EOF
}

cleanup_hr_snapshot() {
  [[ -z "$HR_LEGACY_SNAPSHOT" ]] || rm -f -- "$HR_LEGACY_SNAPSHOT"
}
trap cleanup_hr_snapshot EXIT

log() {
  printf '[BookingBase] %s\n' "$*"
}

fail() {
  printf '[BookingBase] ERROR: %s\n' "$*" >&2
  exit 1
}

case "${1:-}" in
  "")
    ;;
  --initialize-hr-schema)
    INITIALIZE_HR_SCHEMA=true
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    usage >&2
    fail "Tham so khong hop le: ${1:-}."
    ;;
esac
(( $# <= 1 )) || fail "Chi duoc truyen mot tham so."

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Khong tim thay lenh '$1'."
}

for command_name in java docker cloudflared curl systemctl systemd-run; do
  require_command "$command_name"
done

[[ -f "$JAR_PATH" ]] || fail "Chua co production JAR. Hay chay deployserver/linux/build-prod.sh truoc."
[[ -r "$CREDENTIAL_FILE" ]] || fail "Thieu credential: $CREDENTIAL_FILE"

mkdir -p -- "$RUNTIME_DIR"
chmod 700 "$RUNTIME_DIR"

# Optional local secrets/config. Never commit this file.
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  log "Nap bien moi truong tu deployserver/.env..."
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
fi

if [[ "$INITIALIZE_HR_SCHEMA" == true ]]; then
  # CLI opt-in is deliberately process-local and overrides .env for this run.
  export FLYWAY_BASELINE_ON_MIGRATE=true
fi

case "${FLYWAY_BASELINE_ON_MIGRATE:-false}" in
  true|false)
    ;;
  *)
    fail "FLYWAY_BASELINE_ON_MIGRATE chi duoc la true hoac false."
    ;;
esac
FLYWAY_BASELINE_MODE="${FLYWAY_BASELINE_ON_MIGRATE:-false}"
DB_CONTAINER="${BOOKINGBASE_DB_CONTAINER:-booking_db}"
DB_NAME="${BOOKINGBASE_DB_NAME:-booking_db}"

wait_for_database() {
  for _ in {1..60}; do
    if docker exec "$DB_CONTAINER" sh -c '
      : "${MYSQL_USER:?MYSQL_USER is missing}"
      : "${MYSQL_PASSWORD:?MYSQL_PASSWORD is missing}"
      exec env MYSQL_PWD="$MYSQL_PASSWORD" mysqladmin \
        --user="$MYSQL_USER" --silent ping
    ' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail "MySQL container $DB_CONTAINER khong san sang sau 60 giay."
}

read_db_scalar() {
  local query="$1"
  docker exec "$DB_CONTAINER" sh -c '
    : "${MYSQL_USER:?MYSQL_USER is missing}"
    : "${MYSQL_PASSWORD:?MYSQL_PASSWORD is missing}"
    exec env MYSQL_PWD="$MYSQL_PASSWORD" mysql \
      --user="$MYSQL_USER" \
      --batch \
      --skip-column-names \
      --database="$1" \
      --execute="$2"
  ' sh "$DB_NAME" "$query"
}

cat > "$TUNNEL_CONFIG" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CREDENTIAL_FILE

ingress:
  - hostname: cfcbooking.io.vn
    service: http://localhost:8080
  - hostname: www.cfcbooking.io.vn
    service: http://localhost:8080
  - hostname: api.cfcbooking.io.vn
    service: http://localhost:8080
  - service: http_status:404
EOF
chmod 600 "$TUNNEL_CONFIG"

cat > "$BACKEND_LAUNCHER" <<EOF
#!/usr/bin/env bash
set -a
[[ ! -f "$SCRIPT_DIR/.env" ]] || source "$SCRIPT_DIR/.env"
set +a
export FLYWAY_BASELINE_ON_MIGRATE=$FLYWAY_BASELINE_MODE
cd "$BACKEND_DIR"
exec java $JAVA_OPTS -jar "$JAR_PATH" --spring.profiles.active=prod >> "$BACKEND_LOG" 2>&1
EOF

cat > "$TUNNEL_LAUNCHER" <<EOF
#!/usr/bin/env bash
exec cloudflared tunnel --config "$TUNNEL_CONFIG" run "$TUNNEL_ID" >> "$TUNNEL_LOG" 2>&1
EOF
chmod 700 "$BACKEND_LAUNCHER" "$TUNNEL_LAUNCHER"

log "Khoi dong MySQL va Redis..."
docker compose -f "$ROOT_DIR/docker-compose.yml" --project-directory "$ROOT_DIR" up -d db redis
wait_for_database

flyway_history_count="$(read_db_scalar "
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'flyway_schema_history';
")"
hr_table_count="$(read_db_scalar "
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name LIKE 'hr\\_%';
")"
legacy_table_count="$(read_db_scalar "
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'hr\\_%'
    AND table_name <> 'flyway_schema_history';
")"

if [[ "$flyway_history_count" == 0 && "$hr_table_count" != 0 ]]; then
  fail "Phat hien $hr_table_count bang hr_* nhung chua co Flyway history; dung lai de tranh baseline tren schema dang do."
fi
if [[ "$flyway_history_count" == 0 && "$legacy_table_count" != 0 && "$FLYWAY_BASELINE_MODE" != true ]]; then
  fail "Database cu co $legacy_table_count bang nhung chua khoi tao Flyway. Hay chay mot lan: ./deployserver/linux/run.sh --initialize-hr-schema"
fi

systemctl --user stop "$TUNNEL_UNIT" "$BACKEND_UNIT" 2>/dev/null || true
systemctl --user reset-failed "$TUNNEL_UNIT" "$BACKEND_UNIT" 2>/dev/null || true

if [[ "$FLYWAY_BASELINE_MODE" == true ]]; then
  log "Che do one-time Flyway baseline: tao backup va khoa row-count legacy sau khi backend da dung..."
  "$BACKUP_SCRIPT"
  HR_LEGACY_SNAPSHOT="$RUNTIME_DIR/legacy-before-hr-v1.tsv"
  "$LEGACY_SNAPSHOT_SCRIPT" "$HR_LEGACY_SNAPSHOT"
fi

log "Khoi dong Backend + Frontend production JAR..."
: > "$BACKEND_LOG"
systemd-run --user --unit "${BACKEND_UNIT%.service}" --collect \
  --property=Restart=on-failure --property=RestartSec=5s \
  "$BACKEND_LAUNCHER" >/dev/null

backend_ready=false
for _ in {1..60}; do
  if ! systemctl --user is-active --quiet "$BACKEND_UNIT"; then
    tail -n 80 "$BACKEND_LOG" >&2 || true
    systemctl --user stop "$BACKEND_UNIT" 2>/dev/null || true
    fail "Backend da thoat khi khoi dong. Log: $BACKEND_LOG"
  fi
  if curl --fail --silent --max-time 2 http://127.0.0.1:8080/ >/dev/null; then
    backend_ready=true
    break
  fi
  sleep 1
done

if [[ "$backend_ready" != true ]]; then
  tail -n 80 "$BACKEND_LOG" >&2 || true
  systemctl --user stop "$BACKEND_UNIT" 2>/dev/null || true
  fail "Backend khong san sang sau 60 giay. Log: $BACKEND_LOG"
fi

if [[ "$FLYWAY_BASELINE_MODE" == true ]]; then
  log "Xac minh HR V1 va doi chieu row-count legacy truoc khi mo lai tunnel..."
  if ! BOOKINGBASE_HR_LEGACY_SNAPSHOT="$HR_LEGACY_SNAPSHOT" "$HR_VERIFY_SCRIPT"; then
    systemctl --user stop "$BACKEND_UNIT" 2>/dev/null || true
    fail "HR Phase 1 verify that bai; backend da dung va tunnel chua duoc mo lai."
  fi
fi

log "Khoi dong Cloudflare Tunnel bookingbase..."
: > "$TUNNEL_LOG"
systemd-run --user --unit "${TUNNEL_UNIT%.service}" --collect \
  --property=Restart=on-failure --property=RestartSec=5s \
  "$TUNNEL_LAUNCHER" >/dev/null
sleep 3

if ! systemctl --user is-active --quiet "$TUNNEL_UNIT"; then
  tail -n 80 "$TUNNEL_LOG" >&2 || true
  fail "Cloudflare Tunnel da thoat. Log: $TUNNEL_LOG"
fi

log "Production dang chay."
printf '%s\n' \
  "  Local:   http://localhost:8080" \
  "  Public:  https://cfcbooking.io.vn" \
  "  API:     https://api.cfcbooking.io.vn" \
  "  Backend log: $BACKEND_LOG" \
  "  Tunnel log:  $TUNNEL_LOG"
