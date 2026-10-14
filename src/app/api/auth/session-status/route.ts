import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  validateSessionInDb,
  decryptSessionToken,
  SESSION_COOKIE_NAME,
  AUTH_COOKIES_TO_PURGE,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    let sessionId = url.searchParams.get('sessionId');
    let userId = url.searchParams.get('userId') || undefined;

    // Fallback to cookie if query parameters omitted
    if (!sessionId) {
      const cookieStore = cookies();
      const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      if (token) {
        const payload = await decryptSessionToken(token, { ignoreExpiry: true });
        if (payload) {
          sessionId = payload.sessionId;
          userId = payload.userId;
        }
      }
    }

    if (!sessionId) {
      return NextResponse.json(
        { valid: false, status: 'INVALID', code: 'UNAUTHORIZED', error: 'No active session token provided.' },
        { status: 401 }
      );
    }

    const result = await validateSessionInDb(sessionId, userId);

    if (result.status === 'SUPERSEDED') {
      const response = NextResponse.json(
        {
          valid: false,
          status: 'SUPERSEDED',
          code: 'SESSION_SUPERSEDED',
          error: 'Your account was logged in from another device or browser. This session has been terminated.',
        },
        { status: 401 }
      );

      const proto = (request.headers.get('x-forwarded-proto') || '').toLowerCase();
      const isSecure = proto === 'https' || request.url.startsWith('https:');

      // Purge auth cookies
      for (const cookieName of AUTH_COOKIES_TO_PURGE) {
        response.cookies.set({
          name: cookieName,
          value: '',
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
          expires: new Date(0),
        });
      }
      return response;
    }

    if (result.status === 'EXPIRED') {
      return NextResponse.json(
        {
          valid: false,
          status: 'EXPIRED',
          code: 'SESSION_TIMEOUT',
          error: 'Session expired due to 2 hours of inactivity.',
        },
        { status: 401 }
      );
    }

    if (result.status === 'VALID' && result.user) {
      return NextResponse.json({
        valid: true,
        status: 'VALID',
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        },
      });
    }

    return NextResponse.json(
      { valid: false, status: 'INVALID', code: 'UNAUTHORIZED', error: 'Session is no longer valid.' },
      { status: 401 }
    );
  } catch (error: any) {
    console.error('Session status check error:', error);
    return NextResponse.json(
      { valid: false, status: 'ERROR', error: error.message || 'Internal server error checking session' },
      { status: 500 }
    );
  }
}
