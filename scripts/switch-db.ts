/**
 * Database provider switcher for Hayonero2.
 *
 * Updates prisma/schema.prisma to use the chosen provider and prints the
 * required DATABASE_URL format for .env.
 *
 * Usage:
 *   npm run switch-db sqlite
 *   npm run switch-db postgresql
 *   npm run switch-db mysql
 *
 * After switching, run:
 *   npx prisma generate
 *   npx prisma migrate dev   (postgresql / mysql)
 *   npx prisma db push       (sqlite)
 */

import fs from 'fs';
import path from 'path';

const SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma');

const PROVIDER_URLS: Record<string, string> = {
  sqlite:     'file:./data/hayonero2.db',
  postgresql: 'postgresql://USER:PASSWORD@HOST:5432/hayonero2?schema=public',
  mysql:      'mysql://USER:PASSWORD@HOST:3306/hayonero2',
};

const provider = process.argv[2]?.toLowerCase();

if (!provider || !PROVIDER_URLS[provider]) {
  console.error('Usage: npm run switch-db <sqlite|postgresql|mysql>');
  process.exit(1);
}

let schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

// Replace provider line
schema = schema.replace(
  /provider\s*=\s*"(sqlite|postgresql|mysql)"/,
  `provider = "${provider}"`
);

fs.writeFileSync(SCHEMA_PATH, schema, 'utf-8');

console.log(`✅ Updated prisma/schema.prisma provider → "${provider}"`);
console.log(`\nSet DATABASE_URL in .env:\n`);
console.log(`  DATABASE_URL="${PROVIDER_URLS[provider]}"\n`);
console.log('Then run:');
if (provider === 'sqlite') {
  console.log('  npx prisma db push');
} else {
  console.log('  npx prisma migrate dev --name init');
}
console.log('  npx prisma generate');
