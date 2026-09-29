import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import {
  decryptSessionToken,
  encryptSessionToken,
  SESSION_COOKIE_NAME,
  sanitizeUser,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function handleRefresh() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'No active session token provided.' },
        { status: 401 }
      );
    }

    const payload = await decryptSessionToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Session has expired or is invalid.' },
        { status: 401 }
      );
    }

    const dbSession = await prisma.session.findUnique({
      where: { session_token: payload.sessionId },
      include: { user: true },
    });

    if (!dbSession) {
      return NextResponse.json(
        { error: 'Session not found in active registry.' },
        { status: 401 }
      );
    }

    const now = new Date();
    if (now > dbSession.expires_at) {
      // Invalidate expired session in DB and record audit log
      await prisma.session.delete({ where: { id: dbSession.id } }).catch(() => {});
      await prisma.auditLog.create({
        data: {
          user_id: dbSession.user_id,
          action: 'SESSION_TIMEOUT',
          entity_type: 'Session',
          entity_id: dbSession.session_token,
          details: JSON.stringify({ reason: 'Session expired before refresh attempt' }),
        },
      }).catch(() => {});

      const response = NextResponse.json(
        { error: 'Session has expired due to 2 hours of inactivity.' },
        { status: 401 }
      );
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      return response;
    }

    if (!dbSession.user || !dbSession.user.is_active) {
      await prisma.session.delete({ where: { id: dbSession.id } }).catch(() => {});
      return NextResponse.json(
        { error: 'User account has been deactivated.' },
        { status: 403 }
      );
    }

    // Extend session by 2 hours (7200 seconds)
    const maxAgeSeconds = 7200; // 2 hours
    const newExpiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

    await prisma.session.update({
      where: { id: dbSession.id },
      data: { expires_at: newExpiresAt },
    });

    const refreshedPayload = {
      ...payload,
      exp: newExpiresAt.getTime(),
    };

    const newToken = await encryptSessionToken(refreshedPayload);

    const response = NextResponse.json({
      success: true,
      message: 'Session successfully extended for 2 hours.',
      expiresAt: newExpiresAt.toISOString(),
      user: sanitizeUser(dbSession.user),
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    });

    return response;
  } catch (error: any) {
    console.error('Session refresh error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh session.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return handleRefresh();
}

export async function GET() {
  return handleRefresh();
}
