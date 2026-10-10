import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getUserEffectivePermissions } from '@/lib/dynamic-permissions';
import { withApiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request: Request) => {
  try {
    const proto = (request?.headers.get('x-forwarded-proto') || '').toLowerCase();
    const isSecure = proto === 'https' || (request?.url ? request.url.startsWith('https:') : false);

    const current = await getCurrentSession();
    if (!current) {
      const res = NextResponse.json({ success: false, authenticated: false, user: null }, { status: 401 });
      const { AUTH_COOKIES_TO_PURGE } = await import('@/lib/auth-types');
      for (const cookieName of AUTH_COOKIES_TO_PURGE) {
        res.cookies.set({
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
      return res;
    }

    const roles =
      current.user.roles && current.user.roles.length > 0
        ? current.user.roles
        : [current.user.role];

    const effectivePermissions = await getUserEffectivePermissions(roles);

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: current.user,
      effectivePermissions,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error fetching user session' }, { status: 500 });
  }
});
