import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getUserEffectivePermissions } from '@/lib/dynamic-permissions';
import { withApiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async () => {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, authenticated: false, user: null }, { status: 401 });
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
