/**
 * Database migration script: sql.js SQLite → Prisma-managed database.
 *
 * Reads encrypted records from the existing sql.js SQLite file and inserts
 * them into the target database via Prisma (SQLite, PostgreSQL, or MySQL).
 * Encrypted data is transferred AS-IS — no decryption / re-encryption occurs.
 *
 * Usage:
 *   npm run db:migrate-data
 *   npm run db:migrate-data -- --dry-run
 *   npm run db:migrate-data -- --source-db=path/to/old.db
 *   npm run db:migrate-data -- --overwrite    # overwrite existing records
 *
 * Prerequisites:
 *   1. Run `npm run switch-db <provider>` to set the target provider.
 *   2. Set DATABASE_URL in .env for the target database.
 *   3. Run `npm run db:push` or `npm run db:migrate` to create the schema.
 *   4. Run this script to import data.
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import initSqlJs from 'sql.js';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const dryRun  = argv.includes('--dry-run');
const overwrite = argv.includes('--overwrite');
const sourceArg = argv.find((a) => a.startsWith('--source-db='))?.split('=')[1];

const SOURCE_DB = sourceArg
  ? path.resolve(sourceArg)
  : path.join(process.cwd(), 'data', 'hayonero2.db');

// ---------------------------------------------------------------------------

type OldRow = {
  guild_id: string;
  data: string;
  iv: string;
  tag: string;
  key_version: number | null;
  updated_at: number | null;
};

async function main(): Promise<void> {
  console.log('🔄 Hayonero2 data migration: sql.js SQLite → Prisma');
  console.log(`   Source DB  : ${SOURCE_DB}`);
  console.log(`   Target     : ${process.env.DATABASE_URL ?? '(DATABASE_URL not set)'}`);
  console.log(`   Mode       : ${dryRun ? 'DRY RUN' : 'LIVE'}${overwrite ? ' + OVERWRITE' : ''}\n`);

  if (!fs.existsSync(SOURCE_DB)) {
    console.error(`❌ Source database not found: ${SOURCE_DB}`);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Configure .env before migrating.');
    process.exit(1);
  }

  // --- Read source DB -------------------------------------------------------
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(SOURCE_DB);
  const srcDb = new SQL.Database(buffer);

  const stmt = srcDb.prepare(
    `SELECT guild_id, data, iv, tag,
            COALESCE(key_version, 1) AS key_version,
            updated_at
     FROM server_settings`
  );

  const rows: OldRow[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject() as OldRow;
    rows.push(r);
  }
  stmt.free();
  srcDb.close();

  console.log(`📊 Found ${rows.length} record(s) in source database.\n`);

  if (rows.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  // --- Write to Prisma target -----------------------------------------------
  const prisma = new PrismaClient();
  await prisma.$connect();

  let inserted = 0;
  let skipped  = 0;
  let overwritten = 0;
  let failed   = 0;

  for (const row of rows) {
    try {
      const existing = await prisma.serverSettings.findUnique({
        where: { guildId: row.guild_id },
      });

      if (existing && !overwrite) {
        console.log(`  ⏭️  ${row.guild_id}: already exists, skipping (use --overwrite to replace)`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(
          `  ✅ [DRY RUN] ${row.guild_id}: would ${existing ? 'overwrite' : 'insert'}`
        );
        existing ? overwritten++ : inserted++;
        continue;
      }

      await prisma.serverSettings.upsert({
        where: { guildId: row.guild_id },
        create: {
          guildId:    row.guild_id,
          data:       row.data,
          iv:         row.iv,
          tag:        row.tag,
          keyVersion: row.key_version ?? 1,
          updatedAt:  row.updated_at ?? Math.floor(Date.now() / 1000),
        },
        update: {
          data:       row.data,
          iv:         row.iv,
          tag:        row.tag,
          keyVersion: row.key_version ?? 1,
          updatedAt:  row.updated_at ?? Math.floor(Date.now() / 1000),
        },
      });

      console.log(`  ✅ ${row.guild_id}: ${existing ? 'overwritten' : 'inserted'}`);
      existing ? overwritten++ : inserted++;
    } catch (err) {
      console.error(`  ❌ ${row.guild_id}: failed —`, (err as Error).message);
      failed++;
    }
  }

  await prisma.$disconnect();

  console.log(`\n📊 Summary:`);
  console.log(`   Inserted  : ${inserted}`);
  console.log(`   Overwritten: ${overwritten}`);
  console.log(`   Skipped   : ${skipped}`);
  console.log(`   Failed    : ${failed}`);

  if (failed > 0) {
    console.error('\n⚠️  Some records failed to migrate. Check the output above.');
    process.exit(1);
  }

  if (!dryRun) {
    console.log('\n🎉 Migration complete!');
    console.log('   Verify the data with: npx prisma studio');
    console.log('   Then update DATABASE_URL and restart the bot.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
