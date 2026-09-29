import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getUserEffectivePermissions } from '@/lib/dynamic-permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const roles =
      current.user.roles && current.user.roles.length > 0
        ? current.user.roles
        : [current.user.role];

    const effectivePermissions = await getUserEffectivePermissions(roles);

    return NextResponse.json({
      authenticated: true,
      user: current.user,
      effectivePermissions,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
