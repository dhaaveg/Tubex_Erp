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

const INITIAL_ROLES_USERS = [
  {
    email: 'admin@energyoilfield.com',
    name: 'Vikram Joshi (Admin)',
    role: 'ADMIN',
    department: 'IT Administration',
    password: process.env.DEMO_USER_PASSWORD || 'EotErp@2026!',
  },
  {
    email: 'md@energyoilfield.com',
    name: 'Rajesh Mehra (Managing Director)',
    role: 'MD',
    department: 'Executive Board',
    password: process.env.DEMO_USER_PASSWORD || 'EotErp@2026!',
  },
  {
    email: 'procurement@energyoilfield.com',
    name: 'Anita Sharma (Procurement Head)',
    role: 'PROCUREMENT',
    department: 'Sourcing & Supply Chain',
    password: process.env.DEMO_USER_PASSWORD || 'EotErp@2026!',
  },
  {
    email: 'manufacturing@energyoilfield.com',
    name: 'Sunil Rao (Shop Floor Manager)',
    role: 'MANUFACTURING',
    department: 'Plant Operations',
    password: process.env.DEMO_USER_PASSWORD || 'EotErp@2026!',
  },
  {
    email: 'sales@energyoilfield.com',
    name: 'Priya Verma (Sales Manager)',
    role: 'SALES',
    department: 'Commercial & Sales',
    password: process.env.DEMO_USER_PASSWORD || 'EotErp@2026!',
  },
  {
    email: 'inventory@energyoilfield.com',
    name: 'Karan Patel (Yard & Tally In-Charge)',
    role: 'INVENTORY',
    department: 'Weighbridge & Yard',
    password: process.env.DEMO_USER_PASSWORD || 'EotErp@2026!',
  },
  {
    email: 'quality@energyoilfield.com',
    name: 'Marcus Vance (Level III NDT / QA)',
    role: 'QUALITY',
    department: 'Quality Assurance & Testing',
    password: process.env.DEMO_USER_PASSWORD || 'EotErp@2026!',
  },
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

  // 2. Check for existing SUPER_ADMIN
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
      console.log(`✓ SUPER_ADMIN already exists (${existingSuperAdmin.email}).`);
    }
  }

  // 3. Provision or sync standard departmental test accounts
  for (const acc of INITIAL_ROLES_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: acc.email.toLowerCase().trim() },
    });

    if (!existing) {
      const passwordHash = await hash(acc.password);
      await prisma.user.create({
        data: {
          email: acc.email.toLowerCase().trim(),
          name: acc.name,
          role: acc.role,
          department: acc.department,
          password_hash: passwordHash,
          is_active: true,
          force_password_change: false,
        },
      });
      console.log(`✓ Provisioned initial user: ${acc.email} (${acc.role})`);
    } else {
      console.log(`✓ User already exists: ${acc.email} (${existing.role})`);
    }
  }

  console.log('--- Authentication Seeding Complete ---');
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
