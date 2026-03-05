/**
 * Prisma client singleton.
 *
 * For SQLite, uses @prisma/adapter-libsql (Prisma 6+).
 * For PostgreSQL and MySQL, uses standard PrismaClient with no adapter.
 *
 * The provider is inferred from the DATABASE_URL prefix:
 *   file:    → SQLite / libsql
 *   postgres → PostgreSQL
 *   mysql    → MySQL / MariaDB
 */

import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. See README for configuration instructions.'
      );
    }

    if (url.startsWith('file:') || url.startsWith('libsql:')) {
      // SQLite via libsql adapter (required for Prisma 6+)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrismaLibSql } = require('@prisma/adapter-libsql') as {
        PrismaLibSql: new (opts: { url: string }) => object;
      };
      const adapter = new PrismaLibSql({ url });
      prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
    } else {
      // PostgreSQL / MySQL — standard client, no adapter
      prisma = new PrismaClient();
    }
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
