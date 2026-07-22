#!/usr/bin/env bash
set -Eeuo pipefail

CONTAINER_NAME="${BOOKINGBASE_DB_CONTAINER:-booking_db}"
DATABASE_NAME="${BOOKINGBASE_DB_NAME:-booking_db}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
LEGACY_SNAPSHOT="${BOOKINGBASE_HR_LEGACY_SNAPSHOT:-}"
EXPECTED_TABLE_COUNT=15
EXPECTED_CHECK_COUNT=61
EXPECTED_FOREIGN_KEY_COUNT=26
EXPECTED_UNIQUE_COUNT=17
EXPECTED_NAMED_INDEX_COUNT=28
EXPECTED_CONTRACT_COLUMN_COUNT=22

log() {
  printf '[BookingBase HR Verify] %s\n' "$*"
}

fail() {
  printf '[BookingBase HR Verify] ERROR: %s\n' "$*" >&2
  exit 1
}

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

hr_table_count="$(read_query "
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name IN (
      'hr_departments',
      'hr_positions',
      'hr_working_conditions',
      'hr_employees',
      'hr_employee_employment',
      'hr_employee_identity',
      'hr_employee_insurance',
      'hr_employee_contacts',
      'hr_employee_movements',
      'hr_monthly_rosters',
      'hr_monthly_roster_items',
      'hr_excel_template_versions',
      'hr_excel_import_batches',
      'hr_excel_import_rows',
      'hr_audit_events'
    );
")"
[[ "$hr_table_count" == "$EXPECTED_TABLE_COUNT" ]] \
  || fail "Chi tim thay $hr_table_count/$EXPECTED_TABLE_COUNT bang HR Phase 1."

all_hr_table_count="$(read_query "
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name LIKE 'hr\\_%';
")"
[[ "$all_hr_table_count" == "$EXPECTED_TABLE_COUNT" ]] \
  || fail "Schema co $all_hr_table_count bang hr_*, contract V1 chi cho phep $EXPECTED_TABLE_COUNT."

migration_count="$(read_query "
  SELECT COUNT(*)
  FROM flyway_schema_history
  WHERE version = '1' AND success = 1 AND checksum IS NOT NULL;
")"
[[ "$migration_count" == 1 ]] || fail "Khong tim thay Flyway migration V1 thanh cong."

user_fk_count="$(read_query "
  SELECT COUNT(*)
  FROM information_schema.key_column_usage
  WHERE table_schema = DATABASE()
    AND table_name LIKE 'hr\\_%'
    AND referenced_table_name = 'users';
")"
[[ "$user_fk_count" == 0 ]] || fail "Phat hien $user_fk_count lien ket HR -> users."

user_id_column_count="$(read_query "
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name LIKE 'hr\\_%'
    AND column_name = 'user_id';
")"
[[ "$user_id_column_count" == 0 ]] || fail "Phat hien cot user_id trong schema HR."

failed_migration_count="$(read_query "
  SELECT COUNT(*)
  FROM flyway_schema_history
  WHERE success = 0;
")"
[[ "$failed_migration_count" == 0 ]] || fail "Flyway co $failed_migration_count migration that bai."

check_count="$(read_query "
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name LIKE 'hr\\_%'
    AND constraint_type = 'CHECK';
")"
[[ "$check_count" == "$EXPECTED_CHECK_COUNT" ]] \
  || fail "CHECK constraints drift: $check_count/$EXPECTED_CHECK_COUNT."

foreign_key_count="$(read_query "
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name LIKE 'hr\\_%'
    AND constraint_type = 'FOREIGN KEY';
")"
[[ "$foreign_key_count" == "$EXPECTED_FOREIGN_KEY_COUNT" ]] \
  || fail "Foreign key constraints drift: $foreign_key_count/$EXPECTED_FOREIGN_KEY_COUNT."

unique_count="$(read_query "
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name LIKE 'hr\\_%'
    AND constraint_type = 'UNIQUE';
")"
[[ "$unique_count" == "$EXPECTED_UNIQUE_COUNT" ]] \
  || fail "Unique constraints drift: $unique_count/$EXPECTED_UNIQUE_COUNT."

named_index_count="$(read_query "
  SELECT COUNT(DISTINCT CONCAT(table_name, ':', index_name))
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name LIKE 'hr\\_%'
    AND index_name LIKE 'idx_hr\\_%';
")"
[[ "$named_index_count" == "$EXPECTED_NAMED_INDEX_COUNT" ]] \
  || fail "Named indexes drift: $named_index_count/$EXPECTED_NAMED_INDEX_COUNT."

contract_column_count="$(read_query "
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND CONCAT(table_name, '.', column_name) IN (
      'hr_employees.employee_code',
      'hr_employees.employment_status',
      'hr_employee_employment.leave_accrual_start_date',
      'hr_employee_employment.base_salary',
      'hr_employee_employment.allowance',
      'hr_employee_identity.legacy_identity_number',
      'hr_employee_identity.citizen_identity_number',
      'hr_employee_insurance.social_insurance_number',
      'hr_employee_insurance.health_insurance_number',
      'hr_employee_contacts.permanent_address',
      'hr_employee_contacts.current_address',
      'hr_employee_contacts.phone',
      'hr_employee_movements.effective_date',
      'hr_employee_movements.idempotency_key',
      'hr_monthly_rosters.period_start',
      'hr_monthly_roster_items.leave_days',
      'hr_monthly_roster_items.snapshot_payload',
      'hr_excel_import_batches.attempt_number',
      'hr_excel_import_batches.confirmation_key',
      'hr_excel_import_rows.raw_payload',
      'hr_excel_import_rows.normalized_payload',
      'hr_audit_events.actor_subject'
    );
")"
[[ "$contract_column_count" == "$EXPECTED_CONTRACT_COLUMN_COUNT" ]] \
  || fail "Core column contract drift: $contract_column_count/$EXPECTED_CONTRACT_COLUMN_COUNT."

if [[ -n "$LEGACY_SNAPSHOT" ]]; then
  [[ -r "$LEGACY_SNAPSHOT" ]] || fail "Khong doc duoc legacy snapshot: $LEGACY_SNAPSHOT"
  command -v diff >/dev/null 2>&1 || fail "Khong tim thay lenh diff."
  current_snapshot="${XDG_RUNTIME_DIR:-/tmp}/bookingbase-legacy-after-v1.$$.tsv"
  trap 'rm -f -- "$current_snapshot"' EXIT
  "$SCRIPT_DIR/capture-legacy-table-counts.sh" "$current_snapshot"
  if ! diff --unified=0 -- "$LEGACY_SNAPSHOT" "$current_snapshot"; then
    fail "Row count bang legacy thay doi trong maintenance window."
  fi
  rm -f -- "$current_snapshot"
  trap - EXIT
fi

log "PASS: V1 dung table/column/constraint/index contract, khong co HR -> users va khong co migration loi."
