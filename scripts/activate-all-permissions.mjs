// scripts/activate-all-permissions.mjs
// Activates all module permissions across all roles in both SQLite (dev.db) and PostgreSQL (if connected)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  console.log('--- Activating all module permissions across all roles ---');

  // 1. Update SQLite if dev.db exists
  const sqliteClientDir = path.resolve(rootDir, 'prisma/generated/sqlite-client');
  if (fs.existsSync(sqliteClientDir)) {
    const { PrismaClient: SqliteClient } = await import(`file://${sqliteClientDir.replace(/\\/g, '/')}/index.js`);
    const sqlite = new SqliteClient();
    try {
      const res = await sqlite.roleModulePermission.updateMany({
        data: {
          is_enabled: true,
          can_read: true,
        },
      });
      console.log(`✅ SQLite (dev.db): Activated ${res.count} role-module permission records.`);

      // Also ensure non-MD roles have can_write: true
      const writeRes = await sqlite.roleModulePermission.updateMany({
        where: {
          role: { not: 'MD' },
        },
        data: {
          can_write: true,
        },
      });
      console.log(`✅ SQLite (dev.db): Granted write access for ${writeRes.count} non-MD records.`);
    } catch (e) {
      console.warn('SQLite update note:', e.message);
    } finally {
      await sqlite.$disconnect();
    }
  }

  // 2. Update PostgreSQL if reachable
  const pgUrl = process.env.DATABASE_URL;
  if (pgUrl && (pgUrl.startsWith('postgresql://') || pgUrl.startsWith('postgres://'))) {
    try {
      const { PrismaClient: PgClient } = await import('@prisma/client');
      const pg = new PgClient();
      await pg.$connect();
      const res = await pg.roleModulePermission.updateMany({
        data: {
          is_enabled: true,
          can_read: true,
        },
      });
      console.log(`✅ PostgreSQL: Activated ${res.count} role-module permission records.`);
      await pg.$disconnect();
    } catch (e) {
      console.log('PostgreSQL note (skipped if offline):', e.message);
    }
  }

  console.log('✅ All module URLs activated successfully!');
}

main().catch(console.error);
