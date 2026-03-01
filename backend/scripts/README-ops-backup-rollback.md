# Backup and Rollback Operations

## Files

- `backup-local-postgres.sh`: create local PostgreSQL backup from `DATABASE_URL`
- `rollback-local-postgres.sh`: restore a selected backup file to `DATABASE_URL`

## Prerequisites

1. Run commands from `backend` directory.
2. Ensure `.env` contains valid `DATABASE_URL`.
3. Ensure `pg_dump`, `pg_restore`, and `pm2` are installed.

## Create Backup

```bash
cd ~/webchat/backend
./scripts/backup-local-postgres.sh
```

Optional overrides:

```bash
RETENTION_COUNT=14 ./scripts/backup-local-postgres.sh
BACKUP_DIR=/tmp/webchat-backups ./scripts/backup-local-postgres.sh
```

Default backup location:

- `/var/backups/webchat-postgres`

## Copy Backup to Home Computer (Manual)

Run this from your home computer:

```bash
scp -i <path-to-key.pem> ubuntu@<ec2-public-ip>:/var/backups/webchat-postgres/webchat-<timestamp>.dump .
```

## Rollback from Backup

```bash
cd ~/webchat/backend
./scripts/rollback-local-postgres.sh /var/backups/webchat-postgres/webchat-<timestamp>.dump
```

What rollback script does:

1. Stop PM2 app (`webchat-backend` by default)
2. Run `pg_restore --clean --if-exists`
3. Start PM2 app again

## Safety Checklist Before Rollback

1. Confirm target backup file timestamp.
2. Confirm app is not processing important live writes.
3. Keep one latest backup untouched before restoring.
4. Run smoke tests right after rollback.
