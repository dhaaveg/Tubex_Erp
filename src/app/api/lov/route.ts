import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withApiHandler } from '@/lib/api-handler';
import {
  verifyLovMutationAuth,
  handleUnauthorizedLovMutation,
} from '@/lib/lov-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/lov?category=...
 * Read-only dropdown query endpoint for standard operational modules.
 * Returns active LOV entries sorted by sort_order ascending.
 */
export const GET = withApiHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  const where: any = { is_active: true };
  if (category) {
    where.category = category.trim().toUpperCase();
  }

  const items = await prisma.listOfValue.findMany({
    where,
    orderBy: [
      { sort_order: 'asc' },
      { label: 'asc' },
    ],
  });

  return NextResponse.json(items);
});

/**
 * POST /api/lov
 * Guarded against unauthorized mutation tampering.
 * Only SUPER_ADMIN and ADMIN are authorized.
 */
export const POST = withApiHandler(async (request: Request) => {
  const auth = await verifyLovMutationAuth(request);
  if (!auth.isAuthorized) {
    return handleUnauthorizedLovMutation(request, auth);
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Please use /api/admin/lov endpoint for creating List of Values (LOV) entries.',
    },
    { status: 400 }
  );
});

/**
 * PUT /api/lov
 * Guarded against unauthorized mutation tampering.
 */
export const PUT = withApiHandler(async (request: Request) => {
  const auth = await verifyLovMutationAuth(request);
  if (!auth.isAuthorized) {
    return handleUnauthorizedLovMutation(request, auth);
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Please use /api/admin/lov/[id] endpoint for updating List of Values (LOV) entries.',
    },
    { status: 400 }
  );
});

/**
 * PATCH /api/lov
 * Guarded against unauthorized mutation tampering.
 */
export const PATCH = withApiHandler(async (request: Request) => {
  const auth = await verifyLovMutationAuth(request);
  if (!auth.isAuthorized) {
    return handleUnauthorizedLovMutation(request, auth);
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Please use /api/admin/lov endpoint for reordering or patching List of Values (LOV) entries.',
    },
    { status: 400 }
  );
});

/**
 * DELETE /api/lov
 * Guarded against unauthorized mutation tampering.
 */
export const DELETE = withApiHandler(async (request: Request) => {
  const auth = await verifyLovMutationAuth(request);
  if (!auth.isAuthorized) {
    return handleUnauthorizedLovMutation(request, auth);
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Please use /api/admin/lov/[id] endpoint for deleting List of Values (LOV) entries.',
    },
    { status: 400 }
  );
});
