import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  requireRole,
  hashPassword,
  sanitizeUser,
  Role,
  ALL_ROLES,
  parseRoles,
  getCurrentSession,
  encryptSessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import { withApiHandler } from '@/lib/api-handler';

interface RouteContext {
  params: { id: string };
}

export const PUT = withApiHandler(async (request: Request, { params }: RouteContext) => {
  try {
    const currentSession = await getCurrentSession();
    if (!currentSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const currentUser = currentSession.user;
    const targetUserId = params.id;
    const isSelfEdit = currentUser.id === targetUserId;
    const isCallerSuperAdmin =
      currentUser.roles?.includes('SUPER_ADMIN') || currentUser.role === 'SUPER_ADMIN';
    const isCallerAdmin =
      currentUser.roles?.includes('ADMIN') || currentUser.role === 'ADMIN';

    // Must be either editing self OR have ADMIN/SUPER_ADMIN role
    if (!isSelfEdit && !isCallerAdmin && !isCallerSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You do not have permission to modify other user accounts.' },
        { status: 403 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const targetRoles = parseRoles(targetUser);
    const isTargetSuperAdmin = targetRoles.includes('SUPER_ADMIN');

    // Super Admin invisibility: If target is SUPER_ADMIN and caller is not, pretend 404 (unless self-edit)
    if (isTargetSuperAdmin && !isCallerSuperAdmin && !isSelfEdit) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, role, roles, department, is_active, force_password_change, temporaryPassword } = body;

    const updateData: any = {};

    // 1. Full Name update & validation
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return NextResponse.json(
          { success: false, error: 'User name cannot be empty.' },
          { status: 400 }
        );
      }
      updateData.name = cleanName;
    }

    // 2. Email ID update, validation, and duplicate conflict check
    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        return NextResponse.json(
          { success: false, error: 'A valid corporate email address is required (e.g. name@energyoilfield.com).' },
          { status: 400 }
        );
      }

      if (cleanEmail !== targetUser.email) {
        const existing = await prisma.user.findUnique({
          where: { email: cleanEmail },
        });
        if (existing && existing.id !== targetUserId) {
          return NextResponse.json(
            { success: false, error: `The email address "${cleanEmail}" is already registered to another user.` },
            { status: 400 }
          );
        }
        updateData.email = cleanEmail;
      }
    }

    // 3. Department update
    if (department !== undefined) {
      updateData.department = department ? String(department).trim() : null;
    }

    // 4. Role changes & Administrative controls (Only ADMIN or SUPER_ADMIN can alter roles or status)
    if (isCallerAdmin || isCallerSuperAdmin) {
      let newRoles: Role[] | undefined = undefined;
      if (Array.isArray(roles) && roles.length > 0) {
        newRoles = roles.filter((r) => ALL_ROLES.includes(r as Role)) as Role[];
      } else if (role && ALL_ROLES.includes(role as Role)) {
        newRoles = [role as Role];
      }

      // Admin privileges check: Non-super-admins cannot assign or elevate to SUPER_ADMIN
      if (newRoles && newRoles.includes('SUPER_ADMIN') && !isCallerSuperAdmin) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Only a Super Administrator can assign the SUPER_ADMIN role.' },
          { status: 403 }
        );
      }

      // Guard against self-lockout: Prevent demoting or deactivating the last active SUPER_ADMIN
      if (isTargetSuperAdmin) {
        const isDemoting = newRoles && !newRoles.includes('SUPER_ADMIN');
        const isDeactivating = is_active === false;

        if (isDemoting || isDeactivating) {
          const allUsers = await prisma.user.findMany({
            where: { is_active: true },
            select: { role: true, roles: true },
          });

          const activeSuperAdminCount = allUsers.filter((u) => parseRoles(u).includes('SUPER_ADMIN')).length;

          if (activeSuperAdminCount <= 1) {
            return NextResponse.json(
              { success: false, error: 'Action Blocked: Cannot demote or deactivate the last remaining active Super Administrator.' },
              { status: 400 }
            );
          }
        }
      }

      if (is_active !== undefined) updateData.is_active = Boolean(is_active);
      if (force_password_change !== undefined) updateData.force_password_change = Boolean(force_password_change);

      if (newRoles && newRoles.length > 0) {
        updateData.role = newRoles[0]; // Primary role
        updateData.roles = JSON.stringify(newRoles);
      }

      if (temporaryPassword !== undefined && temporaryPassword !== null && String(temporaryPassword).trim() !== '') {
        const cleanPassword = String(temporaryPassword).trim();
        const hasLetter = /[a-zA-Z]/.test(cleanPassword);
        const hasNumber = /[0-9]/.test(cleanPassword);
        const hasSymbol = /[^a-zA-Z0-9]/.test(cleanPassword);

        if (cleanPassword.length < 8 || !hasLetter || !hasNumber || !hasSymbol) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Password complexity required: Temporary password must be at least 8 characters long and contain letters, numbers, and symbols.',
            },
            { status: 400 }
          );
        }

        updateData.password_hash = await hashPassword(cleanPassword);
        updateData.force_password_change = true;

        // Invalidate any existing sessions for the target user so old credentials and sessions cannot be reused
        await prisma.session.deleteMany({
          where: { user_id: targetUserId },
        });

        // Write an entry to AuditLog recording action: 'ADMIN_PASSWORD_RESET'
        await prisma.auditLog.create({
          data: {
            user_id: currentUser.id,
            action: 'ADMIN_PASSWORD_RESET',
            entity_type: 'User',
            entity_id: targetUserId,
            details: JSON.stringify({
              target_user_id: targetUserId,
              target_email: targetUser.email,
              reset_by: currentUser.email,
              force_password_change: true,
              sessions_revoked: true,
            }),
          },
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
    });

    // Session & Lifecycle Security:
    // Deactivating a user must immediately invalidate all their active database sessions
    if (updateData.is_active === false) {
      await prisma.session.deleteMany({
        where: { user_id: targetUserId },
      });
    }

    const auditDetails = { ...updateData };
    if (auditDetails.password_hash) {
      delete auditDetails.password_hash; // Never store hashes in audit details
      auditDetails.password_reset = true;
    }

    await prisma.auditLog.create({
      data: {
        user_id: currentUser.id,
        action: updateData.is_active === false ? 'USER_DEACTIVATED' : 'USER_UPDATED',
        entity_type: 'User',
        entity_id: targetUserId,
        details: JSON.stringify(auditDetails),
      },
    });

    const response = NextResponse.json({
      success: true,
      user: sanitizeUser(updatedUser),
      message: 'User profile updated successfully.',
    });

    // If caller edited their own profile, refresh session cookie on response
    if (isSelfEdit) {
      const updatedRoles = parseRoles(updatedUser);
      const refreshedToken = await encryptSessionToken({
        sessionId: currentSession.session.session_token,
        userId: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedRoles[0] || (updatedUser.role as Role),
        roles: updatedRoles,
        force_password_change: updatedUser.force_password_change,
        exp: Date.now() + 24 * 60 * 60 * 1000,
      });

      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: refreshedToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });
    }

    return response;
  } catch (error: any) {
    console.error('Update user error:', error);
    const status = error.status || 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
});

