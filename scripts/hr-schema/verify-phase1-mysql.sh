#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
CONTAINER_NAME="bookingbase-hr-phase1-test-$$"
DATABASE_NAME="hr_phase1_test"
DATABASE_PASSWORD="phase1-test-only"

log() {
  printf '[HR Phase 1 MySQL Test] %s\n' "$*"
}

fail() {
  printf '[HR Phase 1 MySQL Test] ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  exit_code=$?
  if (( exit_code != 0 )); then
    docker logs --tail 80 "$CONTAINER_NAME" >&2 2>/dev/null || true
  fi
  docker rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true
  return "$exit_code"
}
trap cleanup EXIT

for command_name in docker sed; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Khong tim thay lenh '$command_name'."
done

log "Khoi tao MySQL 8 tam thoi, khong dung container/volume production..."
docker run --detach --rm \
  --name "$CONTAINER_NAME" \
  --memory 600m \
  --publish 127.0.0.1::3306 \
  --env MYSQL_ROOT_PASSWORD="$DATABASE_PASSWORD" \
  --env MYSQL_DATABASE="$DATABASE_NAME" \
  --env MYSQL_USER="hr_phase1_test" \
  --env MYSQL_PASSWORD="$DATABASE_PASSWORD" \
  mysql:8.0 \
  --innodb-buffer-pool-size=64M \
  --performance-schema=OFF >/dev/null

ready=false
for _ in {1..90}; do
  if docker exec "$CONTAINER_NAME" env MYSQL_PWD="$DATABASE_PASSWORD" \
      mysqladmin --host=127.0.0.1 --protocol=tcp --user=root --silent ping >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == true ]] || fail "MySQL test khong san sang sau 90 giay."

port_mapping="$(docker port "$CONTAINER_NAME" 3306/tcp | sed -n '1p')"
host_port="${port_mapping##*:}"
[[ "$host_port" =~ ^[0-9]+$ ]] || fail "Khong doc duoc random MySQL port."

log "Chay Flyway V1, constraint tests va Hibernate validate tren MySQL 8..."
cd "$ROOT_DIR/backend"
HR_MYSQL_JDBC_URL="jdbc:mysql://127.0.0.1:${host_port}/${DATABASE_NAME}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC" \
HR_MYSQL_JDBC_USER="root" \
HR_MYSQL_JDBC_PASSWORD="$DATABASE_PASSWORD" \
  ./mvnw -Dtest=HrMySqlPhase1IT test

log "Chay production-style read-only schema verifier..."
BOOKINGBASE_DB_CONTAINER="$CONTAINER_NAME" \
BOOKINGBASE_DB_NAME="$DATABASE_NAME" \
  "$ROOT_DIR/deployserver/linux/verify-hr-phase1.sh"

log "PASS. Container MySQL test se duoc xoa tu dong."
