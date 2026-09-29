// src/lib/dynamic-permissions.ts
// Server-Side Dynamic Role-to-Module Mapping & Permission Management Engine

import prisma from './prisma';
import {
  Role,
  ALL_ROLES,
  CANONICAL_MODULES,
  ERPModuleMeta,
  RolePermissionItem,
  getDefaultPermission,
} from './auth-types';

export interface RolePermissionsMatrix {
  permissions: RolePermissionItem[];
  matrixByRole: Record<
    Role,
    Record<
      string,
      {
        id: string;
        route_path: string;
        is_enabled: boolean;
        can_read: boolean;
        can_write: boolean;
      }
    >
  >;
  modules: ERPModuleMeta[];
  roles: Role[];
  timestamp: number;
}

// In-Memory Fast Cache with TTL
let cachedMatrix: RolePermissionsMatrix | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15_000; // 15 seconds TTL

/**
 * Invalidate the active server permission cache immediately
 */
export function invalidatePermissionCache(): void {
  cachedMatrix = null;
  lastCacheTime = 0;
}

/**
 * Idempotently seeds default permissions for all 8 roles across all 10 modules
 */
export async function seedDefaultRolePermissions(forceReset: boolean = false): Promise<void> {
  const operations: any[] = [];

  for (const role of ALL_ROLES) {
    for (const mod of CANONICAL_MODULES) {
      const def = getDefaultPermission(role, mod.key);
      if (forceReset) {
        operations.push(
          prisma.roleModulePermission.upsert({
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
          })
        );
      } else {
        operations.push(
          prisma.roleModulePermission.upsert({
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
            update: {}, // preserve existing customization
          })
        );
      }
    }
  }

  await prisma.$transaction(operations);
  invalidatePermissionCache();
}

/**
 * Retrieves the complete matrix of role permissions from DB (cached)
 */
export async function getRolePermissionsMatrix(bypassCache: boolean = false): Promise<RolePermissionsMatrix> {
  const now = Date.now();
  if (!bypassCache && cachedMatrix && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedMatrix;
  }

  let dbRecords = await prisma.roleModulePermission.findMany({
    orderBy: [{ role: 'asc' }, { module_key: 'asc' }],
  });

  // If table is missing entries (expected 8 roles * 10 modules = 80), seed defaults
  const expectedTotal = ALL_ROLES.length * CANONICAL_MODULES.length;
  if (dbRecords.length < expectedTotal) {
    await seedDefaultRolePermissions(false);
    dbRecords = await prisma.roleModulePermission.findMany({
      orderBy: [{ role: 'asc' }, { module_key: 'asc' }],
    });
  }

  const matrixByRole: any = {};
  for (const role of ALL_ROLES) {
    matrixByRole[role] = {};
  }

  const permissions: RolePermissionItem[] = [];

  for (const rec of dbRecords) {
    const item: RolePermissionItem = {
      id: rec.id,
      role: rec.role as Role,
      module_key: rec.module_key,
      route_path: rec.route_path,
      can_read: rec.can_read,
      can_write: rec.can_write,
      is_enabled: rec.is_enabled,
    };
    permissions.push(item);

    if (matrixByRole[rec.role]) {
      matrixByRole[rec.role][rec.module_key] = {
        id: rec.id,
        route_path: rec.route_path,
        is_enabled: rec.is_enabled,
        can_read: rec.can_read,
        can_write: rec.can_write,
      };
    }
  }

  // Ensure SUPER_ADMIN always has full unrestricted access in the matrix
  for (const mod of CANONICAL_MODULES) {
    if (!matrixByRole.SUPER_ADMIN[mod.key]) {
      matrixByRole.SUPER_ADMIN[mod.key] = {
        id: 'super-admin-root',
        route_path: mod.route_path,
        is_enabled: true,
        can_read: true,
        can_write: true,
      };
    } else {
      matrixByRole.SUPER_ADMIN[mod.key].is_enabled = true;
      matrixByRole.SUPER_ADMIN[mod.key].can_read = true;
      matrixByRole.SUPER_ADMIN[mod.key].can_write = true;
    }
  }

  cachedMatrix = {
    permissions,
    matrixByRole,
    modules: CANONICAL_MODULES,
    roles: ALL_ROLES,
    timestamp: now,
  };
  lastCacheTime = now;

  return cachedMatrix;
}

