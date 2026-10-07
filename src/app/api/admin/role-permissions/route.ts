// src/app/api/admin/role-permissions/route.ts
// Administrative API for Dynamic Role-to-Module Mapping & Permissions

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import {
  getRolePermissionsMatrix,
  updateRolePermissions,
  resetRolePermissions,
  invalidatePermissionCache,
} from '@/lib/dynamic-permissions';
import { Role } from '@/lib/auth-types';
import { withApiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request: Request) => {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const userRoles = current.user.roles && current.user.roles.length > 0 ? current.user.roles : [current.user.role];
    const isAuthorized = userRoles.includes('SUPER_ADMIN') || userRoles.includes('ADMIN');

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Role permissions matrix requires Administrator privileges.' },
        { status: 403 }
      );
    }

    const nextUrl = new URL(request.url);
    const bypassCache = nextUrl.searchParams.get('fresh') === 'true';
    const matrix = await getRolePermissionsMatrix(bypassCache);

    return NextResponse.json({
      success: true,
      permissions: matrix.permissions,
      matrixByRole: matrix.matrixByRole,
      modules: matrix.modules,
      roles: matrix.roles,
      timestamp: matrix.timestamp,
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/role-permissions:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
});

export const PUT = withApiHandler(async (request: Request) => {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const userRoles = current.user.roles && current.user.roles.length > 0 ? current.user.roles : [current.user.role];
    const isAuthorized = userRoles.includes('SUPER_ADMIN') || userRoles.includes('ADMIN');

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Modifying role permissions requires Administrator privileges.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    // 1. Reset to Defaults Request
    if (body.resetRole) {
      const targetRole = body.resetRole as Role;
      if (targetRole === 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'SUPER_ADMIN root privileges cannot be altered or reset.' },
          { status: 400 }
        );
      }

      await resetRolePermissions(targetRole, {
        userId: current.user.id,
        email: current.user.email,
        ipAddress,
      });

      // Notify middleware / clear edge cache
      try {
        const origin = new URL(request.url).origin;
        await fetch(`${origin}/api/admin/role-permissions/cache?clear=1`, { cache: 'no-store' });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `Successfully reset permissions for role ${targetRole} to default mapping.`,
      });
    }

    // 2. Batch Update Request
    const updates = Array.isArray(body) ? body : body.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload: "updates" must be a non-empty array of permission objects.' },
        { status: 400 }
      );
    }

    // Validate that SUPER_ADMIN root privileges cannot be revoked
    for (const item of updates) {
      if (item.role === 'SUPER_ADMIN') {
        if (item.is_enabled === false || item.can_read === false || item.can_write === false) {
          return NextResponse.json(
            { success: false, error: 'Security Violation: SUPER_ADMIN core root privileges cannot be revoked or restricted.' },
            { status: 400 }
          );
        }
      }
    }

    const result = await updateRolePermissions(updates, {
      userId: current.user.id,
      email: current.user.email,
      ipAddress,
    });

    // Notify middleware / clear edge cache
    try {
      const origin = new URL(request.url).origin;
      await fetch(`${origin}/api/admin/role-permissions/cache?clear=1`, { cache: 'no-store' });
    } catch {}

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Successfully updated ${result.count} role permissions.`,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/admin/role-permissions:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
});
