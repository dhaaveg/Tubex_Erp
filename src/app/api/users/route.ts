import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  requireRole,
  hashPassword,
  sanitizeUser,
  Role,
  ALL_ROLES,
  getUserQueryFilter,
  parseRoles,
} from '@/lib/auth';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(async () => {
  try {
    const { user } = await requireRole(['SUPER_ADMIN', 'ADMIN']);

    // Strict server-level filter: SUPER_ADMIN is completely invisible to ADMIN
    const filter = getUserQueryFilter(user.role, user.roles);

    const users = await prisma.user.findMany({
      where: filter,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roles: true,
        department: true,
        is_active: true,
        force_password_change: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    const allUsers = await prisma.user.findMany({
      select: { role: true, roles: true },
    });
    const nonSuperAdminCount = allUsers.filter(
      (u) => !parseRoles(u).includes('SUPER_ADMIN')
    ).length;

    return NextResponse.json({
      users: users.map((u) => sanitizeUser(u)),
      viewerRole: user.role,
      viewerRoles: user.roles,
      nonSuperAdminCount,
      adminQuotaLimit: 5,
      canAdminProvision: nonSuperAdminCount <= 5,
    });
  } catch (error: any) {
    const status = error.status || 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
});

export const POST = withApiHandler(async (request: Request) => {
  try {
    const { user: currentUser } = await requireRole(['SUPER_ADMIN', 'ADMIN']);
    const isSuperAdmin =
      currentUser.roles?.includes('SUPER_ADMIN') || currentUser.role === 'SUPER_ADMIN';

    // Count current non-Super-Admin accounts in the system
    const allUsers = await prisma.user.findMany({
      select: { role: true, roles: true },
    });
    const nonSuperAdminCount = allUsers.filter(
      (u) => !parseRoles(u).includes('SUPER_ADMIN')
    ).length;

    // Quota Enforcement:
    // Super Admin (SUPER_ADMIN): Unrestricted user provisioning (unlimited accounts).
    // Admin (ADMIN): Permitted to provision new users only if the total count of non-Super-Admin accounts currently in the system is <= 5.
    // Once the non-Super-Admin user count exceeds 5, ADMIN accounts must be blocked from adding new users.
    if (!isSuperAdmin) {
      if (nonSuperAdminCount > 5) {
        return NextResponse.json(
          {
            success: false,
            error: `Admin Provisioning Quota Exceeded: Administrators are permitted to provision new users only when the total count of non-Super-Admin accounts in the system is 5 or fewer (currently ${nonSuperAdminCount}). As the count exceeds 5, user creation is restricted to Super Administrators.`,
            quotaExceeded: true,
            currentCount: nonSuperAdminCount,
            limit: 5,
          },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { email, name, role, roles, department, temporaryPassword } = body;

    // Normalize roles (support multi-role array or single role string)
    let assignedRoles: Role[] = [];
    if (Array.isArray(roles) && roles.length > 0) {
      assignedRoles = roles.filter((r) => ALL_ROLES.includes(r as Role)) as Role[];
    } else if (role && ALL_ROLES.includes(role as Role)) {
      assignedRoles = [role as Role];
    } else {
      assignedRoles = ['PROCUREMENT'];
    }

    // Admins cannot assign the SUPER_ADMIN role
    if (!isSuperAdmin && assignedRoles.includes('SUPER_ADMIN')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only a Super Administrator can assign the SUPER_ADMIN role.' },
        { status: 403 }
      );
    }

    if (!email || !name || assignedRoles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and at least one role are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Prevent Super Admin email enumeration:
    // Check if user with this email already exists
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `User with email "${cleanEmail}" already exists.` },
        { status: 400 }
      );
    }

    const passwordToHash = temporaryPassword || 'EotErp@2026!';
    const passwordHash = await hashPassword(passwordToHash);

    const primaryRole = assignedRoles[0];

    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: String(name).trim(),
        role: primaryRole,
        roles: JSON.stringify(assignedRoles),
        department: department ? String(department).trim() : null,
        password_hash: passwordHash,
        is_active: true,
        force_password_change: true, // newly provisioned users must reset on first login
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: currentUser.id,
        action: 'USER_CREATED',
        entity_type: 'User',
        entity_id: newUser.id,
        details: JSON.stringify({ email: newUser.email, roles: assignedRoles }),
      },
    });

    return NextResponse.json(
      {
        success: true,
        user: sanitizeUser(newUser),
        message: `User created successfully with role(s): ${assignedRoles.join(', ')}.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create user error:', error);
    const status = error.status || 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
});
