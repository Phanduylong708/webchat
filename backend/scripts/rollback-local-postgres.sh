#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${ENV_FILE:-${BACKEND_DIR}/.env}"
APP_NAME="${APP_NAME:-webchat-backend}"
PM2_BIN="${PM2_BIN:-pm2}"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path-to-backup.dump>" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Error: backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "Error: pg_restore is not installed." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "${ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is empty. Set it in environment or ${ENV_FILE}." >&2
  exit 1
fi

echo "Stopping app: ${APP_NAME}"
"${PM2_BIN}" stop "${APP_NAME}" >/dev/null

echo "Restoring backup: ${BACKUP_FILE}"
pg_restore \
  --dbname="${DATABASE_URL}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "${BACKUP_FILE}"

echo "Starting app: ${APP_NAME}"
"${PM2_BIN}" start "${APP_NAME}" >/dev/null

echo "Rollback completed successfully."
