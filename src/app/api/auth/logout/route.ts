import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import {
  decryptSessionToken,
  SESSION_COOKIE_NAME,
  AUTH_COOKIES_TO_PURGE,
} from '@/lib/auth';
import { withApiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

async function handleLogout(request?: Request) {
  const proto = (request?.headers.get('x-forwarded-proto') || '').toLowerCase();
  const isSecure = proto === 'https' || (request?.url ? request.url.startsWith('https:') : false);

  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      // Decode with ignoreExpiry: true so even expired sessions can be deleted from DB and audited
      const payload = await decryptSessionToken(token, { ignoreExpiry: true });
      if (payload?.sessionId) {
        await prisma.session.deleteMany({
          where: { session_token: payload.sessionId },
        }).catch(() => {});

        await prisma.auditLog.create({
          data: {
            user_id: payload.userId,
            action: 'LOGOUT',
            entity_type: 'Session',
            entity_id: payload.sessionId,
            details: JSON.stringify({ email: payload.email, reason: 'User logout or session termination' }),
          },
        }).catch(() => {});
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Deterministic Cookie Eviction: explicitly clear all auth cookies across identical Path=/, SameSite=Lax, HttpOnly=true, and Secure
    for (const cookieName of AUTH_COOKIES_TO_PURGE) {
      response.cookies.set({
        name: cookieName,
        value: '',
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        expires: new Date(0), // Thu, 01 Jan 1970 00:00:00 GMT
      });
    }

    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Logout error' }, { status: 500 });
  }
}

export const POST = withApiHandler(async (request: Request) => handleLogout(request));
export const GET = withApiHandler(async (request: Request) => handleLogout(request));