export const DELETE = withApiHandler(async (request: Request, { params }: RouteContext) => {
  try {
    const { user: currentUser } = await requireRole(['SUPER_ADMIN']);
    const targetUserId = params.id;

    if (currentUser.id === targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Self-deletion is prohibited. You cannot delete your own account.' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const targetRoles = parseRoles(targetUser);
    if (targetRoles.includes('SUPER_ADMIN')) {
      const allUsers = await prisma.user.findMany({
        select: { role: true, roles: true },
      });
      const superAdminCount = allUsers.filter((u) => parseRoles(u).includes('SUPER_ADMIN')).length;

      if (superAdminCount <= 1) {
        return NextResponse.json(
          { success: false, error: 'Action Blocked: Cannot delete the last remaining Super Administrator.' },
          { status: 400 }
        );
      }
    }

    // Delete user (sessions cascade)
    await prisma.user.delete({
      where: { id: targetUserId },
    });

    await prisma.auditLog.create({
      data: {
        user_id: currentUser.id,
        action: 'USER_DELETED',
        entity_type: 'User',
        entity_id: targetUserId,
        details: JSON.stringify({ email: targetUser.email, role: targetUser.role }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User account removed successfully.',
    });
  } catch (error: any) {
    console.error('Delete user error:', error);
    const status = error.status || 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
});
