#!/bin/sh

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/smsystem_backup_${TIMESTAMP}.sql"

# Ensure mysql-client is installed (if not already)
if ! command -v mysqldump >/dev/null 2>&1; then
    echo "Installing mysql-client..."
    apk add --no-cache mysql-client
fi

echo "Starting database backup at ${TIMESTAMP}..."

# Run mysqldump
mysqldump -h mysql -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} > ${BACKUP_FILE}

if [ $? -eq 0 ]; then
    echo "Backup successful: ${BACKUP_FILE}"
    # Rotate backups: keep only last 30 days
    find ${BACKUP_DIR} -name "smsystem_backup_*.sql" -mtime +30 -delete
else
    echo "Backup failed!"
    exit 1
fi
