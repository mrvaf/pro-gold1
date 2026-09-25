#!/usr/bin/env bash
# V-GOLD Database Backup Script (ADR-0065)
# Dumps PostgreSQL database safely with tenant and migration metadata

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/vgold_backup_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] Starting V-GOLD PostgreSQL database backup..."

if [ "${DATABASE_ENABLED:-false}" != "true" ]; then
  echo "[WARN] DATABASE_ENABLED is not true. Skipping physical pg_dump in in-memory mode."
  exit 0
fi

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-postgres}"
PGUSER="${PGUSER:-postgres}"

pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -F c -b -v -f "${BACKUP_FILE}" "${PGDATABASE}"

echo "[INFO] Backup completed successfully: ${BACKUP_FILE}"
