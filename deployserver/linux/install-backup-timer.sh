#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
UNIT_SOURCE_DIR="$SCRIPT_DIR/systemd"
UNIT_TARGET_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

for command_name in systemctl install; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf '[BookingBase Backup] ERROR: Khong tim thay lenh %s.\n' "$command_name" >&2
    exit 1
  }
done

mkdir -p -- "$UNIT_TARGET_DIR"
install -m 600 "$UNIT_SOURCE_DIR/bookingbase-backup.service" "$UNIT_TARGET_DIR/bookingbase-backup.service"
install -m 600 "$UNIT_SOURCE_DIR/bookingbase-backup.timer" "$UNIT_TARGET_DIR/bookingbase-backup.timer"

systemctl --user daemon-reload
systemctl --user enable --now bookingbase-backup.timer

printf '[BookingBase Backup] Da cai timer. Lich tiep theo:\n'
systemctl --user list-timers bookingbase-backup.timer --no-pager
