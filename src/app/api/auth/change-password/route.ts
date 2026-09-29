import { NextResponse } from 'next/server';
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

export async function POST(request: Request) {
  try {
    const { user, session } = await requireAuth();
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Always validate current password if provided or required
    if (currentPassword) {
      const isCurrentValid = await verifyPassword(dbUser.password_hash, currentPassword);
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect.' },
          { status: 400 }
        );
      }
    } else if (!dbUser.force_password_change) {
      return NextResponse.json(
        { error: 'Current password is required to set a new password.' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: newHash,
        force_password_change: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'PASSWORD_CHANGED',
        entity_type: 'User',
        entity_id: user.id,
        details: JSON.stringify({ email: user.email }),
      },
    });

    // Re-issue updated session cookie with force_password_change: false
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
      message: 'Password updated successfully. You can now access your dashboard.',
      user: sanitizeUser(updatedUser),
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: refreshedToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    });

    return response;
  } catch (error: any) {
    console.error('Password change error:', error);
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Failed to change password' },
      { status }
    );
  }
}
