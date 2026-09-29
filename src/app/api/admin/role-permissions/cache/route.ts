// src/app/api/admin/role-permissions/cache/route.ts
// Lightweight internal cache sync endpoint for Edge Middleware & Server processes

import { NextRequest, NextResponse } from 'next/server';
import { getRolePermissionsMatrix, invalidatePermissionCache } from '@/lib/dynamic-permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const shouldClear = request.nextUrl.searchParams.get('clear') === '1';
    if (shouldClear) {
      invalidatePermissionCache();
      return NextResponse.json({ cleared: true, timestamp: Date.now() });
    }

    const bypassCache = request.nextUrl.searchParams.get('fresh') === 'true';
    const matrix = await getRolePermissionsMatrix(bypassCache);

    return NextResponse.json({
      matrixByRole: matrix.matrixByRole,
      timestamp: matrix.timestamp,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Cache fetch error' }, { status: 500 });
  }
}
