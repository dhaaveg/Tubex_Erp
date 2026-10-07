// src/app/api/admin/role-permissions/cache/route.ts
// Lightweight internal cache sync endpoint for Edge Middleware & Server processes

import { NextRequest, NextResponse } from 'next/server';
import { getRolePermissionsMatrix, invalidatePermissionCache } from '@/lib/dynamic-permissions';
import { withApiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request: Request) => {
  try {
    const nextUrl = new URL(request.url);
    const shouldClear = nextUrl.searchParams.get('clear') === '1';
    if (shouldClear) {
      invalidatePermissionCache();
      return NextResponse.json({ success: true, cleared: true, timestamp: Date.now() });
    }

    const bypassCache = nextUrl.searchParams.get('fresh') === 'true';
    const matrix = await getRolePermissionsMatrix(bypassCache);

    return NextResponse.json({
      success: true,
      matrixByRole: matrix.matrixByRole,
      timestamp: matrix.timestamp,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Cache fetch error' }, { status: 500 });
  }
});
