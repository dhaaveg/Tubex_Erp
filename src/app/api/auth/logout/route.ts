import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import {
  decryptSessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import { withApiHandler } from '@/lib/api-handler';

export const POST = withApiHandler(async (request: Request) => {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      const payload = await decryptSessionToken(token);
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
            details: JSON.stringify({ email: payload.email }),
          },
        }).catch(() => {});
      }
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

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
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Logout error' }, { status: 500 });
  }
});
