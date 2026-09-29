// scripts/seed-role-permissions.mjs
// Seeds the RoleModulePermission table with default role allocations

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MD',
  'PROCUREMENT',
  'MANUFACTURING',
  'SALES',
  'INVENTORY',
  'QUALITY',
];

const CANONICAL_MODULES = [
  { key: 'overview', route_path: '/' },
  { key: 'master-data', route_path: '/master-data' },
  { key: 'procurement', route_path: '/procurement' },
  { key: 'receiving', route_path: '/receiving' },
  { key: 'customer-orders', route_path: '/customer-orders' },
  { key: 'shop-floor', route_path: '/shop-floor' },
  { key: 'quality', route_path: '/quality' },
  { key: 'traceability', route_path: '/traceability' },
  { key: 'admin-export', route_path: '/admin-export' },
  { key: 'user-management', route_path: '/user-management' },
];

const MODULE_ACCESS_MAP = {
  'procurement': {
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'PROCUREMENT', 'MD'],
    readOnlyRoles: ['MD'],
  },
  'receiving': {
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'INVENTORY', 'MD'],
    readOnlyRoles: ['MD'],
  },
  'shop-floor': {
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANUFACTURING', 'MD'],
    readOnlyRoles: ['MD'],
  },
  'quality': {
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'QUALITY', 'MD'],
    readOnlyRoles: ['MD'],
  },
  'customer-orders': {
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'SALES', 'MD'],
    readOnlyRoles: ['MD'],
  },
  'traceability': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: ['MD'],
  },
  'master-data': {
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'PROCUREMENT', 'MANUFACTURING', 'QUALITY', 'MD'],
    readOnlyRoles: ['MD'],
  },
  'overview': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: ['MD'],
  },
  'admin-export': {
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MD'],
    readOnlyRoles: [],
  },
  'user-management': {
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
    readOnlyRoles: [],
  },
};

function getDefaultPermission(role, moduleKey) {
  const mod = CANONICAL_MODULES.find((m) => m.key === moduleKey);
  const route_path = mod ? mod.route_path : `/${moduleKey}`;

  if (role === 'SUPER_ADMIN') {
    return { route_path, is_enabled: true, can_read: true, can_write: true };
  }

  const rule = MODULE_ACCESS_MAP[moduleKey];
  if (!rule) {
    return { route_path, is_enabled: false, can_read: false, can_write: false };
  }

  const isAllowed = rule.allowedRoles.includes(role);
  if (!isAllowed) {
    return { route_path, is_enabled: false, can_read: false, can_write: false };
  }

  const isReadOnly = (rule.readOnlyRoles || []).includes(role);
  return {
    route_path,
    is_enabled: true,
    can_read: true,
    can_write: !isReadOnly,
  };
}

async function main() {
  console.log('--- Seeding Dynamic RoleModulePermission Defaults ---');
  let count = 0;

  for (const role of ALL_ROLES) {
    for (const mod of CANONICAL_MODULES) {
      const def = getDefaultPermission(role, mod.key);
      await prisma.roleModulePermission.upsert({
        where: {
          role_module_key: {
            role,
            module_key: mod.key,
          },
        },
        create: {
          role,
          module_key: mod.key,
          route_path: def.route_path,
          is_enabled: def.is_enabled,
          can_read: def.can_read,
          can_write: def.can_write,
        },
        update: {
          route_path: def.route_path,
          is_enabled: def.is_enabled,
          can_read: def.can_read,
          can_write: def.can_write,
        },
      });
      count++;
    }
  }

  console.log(`✅ Successfully seeded ${count} role-module permission records.`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
