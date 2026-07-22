#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
JAR_NAME="booking-system-0.0.1-SNAPSHOT.jar"
STAGING_DIR="$BACKEND_DIR/target-build"
STAGING_JAR="$STAGING_DIR/$JAR_NAME"
TARGET_DIR="$BACKEND_DIR/target"
TARGET_JAR="$TARGET_DIR/$JAR_NAME"
PREVIOUS_JAR="$TARGET_JAR.previous"
BUILD_ONLY=false
RUN_ARGUMENTS=()

usage() {
  cat <<'EOF'
Cach dung:
  ./deployserver/linux/build-prod.sh
  ./deployserver/linux/build-prod.sh --build-only
  ./deployserver/linux/build-prod.sh --initialize-hr-schema

--initialize-hr-schema  Build, sau do khoi tao Flyway cho database legacy theo
                        quy trinh backup -> baseline 0 -> HR V1 -> verify.
EOF
}

log() {
  printf '[BookingBase Build] %s\n' "$*"
}

fail() {
  printf '[BookingBase Build] ERROR: %s\n' "$*" >&2
  exit 1
}

case "${1:-}" in
  "")
    ;;
  --build-only)
    BUILD_ONLY=true
    ;;
  --initialize-hr-schema)
    RUN_ARGUMENTS=(--initialize-hr-schema)
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

for command_name in node npm java; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Khong tim thay lenh '$command_name'."
done

[[ -x "$BACKEND_DIR/mvnw" ]] || fail "backend/mvnw khong ton tai hoac chua co quyen execute."

java_major="$(java -version 2>&1 | sed -n '1s/.*version "\([0-9]*\).*/\1/p')"
[[ "$java_major" =~ ^[0-9]+$ ]] || fail "Khong doc duoc phien ban Java."
(( java_major >= 21 )) || fail "Can JDK 21 tro len; hien tai la Java $java_major."

log "[1/4] Chuan bi va build frontend..."
cd "$FRONTEND_DIR"
if [[ ! -d node_modules ]]; then
  [[ -f package-lock.json ]] || fail "Thieu frontend/package-lock.json."
  log "node_modules chua co; chay npm ci mot lan..."
  npm ci
fi
npm run build

log "[2/4] Build backend JAR vao staging (bo qua unit test)..."
cd "$BACKEND_DIR"
rm -rf -- "$STAGING_DIR"
./mvnw clean package -DskipTests -Dbooking.build.directory="$STAGING_DIR"
[[ -f "$STAGING_JAR" ]] || fail "Khong tim thay staging JAR: $STAGING_JAR"

log "[3/4] Smoke-test Web Push trong production JAR..."
java -Xms32m -Xmx256m \
  -Dloader.path="$STAGING_DIR/test-classes" \
  -Dloader.main=com.booking.system.config.WebPushExecutableJarSmoke \
  -cp "$STAGING_JAR" \
  org.springframework.boot.loader.launch.PropertiesLauncher

log "[4/4] Kich hoat JAR moi..."
mkdir -p -- "$TARGET_DIR"
if [[ -f "$TARGET_JAR" ]]; then
  cp -- "$TARGET_JAR" "$PREVIOUS_JAR"
fi
cp -- "$STAGING_JAR" "$TARGET_JAR"
rm -rf -- "$STAGING_DIR"

log "Build thanh cong; khoi dong production..."
if [[ "$BUILD_ONLY" == true ]]; then
  log "Build-only hoan tat; chua khoi dong backend hoac tunnel."
  exit 0
fi
exec "$SCRIPT_DIR/run.sh" "${RUN_ARGUMENTS[@]}"
