/**
 * Bulk key rotation script for Hayonero2.
 *
 * Usage:
 *   npm run rotate-keys
 *   npm run rotate-keys -- --dry-run
 *   npm run rotate-keys -- --backup-path=/custom/backup/dir
 *   npm run rotate-keys -- --concurrency=5
 *
 * Environment variables required:
 *   ENCRYPTION_SECRET          - new (target) secret
 *   ENCRYPTION_KEY_VERSION     - new version number (integer >= 2)
 *   ENCRYPTION_SECRET_V<n>     - each old secret (e.g., ENCRYPTION_SECRET_V1)
 *
 * This script:
 *   1. Creates a timestamped backup of the database (unless --dry-run)
 *   2. Reads all records and identifies those on an older key version
 *   3. Decrypts each with the old key and re-encrypts with the current key
 *   4. Writes the updated database back to disk
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import initSqlJs from 'sql.js';
import { encrypt, decrypt, getCurrentKeyVersion, EncryptedPayload } from '../src/database/crypto';

// --- CLI argument parsing ---------------------------------------------------
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const backupPathArg = argv.find((a) => a.startsWith('--backup-path='))?.split('=')[1];
const concurrency = parseInt(
  argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? '10',
  10
);

const DB_PATH = path.join(process.cwd(), 'data', 'hayonero2.db');

// ---------------------------------------------------------------------------

async function processInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
  }
}

async function main(): Promise<void> {
  console.log('🔑 Hayonero2 key rotation');
  console.log(`   Mode       : ${dryRun ? 'DRY RUN (no changes written)' : 'LIVE'}`);
  console.log(`   Concurrency: ${concurrency}`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  const currentVersion = getCurrentKeyVersion();
  console.log(`   Target key version: v${currentVersion}\n`);

  // --- Backup ----------------------------------------------------------------
  if (!dryRun) {
    const backupDir = backupPathArg ?? path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `hayonero2_pre-rotate_${ts}.db`);
    fs.copyFileSync(DB_PATH, backupFile);
    console.log(`💾 Backup created: ${backupFile}\n`);
  }

  // --- Load database ---------------------------------------------------------
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(dbBuffer);

  // Ensure key_version column exists (migration guard)
  try {
    db.run('ALTER TABLE server_settings ADD COLUMN key_version INTEGER NOT NULL DEFAULT 1');
  } catch (_) { /* already exists */ }

  const stmt = db.prepare(
    'SELECT guild_id, data, iv, tag, key_version FROM server_settings'
  );

  type Row = { guild_id: string; data: string; iv: string; tag: string; key_version: number };
  const records: Row[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Row;
    records.push({ ...row, key_version: row.key_version ?? 1 });
  }
  stmt.free();

  console.log(`📊 Total guilds : ${records.length}`);
  const pending = records.filter((r) => r.key_version < currentVersion);
  console.log(`🔄 Need rotation: ${pending.length}`);
  console.log(`⏭️  Already v${currentVersion}: ${records.length - pending.length}\n`);

  if (pending.length === 0) {
    console.log('✅ All records are already on the current key version. Nothing to do.');
    db.close();
    return;
  }

  let rotated = 0;
  let failed = 0;

  await processInBatches(pending, concurrency, async (record) => {
    try {
      const payload: EncryptedPayload = {
        data: record.data,
        iv: record.iv,
        tag: record.tag,
        keyVersion: record.key_version,
      };
      const settings = decrypt(record.guild_id, payload);
      const newPayload = encrypt(record.guild_id, settings);

      if (dryRun) {
        console.log(
          `  ✅ [DRY RUN] ${record.guild_id}: v${record.key_version} → v${newPayload.keyVersion}`
        );
      } else {
        db.run(
          `UPDATE server_settings
             SET data = ?, iv = ?, tag = ?, key_version = ?, updated_at = unixepoch()
           WHERE guild_id = ?`,
          [newPayload.data, newPayload.iv, newPayload.tag, newPayload.keyVersion, record.guild_id]
        );
        console.log(`  ✅ ${record.guild_id}: v${record.key_version} → v${newPayload.keyVersion}`);
      }
      rotated++;
    } catch (err) {
      console.error(`  ❌ ${record.guild_id}: rotation failed —`, (err as Error).message);
      failed++;
    }
  });

  // --- Save database ---------------------------------------------------------
  if (!dryRun && rotated > 0) {
    const exported = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(exported));
    console.log(`\n💾 Database saved (${rotated} record(s) updated)`);
  }

  db.close();

  console.log(`\n📊 Summary: ${rotated} rotated, ${records.length - pending.length} skipped, ${failed} failed`);
  if (failed > 0) {
    console.error('\n⚠️  Some records failed. The database has been partially updated.');
    console.error('   Restore from backup and investigate before retrying.');
    process.exit(1);
  }
  console.log('\n🎉 Key rotation complete!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