/**
 * Calculates effective union permissions for a user across multiple assigned roles.
 */
export async function getUserEffectivePermissions(
  roles: (Role | string)[]
): Promise<Record<string, { is_enabled: boolean; can_read: boolean; can_write: boolean; route_path: string }>> {
  const normalizedRoles = (roles && roles.length > 0 ? roles : ['PROCUREMENT']) as Role[];

  // SUPER_ADMIN has unrestricted privilege across all modules
  if (normalizedRoles.includes('SUPER_ADMIN')) {
    const fullAccess: Record<string, any> = {};
    for (const mod of CANONICAL_MODULES) {
      fullAccess[mod.key] = {
        route_path: mod.route_path,
        is_enabled: true,
        can_read: true,
        can_write: true,
      };
    }
    return fullAccess;
  }

  const { matrixByRole } = await getRolePermissionsMatrix();
  const effective: Record<string, { is_enabled: boolean; can_read: boolean; can_write: boolean; route_path: string }> = {};

  for (const mod of CANONICAL_MODULES) {
    let is_enabled = false;
    let can_read = false;
    let can_write = false;

    for (const r of normalizedRoles) {
      const rolePerm = matrixByRole[r]?.[mod.key];
      if (rolePerm) {
        if (rolePerm.is_enabled) is_enabled = true;
        if (rolePerm.can_read) can_read = true;
        if (rolePerm.can_write) can_write = true;
      }
    }

    effective[mod.key] = {
      route_path: mod.route_path,
      is_enabled,
      can_read,
      can_write,
    };
  }

  return effective;
}

/**
 * Resolves module key from requested pathname
 */
export function resolveModuleKeyFromPath(pathname: string): string | null {
  if (pathname === '/' || pathname === '/overview') return 'overview';
  if (pathname === '/master-data' || pathname.startsWith('/api/suppliers') || pathname.startsWith('/api/products')) {
    return 'master-data';
  }
  if (
    pathname === '/procurement' ||
    pathname === '/po' ||
    pathname === '/pos' ||
    pathname === '/purchase-orders' ||
    pathname.startsWith('/api/purchase-orders')
  ) {
    return 'procurement';
  }
  if (
    pathname === '/receiving' ||
    pathname === '/tally' ||
    pathname === '/grn' ||
    pathname === '/inwarding' ||
    pathname.startsWith('/api/grn') ||
    pathname.startsWith('/api/tally')
  ) {
    return 'receiving';
  }
  if (
    pathname === '/customer-orders' ||
    pathname === '/cpo' ||
    pathname === '/orders' ||
    pathname === '/customers' ||
    pathname.startsWith('/api/customer-orders')
  ) {
    return 'customer-orders';
  }
  if (
    pathname === '/shop-floor' ||
    pathname === '/wo' ||
    pathname === '/wos' ||
    pathname === '/work-orders' ||
    pathname === '/shopfloor' ||
    pathname.startsWith('/api/work-orders') ||
    pathname.startsWith('/api/production-postings')
  ) {
    return 'shop-floor';
  }
  if (
    pathname === '/quality' ||
    pathname === '/qa' ||
    pathname === '/rejections' ||
    pathname.startsWith('/api/rejections')
  ) {
    return 'quality';
  }
  if (pathname === '/traceability' || pathname.startsWith('/api/traceability')) {
    return 'traceability';
  }
  if (pathname === '/admin-export' || pathname === '/export' || pathname.startsWith('/api/export')) {
    return 'admin-export';
  }
  if (pathname === '/user-management' || pathname.startsWith('/api/users') || pathname.startsWith('/api/admin/')) {
    return 'user-management';
  }

  return null;
}

/**
 * Evaluates whether assigned roles can access a route or module with given HTTP method
 */
