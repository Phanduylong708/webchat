#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${ENV_FILE:-${BACKEND_DIR}/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/webchat-postgres}"
RETENTION_COUNT="${RETENTION_COUNT:-7}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump is not installed." >&2
  exit 1
fi

if [[ ! "${RETENTION_COUNT}" =~ ^[0-9]+$ ]]; then
  echo "Error: RETENTION_COUNT must be a non-negative integer." >&2
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

mkdir -p "${BACKUP_DIR}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="${BACKUP_DIR}/webchat-${timestamp}.dump"

echo "Creating backup: ${backup_file}"
pg_dump \
  --dbname="${DATABASE_URL}" \
  -Fc \
  --no-owner \
  --no-privileges \
  -f "${backup_file}"

echo "Backup completed: ${backup_file}"
ls -lh "${backup_file}"

if (( RETENTION_COUNT > 0 )); then
  mapfile -t backups < <(ls -1t "${BACKUP_DIR}"/webchat-*.dump 2>/dev/null || true)
  if (( ${#backups[@]} > RETENTION_COUNT )); then
    for (( i = RETENTION_COUNT; i < ${#backups[@]}; i++ )); do
      rm -f "${backups[$i]}"
      echo "Deleted old backup: ${backups[$i]}"
    done
  fi
fi
