import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withApiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/lov?category=...
 * Public / Authenticated dropdown query endpoint.
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