export async function canRolesAccessRoute(
  roles: (Role | string)[],
  pathname: string,
  method: string = 'GET'
): Promise<{ allowed: boolean; readOnly: boolean; moduleKey?: string; reason?: string }> {
  const normalizedRoles = (roles && roles.length > 0 ? roles : ['PROCUREMENT']) as Role[];

  if (normalizedRoles.includes('SUPER_ADMIN')) {
    return { allowed: true, readOnly: false };
  }

  const moduleKey = resolveModuleKeyFromPath(pathname);
  if (!moduleKey) {
    // Unmapped routes default to allowed if authenticated
    return { allowed: true, readOnly: false };
  }

  const effective = await getUserEffectivePermissions(normalizedRoles);
  const perm = effective[moduleKey];

  if (!perm || !perm.is_enabled) {
    return {
      allowed: false,
      readOnly: false,
      moduleKey,
      reason: `Assigned roles (${normalizedRoles.join(', ')}) do not permit access to module "${moduleKey}"`,
    };
  }

  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
  if (isMutation && !perm.can_write) {
    return {
      allowed: false,
      readOnly: true,
      moduleKey,
      reason: `Role has read-only permission for module "${moduleKey}" and cannot perform mutations`,
    };
  }

  return { allowed: true, readOnly: !perm.can_write, moduleKey };
}

/**
 * Batch update role module permissions in database with audit logging
 */
export async function updateRolePermissions(
  updates: Partial<RolePermissionItem>[],
  actor: { userId?: string; email?: string; ipAddress?: string }
): Promise<{ count: number }> {
  // 1. Root Security Validation: Ensure SUPER_ADMIN core privileges cannot be revoked
  for (const item of updates) {
    if (item.role === 'SUPER_ADMIN') {
      if (item.is_enabled === false || item.can_read === false || item.can_write === false) {
        throw new Error('SUPER_ADMIN core root privileges cannot be revoked or restricted.');
      }
    }
  }

  // 2. Perform updates in a database transaction
  const operations = updates.map((item) => {
    if (!item.role || !item.module_key) {
      throw new Error('Each permission update must specify role and module_key.');
    }
    const def = getDefaultPermission(item.role, item.module_key);
    return prisma.roleModulePermission.upsert({
      where: {
        role_module_key: {
          role: item.role,
          module_key: item.module_key,
        },
      },
      create: {
        role: item.role,
        module_key: item.module_key,
        route_path: item.route_path || def.route_path,
        is_enabled: item.is_enabled !== undefined ? item.is_enabled : def.is_enabled,
        can_read: item.can_read !== undefined ? item.can_read : def.can_read,
        can_write: item.can_write !== undefined ? item.can_write : def.can_write,
      },
      update: {
        ...(item.route_path !== undefined && { route_path: item.route_path }),
        ...(item.is_enabled !== undefined && { is_enabled: item.is_enabled }),
        ...(item.can_read !== undefined && { can_read: item.can_read }),
        ...(item.can_write !== undefined && { can_write: item.can_write }),
      },
    });
  });

  await prisma.$transaction(operations);

  // 3. Log Audit Entry
  await prisma.auditLog.create({
    data: {
      user_id: actor.userId || null,
      action: 'ROLE_PERMISSIONS_UPDATED',
      entity_type: 'RolePermission',
      details: JSON.stringify({
        updated_count: updates.length,
        modified_by: actor.email || 'SYSTEM',
        changes: updates.map((u) => ({
          role: u.role,
          module: u.module_key,
          is_enabled: u.is_enabled,
          can_read: u.can_read,
          can_write: u.can_write,
        })),
      }),
      ip_address: actor.ipAddress || null,
    },
  });

  // 4. Invalidate Active Server Cache
  invalidatePermissionCache();

  return { count: updates.length };
}

/**
 * Resets a single role (or all roles) to default mapping
 */
export async function resetRolePermissions(
  targetRole?: Role,
  actor?: { userId?: string; email?: string; ipAddress?: string }
): Promise<void> {
  const rolesToReset = targetRole ? [targetRole] : ALL_ROLES;
  const operations: any[] = [];

  for (const role of rolesToReset) {
    for (const mod of CANONICAL_MODULES) {
      const def = getDefaultPermission(role, mod.key);
      operations.push(
        prisma.roleModulePermission.upsert({
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
        })
      );
    }
  }

  await prisma.$transaction(operations);

  if (actor) {
    await prisma.auditLog.create({
      data: {
        user_id: actor.userId || null,
        action: 'ROLE_PERMISSIONS_UPDATED',
        entity_type: 'RolePermission',
        details: JSON.stringify({
          reset_type: targetRole ? `ROLE_RESET_${targetRole}` : 'ALL_ROLES_RESET',
          modified_by: actor.email || 'SYSTEM',
        }),
        ip_address: actor.ipAddress || null,
      },
    });
  }

  invalidatePermissionCache();
}
