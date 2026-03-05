/**
 * Scheduled backup task for Hayonero2.
 *
 * Configuration (environment variables):
 *   BACKUP_SCHEDULE  - node-cron expression (default: "0 3 * * *" = 3 AM daily)
 *
 * Call scheduleBackup() once at bot startup to activate automatic backups.
 */

import cron from 'node-cron';
import { createBackup, cleanOldBackups } from '../services/backup';

export function scheduleBackup(): void {
  const schedule = process.env.BACKUP_SCHEDULE ?? '0 3 * * *';

  if (!cron.validate(schedule)) {
    console.error(`[Backup] Invalid BACKUP_SCHEDULE cron expression: "${schedule}". Using default "0 3 * * *".`);
    cron.schedule('0 3 * * *', runBackup);
    return;
  }

  cron.schedule(schedule, runBackup);
  console.log(`[Backup] Scheduled automatic backups: ${schedule}`);
}

function runBackup(): void {
  try {
    const info = createBackup();
    console.log(`[Backup] Auto-backup complete: ${info.filename} (${info.sizeBytes} bytes)`);
    const deleted = cleanOldBackups();
    if (deleted > 0) {
      console.log(`[Backup] Pruned ${deleted} old backup(s)`);
    }
  } catch (err) {
    console.error('[Backup] Auto-backup failed:', err);
  }
}
