import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import {
  decryptSessionToken,
  encryptSessionToken,
  SESSION_COOKIE_NAME,
  AUTH_COOKIES_TO_PURGE,
  sanitizeUser,
} from '@/lib/auth';
import { withApiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

function purgeCookies(response: NextResponse) {
  for (const cookieName of AUTH_COOKIES_TO_PURGE) {
    response.cookies.set({
      name: cookieName,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0), // Thu, 01 Jan 1970 00:00:00 GMT
    });
  }
  return response;
}

async function handleRefresh() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      const res = NextResponse.json(
        { success: false, error: 'No active session token provided.' },
        { status: 401 }
      );
      return purgeCookies(res);
    }

    const payload = await decryptSessionToken(token);
    if (!payload) {
      const res = NextResponse.json(
        { success: false, error: 'Session has expired or is invalid.' },
        { status: 401 }
      );
      return purgeCookies(res);
    }

    const dbSession = await prisma.session.findUnique({
      where: { session_token: payload.sessionId },
      include: { user: true },
    });

    if (!dbSession) {
      const res = NextResponse.json(
        { success: false, error: 'Session not found in active registry.' },
        { status: 401 }
      );
      return purgeCookies(res);
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
        { success: false, error: 'Session has expired due to 2 hours of inactivity.' },
        { status: 401 }
      );
      return purgeCookies(response);
    }

    if (!dbSession.user || !dbSession.user.is_active) {
      await prisma.session.delete({ where: { id: dbSession.id } }).catch(() => {});
      const res = NextResponse.json(
        { success: false, error: 'User account has been deactivated.' },
        { status: 403 }
      );
      return purgeCookies(res);
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
      expires: newExpiresAt,
    });

    return response;
  } catch (error: any) {
    console.error('Session refresh error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to refresh session.' },
      { status: 500 }
    );
  }
}

export const POST = withApiHandler(async () => handleRefresh());
export const GET = withApiHandler(async () => handleRefresh());
