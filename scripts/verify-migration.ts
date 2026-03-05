/**
 * Post-migration verification script for Hayonero2.
 *
 * Verifies that all records migrated from sql.js SQLite to Prisma can be
 * successfully decrypted with the current ENCRYPTION_SECRET, and that
 * the record count matches between source and target databases.
 *
 * Usage:
 *   npm run db:verify
 *   npm run db:verify -- --source-db=path/to/old.db
 *
 * Prerequisites:
 *   - DATABASE_URL and ENCRYPTION_SECRET must be set in .env
 *   - Migration must have been completed (scripts/migrate-to-prisma.ts)
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import initSqlJs from 'sql.js';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../src/database/crypto';

// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const sourceArg = argv.find((a) => a.startsWith('--source-db='))?.split('=')[1];
const SOURCE_DB = sourceArg
  ? path.resolve(sourceArg)
  : path.join(process.cwd(), 'data', 'hayonero2.db');

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('🔍 Hayonero2 post-migration verification');
  console.log(`   Source DB  : ${SOURCE_DB}`);
  console.log(`   Target DB  : ${process.env.DATABASE_URL ?? '(not set)'}\n`);

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set.');
    process.exit(1);
  }

  // --- Load source (old sql.js SQLite) -------------------------------------
  let srcGuildIds: string[] = [];
  if (fs.existsSync(SOURCE_DB)) {
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(SOURCE_DB);
    const srcDb = new SQL.Database(buffer);
    const stmt = srcDb.prepare('SELECT guild_id FROM server_settings');
    while (stmt.step()) {
      const row = stmt.getAsObject() as { guild_id: string };
      srcGuildIds.push(row.guild_id);
    }
    stmt.free();
    srcDb.close();
    console.log(`📊 Source records : ${srcGuildIds.length}`);
  } else {
    console.warn(`⚠️  Source DB not found (${SOURCE_DB}) — skipping count comparison`);
  }

  // --- Load target (Prisma) ------------------------------------------------
  const prisma = new PrismaClient();
  await prisma.$connect();

  const rows = await prisma.serverSettings.findMany();
  console.log(`📊 Target records : ${rows.length}`);

  if (srcGuildIds.length > 0 && rows.length !== srcGuildIds.length) {
    console.warn(
      `⚠️  Record count mismatch: source=${srcGuildIds.length}, target=${rows.length}`
    );
  }

  // --- Decrypt each record to verify integrity ----------------------------
  console.log('\n🔑 Verifying decryption for each record...');
  let passed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const payload = {
        data: row.data,
        iv: row.iv,
        tag: row.tag,
        keyVersion: row.keyVersion ?? 1,
      };
      const settings = decrypt(row.guildId, payload);
      // Basic sanity checks
      if (typeof settings.guildId !== 'string') throw new Error('guildId is not a string');
      if (typeof settings.enabled !== 'boolean') throw new Error('enabled is not a boolean');
      console.log(`  ✅ ${row.guildId}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${row.guildId}: ${(err as Error).message}`);
      failed++;
    }
  }

  await prisma.$disconnect();

  // --- Summary ------------------------------------------------------------
  console.log(`\n📊 Verification summary:`);
  console.log(`   Passed : ${passed}`);
  console.log(`   Failed : ${failed}`);

  if (failed > 0) {
    console.error('\n⚠️  Some records failed verification.');
    console.error('   Check ENCRYPTION_SECRET and ensure it matches the one used to encrypt the data.');
    process.exit(1);
  }

  if (srcGuildIds.length > 0 && rows.length < srcGuildIds.length) {
    console.warn('\n⚠️  Target has fewer records than source. Re-run migrate-to-prisma.ts.');
    process.exit(1);
  }

  console.log('\n🎉 All records verified successfully!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
