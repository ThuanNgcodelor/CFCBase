#!/usr/bin/env bash
set -Eeuo pipefail

CONTAINER_NAME="${BOOKINGBASE_DB_CONTAINER:-booking_db}"
DATABASE_NAME="${BOOKINGBASE_DB_NAME:-booking_db}"
API_ROOT="${BOOKINGBASE_LOCAL_API_ROOT:-http://127.0.0.1:8080/api/v1}"
EXPECTED_TABLE_COUNT=10
EXPECTED_POLICY_COUNT=5
EXPECTED_CREDIT_RULE_COUNT=7

log() {
  printf '[Production Attendance Verify] %s\n' "$*"
}

fail() {
  printf '[Production Attendance Verify] ERROR: %s\n' "$*" >&2
  exit 1
}

for command_name in docker curl; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Khong tim thay lenh '$command_name'."
done
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

migration_count="$(read_query "
  SELECT COUNT(*) FROM flyway_schema_history
  WHERE version = '21' AND success = 1;
")"
[[ "$migration_count" == 1 ]] || fail "Flyway V21 chua duoc ap dung thanh cong."

table_count="$(read_query "
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name IN (
    'hr_attendance_shift_policies',
    'hr_attendance_work_credit_rules',
    'hr_employee_attendance_policies',
    'hr_production_attendance_imports',
    'hr_attendance_source_days',
    'hr_attendance_punches',
    'hr_attendance_incidents',
    'hr_attendance_shifts',
    'hr_attendance_shift_adjustments',
    'hr_attendance_exemptions'
  );
")"
[[ "$table_count" == "$EXPECTED_TABLE_COUNT" ]] \
  || fail "Chi tim thay $table_count/$EXPECTED_TABLE_COUNT bang cham cong ca san xuat."

policy_count="$(read_query "SELECT COUNT(*) FROM hr_attendance_shift_policies WHERE active = TRUE;")"
[[ "$policy_count" -ge "$EXPECTED_POLICY_COUNT" ]] \
  || fail "Chi co $policy_count/$EXPECTED_POLICY_COUNT ca active toi thieu."

credit_rule_count="$(read_query "SELECT COUNT(*) FROM hr_attendance_work_credit_rules WHERE active = TRUE;")"
[[ "$credit_rule_count" -ge "$EXPECTED_CREDIT_RULE_COUNT" ]] \
  || fail "Chi co $credit_rule_count/$EXPECTED_CREDIT_RULE_COUNT quy tac cong active toi thieu."

invalid_credit_count="$(read_query "
  SELECT COUNT(*) FROM hr_attendance_work_credit_rules
  WHERE work_value NOT IN (0, 1, 1.5, 2);
")"
[[ "$invalid_credit_count" == 0 ]] \
  || fail "Co $invalid_credit_count quy tac cong nam ngoai tap 0/1/1.5/2."

unauthenticated_status="$(curl --silent --output /dev/null --max-time 5 \
  --write-out '%{http_code}' "$API_ROOT/hr/attendance/production/shift-policies")"
[[ "$unauthenticated_status" == 401 || "$unauthenticated_status" == 403 ]] \
  || fail "API ca san xuat khong bao ve dung; HTTP $unauthenticated_status khi khong co token."

if [[ -n "${BOOKINGBASE_ACCESS_TOKEN:-}" ]]; then
  authenticated_status="$(curl --silent --output /dev/null --max-time 10 \
    --header "Authorization: Bearer $BOOKINGBASE_ACCESS_TOKEN" \
    --write-out '%{http_code}' "$API_ROOT/hr/attendance/production/shift-policies")"
  [[ "$authenticated_status" == 200 ]] \
    || fail "API ca san xuat khong san sang voi token HR; HTTP $authenticated_status."
else
  log "Khong co BOOKINGBASE_ACCESS_TOKEN; bo qua smoke API co dang nhap."
fi

log "PASS: V21, 10 bang, seed ca/quy tac cong va bien bao ve API deu hop le."
