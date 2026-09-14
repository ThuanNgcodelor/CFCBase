#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

log() {
  printf '[Worker Attendance Phase 7] %s\n' "$*"
}

fail() {
  printf '[Worker Attendance Phase 7] ERROR: %s\n' "$*" >&2
  exit 1
}

for command_name in java node npm git; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Khong tim thay lenh '$command_name'."
done
[[ -x "$ROOT_DIR/backend/mvnw" ]] || fail "backend/mvnw khong san sang."
[[ -f "$ROOT_DIR/CongXn.xlsx" ]] || fail "Thieu fixture CongXn.xlsx de doi soat B124."

log "[1/4] Chay toan bo backend test va Flyway migration test..."
(cd "$ROOT_DIR/backend" && ./mvnw -q test)

log "[2/4] Kiem tra frontend lint..."
(cd "$ROOT_DIR/frontend" && npm run lint)

log "[3/4] Build frontend o che do shadow giong lan rollout dau..."
(
  cd "$ROOT_DIR/frontend"
  export VITE_HR_PRODUCTION_ATTENDANCE_ENABLED=true
  export VITE_HR_PRODUCTION_ATTENDANCE_SHADOW_MODE=true
  npm run build
)

log "[4/4] Kiem tra whitespace va patch integrity..."
(cd "$ROOT_DIR" && git diff --check)

log "PASS: gate local Phase 7 dat. Van can deploy shadow va HR ky nghiem thu truoc khi tat shadow-mode."
