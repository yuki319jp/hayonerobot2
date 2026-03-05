/**
 * Manual backup / restore CLI for Hayonero2.
 *
 * Usage:
 *   npm run backup                    — Create a backup now
 *   npm run backup -- --list          — List available backups
 *   npm run backup -- --restore <filename>   — Restore a specific backup
 */

import 'dotenv/config';
import { createBackup, listBackups, restoreBackup } from '../src/services/backup';

const argv = process.argv.slice(2);

if (argv.includes('--list')) {
  const backups = listBackups();
  if (backups.length === 0) {
    console.log('No backups found.');
  } else {
    console.log(`Found ${backups.length} backup(s):\n`);
    for (const b of backups) {
      const kb = (b.sizeBytes / 1024).toFixed(1);
      console.log(`  ${b.filename}  (${kb} KB)  ${b.createdAt.toISOString()}`);
    }
  }
} else if (argv.includes('--restore')) {
  const idx = argv.indexOf('--restore');
  const filename = argv[idx + 1];
  if (!filename) {
    console.error('Usage: npm run backup -- --restore <filename>');
    process.exit(1);
  }
  restoreBackup(filename);
  console.log('✅ Restore complete. Restart the bot to apply changes.');
} else {
  const info = createBackup();
  console.log(`✅ Backup created: ${info.filename} (${info.sizeBytes} bytes)`);
}
