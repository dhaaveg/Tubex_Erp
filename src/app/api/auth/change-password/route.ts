import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  requireAuth,
  hashPassword,
  verifyPassword,
  encryptSessionToken,
  sanitizeUser,
  SESSION_COOKIE_NAME,
  Role,
  parseRoles,
} from '@/lib/auth';
import { withApiHandler } from '@/lib/api-handler';

// Enterprise password policy: min 8 chars, uppercase, lowercase, number, special symbol
const PasswordPolicySchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters long.')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter (A-Z).')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter (a-z).')
      .regex(/[0-9]/, 'Password must contain at least one number (0-9).')
      .regex(
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
        'Password must contain at least one special symbol (!@#$%^&*...).'
      ),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.confirmPassword !== undefined && data.confirmPassword !== null && data.confirmPassword !== '') {
        return data.newPassword === data.confirmPassword;
      }
      return true;
    },
    {
      message: 'New password and confirm password do not match.',
      path: ['confirmPassword'],
    }
  );

export const POST = withApiHandler(async (request: Request) => {
  try {
    const { user, session } = await requireAuth();
    const body = await request.json();

    // 1. Zod Enterprise Password Validation
    const parseResult = PasswordPolicySchema.safeParse(body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return NextResponse.json(
        { success: false, error: firstIssue?.message || 'Invalid password format.' },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parseResult.data;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User record not found.' }, { status: 404 });
    }

    // 2. Validate Current Password
    if (currentPassword) {
      const isCurrentValid = await verifyPassword(dbUser.password_hash, currentPassword);
      if (!isCurrentValid) {
        return NextResponse.json(
          { success: false, error: 'Current password verification failed. Please verify your existing password.' },
          { status: 400 }
        );
      }
    } else if (!dbUser.force_password_change) {
      return NextResponse.json(
        { success: false, error: 'Current password is required to authorize password update.' },
        { status: 400 }
      );
    }

    // 3. Reject Password Reuse (Cannot reuse existing password)
    const isReused = await verifyPassword(dbUser.password_hash, newPassword);
    if (isReused) {
      return NextResponse.json(
        {
          success: false,
          error: 'New password cannot be identical to your current password. Please choose a different password.',
        },
        { status: 400 }
      );
    }

    // 4. Secure Hash Generation & Database Mutation
    const newHash = await hashPassword(newPassword);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: newHash,
        force_password_change: false,
      },
    });

    // 5. Enterprise Audit Trail Logging
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'PASSWORD_CHANGED',
        entity_type: 'User',
        entity_id: user.id,
        details: JSON.stringify({
          email: user.email,
          source: 'self_service_security_tab',
          timestamp: new Date().toISOString(),
        }),
      },
    });

    // 6. Re-issue Refreshed Session Token
    const maxAgeSeconds = 60 * 60 * 24; // 24 hours
    const userRoles = parseRoles(updatedUser);
    const refreshedToken = await encryptSessionToken({
      sessionId: session.session_token,
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: userRoles[0] || (updatedUser.role as Role),
      roles: userRoles,
      force_password_change: false,
      exp: Date.now() + maxAgeSeconds * 1000,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Password successfully updated. Your new credentials are now active.',
      user: sanitizeUser(updatedUser),
    });

    const proto = (request.headers.get('x-forwarded-proto') || '').toLowerCase();
    const isSecure = proto === 'https' || request.url.startsWith('https:');

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: refreshedToken,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    });

    return response;
  } catch (error: any) {
    console.error('Password change error:', error);
    const status = error.status || 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to change password' },
      { status }
    );
  }
});
