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

systemctl --user stop "$TUNNEL_UNIT" "$BACKEND_UNIT" 2>/dev/null || true
systemctl --user reset-failed "$TUNNEL_UNIT" "$BACKEND_UNIT" 2>/dev/null || true

if [[ "${FLYWAY_BASELINE_ON_MIGRATE:-false}" == true ]]; then
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

if [[ "${FLYWAY_BASELINE_ON_MIGRATE:-false}" == true ]]; then
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
