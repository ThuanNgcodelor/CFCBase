#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
WORD_EDITOR_COMPOSE="$ROOT_DIR/docker-compose.word-editor.yml"

if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
fi

printf '[BookingBase Stop] Tat Cloudflare Tunnel va backend...\n'
systemctl --user stop bookingbase-tunnel.service bookingbase-backend.service 2>/dev/null || true

printf '[BookingBase Stop] Tat MySQL va Redis...\n'
docker compose -f "$ROOT_DIR/docker-compose.yml" --project-directory "$ROOT_DIR" stop db redis

if [[ -f "$WORD_EDITOR_COMPOSE" ]]; then
  printf '[BookingBase Stop] Tat ONLYOFFICE Document Server (giu nguyen volumes)...\n'
  ONLYOFFICE_IMAGE="${ONLYOFFICE_IMAGE:-onlyoffice/documentserver:9.4.0}" \
  WORD_EDITOR_JWT_SECRET="${WORD_EDITOR_JWT_SECRET:-stop-command-placeholder-secret}" \
    docker compose -f "$WORD_EDITOR_COMPOSE" --project-directory "$ROOT_DIR" stop documentserver
fi

backend_state="$(systemctl --user is-active bookingbase-backend.service 2>/dev/null || true)"
tunnel_state="$(systemctl --user is-active bookingbase-tunnel.service 2>/dev/null || true)"

printf '\nTrang thai sau khi tat:\n'
printf '  Backend: %s\n' "${backend_state:-inactive}"
printf '  Tunnel:  %s\n' "${tunnel_state:-inactive}"
docker compose -f "$ROOT_DIR/docker-compose.yml" --project-directory "$ROOT_DIR" ps db redis
if [[ -f "$WORD_EDITOR_COMPOSE" ]]; then
  ONLYOFFICE_IMAGE="${ONLYOFFICE_IMAGE:-onlyoffice/documentserver:9.4.0}" \
  WORD_EDITOR_JWT_SECRET="${WORD_EDITOR_JWT_SECRET:-stop-command-placeholder-secret}" \
    docker compose -f "$WORD_EDITOR_COMPOSE" --project-directory "$ROOT_DIR" ps documentserver
fi

if [[ "$backend_state" == active || "$tunnel_state" == active ]]; then
  printf '\n[BookingBase Stop] ERROR: Van con service dang chay.\n' >&2
  exit 1
fi

printf '\n[BookingBase Stop] Da tat BookingBase production.\n'
