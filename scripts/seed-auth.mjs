import { PrismaClient } from '@prisma/client';
import { argon2id } from 'hash-wasm';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function hash(password) {
  const salt = crypto.randomBytes(16);
  return await argon2id({
    password,
    salt,
    iterations: 2,
    memorySize: 19456,
    parallelism: 1,
    hashLength: 32,
    outputType: 'encoded'
  });
}

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@energyoilfield.com';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@2026!';

// Purge Demo Users: Strictly retain single foundational SUPER_ADMIN account
const DEMO_EMAILS_TO_PURGE = [
  'admin@energyoilfield.com',
  'md@energyoilfield.com',
  'procurement@energyoilfield.com',
  'manufacturing@energyoilfield.com',
  'sales@energyoilfield.com',
  'inventory@energyoilfield.com',
  'quality@energyoilfield.com',
];

export async function seedAuth() {
  console.log('--- Checking & Provisioning Authentication & RBAC Users ---');

  // 1. Migrate any existing users from legacy domains to @energyoilfield.com
  const legacyUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: '@eotcouplings.com' } },
        { email: { contains: '@eotcoupling.com' } },
      ],
    },
  });

  for (const u of legacyUsers) {
    const updatedEmail = u.email
      .replace('@eotcouplings.com', '@energyoilfield.com')
      .replace('@eotcoupling.com', '@energyoilfield.com')
      .toLowerCase()
      .trim();

    // Check if target email already exists before updating
    const existingTarget = await prisma.user.findUnique({
      where: { email: updatedEmail },
    });

    if (!existingTarget) {
      await prisma.user.update({
        where: { id: u.id },
        data: { email: updatedEmail },
      });
      console.log(`✓ Migrated user email: ${u.email} -> ${updatedEmail}`);
    } else {
      // Remove duplicate old account
      await prisma.user.delete({ where: { id: u.id } });
      console.log(`✓ Removed legacy duplicate user: ${u.email}`);
    }
  }

  // 2. Check for foundational root SUPER_ADMIN
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (!existingSuperAdmin) {
    console.log(`Provisioning root SUPER_ADMIN: ${SUPERADMIN_EMAIL}`);
    const passwordHash = await hash(SUPERADMIN_PASSWORD);
    const superAdmin = await prisma.user.create({
      data: {
        name: 'Root Super Admin',
        email: SUPERADMIN_EMAIL.toLowerCase().trim(),
        password_hash: passwordHash,
        role: 'SUPER_ADMIN',
        roles: JSON.stringify(['SUPER_ADMIN']),
        department: 'Root IT & Systems',
        is_active: true,
        force_password_change: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: superAdmin.id,
        action: 'SUPER_ADMIN_INITIALIZED',
        entity_type: 'User',
        entity_id: superAdmin.id,
        details: JSON.stringify({ email: superAdmin.email }),
      },
    });
    console.log('✓ Root SUPER_ADMIN provisioned successfully.');
  } else {
    // Ensure Super Admin email uses @energyoilfield.com
    if (existingSuperAdmin.email !== SUPERADMIN_EMAIL) {
      await prisma.user.update({
        where: { id: existingSuperAdmin.id },
        data: { email: SUPERADMIN_EMAIL },
      });
      console.log(`✓ Updated SUPER_ADMIN email to ${SUPERADMIN_EMAIL}`);
    } else {
      console.log(`✓ Foundational SUPER_ADMIN active (${existingSuperAdmin.email}).`);
    }
  }

  // 3. Purge all hardcoded placeholder/demo accounts (retain strictly the single foundational SUPER_ADMIN)
  const purged = await prisma.user.deleteMany({
    where: {
      email: { in: DEMO_EMAILS_TO_PURGE },
    },
  });
  if (purged.count > 0) {
    console.log(`✓ Purged ${purged.count} placeholder/demo user accounts from database.`);
  }

  console.log('--- Authentication Seeding Complete (Foundational Super Admin Verified) ---');
}

// Allow CLI direct execution: node scripts/seed-auth.mjs
if (process.argv[1]?.endsWith('seed-auth.mjs')) {
  seedAuth()
    .catch((err) => {
      console.error('Error during auth seeding:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
