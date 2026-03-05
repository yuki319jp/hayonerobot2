/**
 * Backup service for Hayonero2.
 *
 * Creates timestamped copies of the SQLite database file, supports listing
 * and restoring backups, and prunes old backups based on a retention policy.
 *
 * Configuration (environment variables):
 *   BACKUP_DIR              - Directory to store backups (default: data/backups)
 *   BACKUP_RETENTION_DAYS   - How many days to keep backups (default: 7)
 */

import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'hayonero2.db');

function getBackupDir(): string {
  return process.env.BACKUP_DIR ?? path.join(process.cwd(), 'data', 'backups');
}

function getRetentionDays(): number {
  const v = parseInt(process.env.BACKUP_RETENTION_DAYS ?? '7', 10);
  return isNaN(v) || v < 1 ? 7 : v;
}

export interface BackupInfo {
  filename: string;
  path: string;
  createdAt: Date;
  sizeBytes: number;
}

/**
 * Creates a timestamped backup of the current database file.
 * Returns metadata about the created backup.
 */
export function createBackup(): BackupInfo {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database file not found: ${DB_PATH}`);
  }

  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `hayonero2_${ts}.db`;
  const destPath = path.join(backupDir, filename);

  fs.copyFileSync(DB_PATH, destPath);

  const stat = fs.statSync(destPath);
  console.log(`[Backup] Created: ${destPath} (${stat.size} bytes)`);

  return {
    filename,
    path: destPath,
    createdAt: stat.birthtime,
    sizeBytes: stat.size,
  };
}

/**
 * Lists all available backups sorted by creation time (newest first).
 */
export function listBackups(): BackupInfo[] {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return [];

  return fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('hayonero2_') && f.endsWith('.db'))
    .map((filename) => {
      const filePath = path.join(backupDir, filename);
      const stat = fs.statSync(filePath);
      return {
        filename,
        path: filePath,
        createdAt: stat.birthtime,
        sizeBytes: stat.size,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Restores the database from a backup file.
 * Creates a pre-restore backup of the current database before overwriting.
 *
 * @param filename - Backup filename (as returned by listBackups)
 */
export function restoreBackup(filename: string): void {
  const backupDir = getBackupDir();
  const srcPath = path.join(backupDir, filename);

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Backup file not found: ${srcPath}`);
  }

  // Safety: save current DB before overwriting
  if (fs.existsSync(DB_PATH)) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safetyBackup = path.join(backupDir, `hayonero2_pre-restore_${ts}.db`);
    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(DB_PATH, safetyBackup);
    console.log(`[Backup] Pre-restore safety backup: ${safetyBackup}`);
  }

  fs.copyFileSync(srcPath, DB_PATH);
  console.log(`[Backup] Restored from: ${srcPath}`);
}

/**
 * Deletes backup files older than BACKUP_RETENTION_DAYS.
 * Returns the number of files deleted.
 */
export function cleanOldBackups(): number {
  const retentionMs = getRetentionDays() * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;
  const backups = listBackups();
  let deleted = 0;

  for (const backup of backups) {
    if (backup.createdAt.getTime() < cutoff) {
      fs.unlinkSync(backup.path);
      console.log(`[Backup] Deleted old backup: ${backup.filename}`);
      deleted++;
    }
  }

  return deleted;
}
