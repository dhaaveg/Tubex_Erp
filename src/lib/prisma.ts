import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || '';
  const isPlaceholder =
    process.env.USE_SQLITE === 'true' ||
    dbUrl.startsWith('file:') ||
    dbUrl.includes('host:5432') ||
    dbUrl.includes('user:password@host');

  if (isPlaceholder) {
    try {
      // Use local SQLite client when in local environment without live PostgreSQL
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrismaClient: SqliteClient } = require('../../prisma/generated/sqlite-client');
      return new SqliteClient() as unknown as PrismaClient;
    } catch {
      // Fallback silently to standard Postgres client if sqlite client is absent
    }
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

