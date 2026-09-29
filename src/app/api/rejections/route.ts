import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const disposition = searchParams.get('disposition');

    const where: any = {};
    if (category) where.defect_category = category;
    if (disposition) where.disposition_action = disposition;

    const rejections = await prisma.rejectionPosting.findMany({
      where,
      include: {
        production_posting: true,
        work_order: {
          include: {
            target_product: true,
            tally_item: true,
          },
        },
      },
      orderBy: { logged_timestamp: 'desc' },
    });

    // Compute category aggregations
    const byCategory: Record<string, number> = {};
    const byDisposition: Record<string, number> = {};

    rejections.forEach((r) => {
      byCategory[r.defect_category] = (byCategory[r.defect_category] || 0) + r.defect_quantity;
      byDisposition[r.disposition_action] = (byDisposition[r.disposition_action] || 0) + r.defect_quantity;
    });

    return NextResponse.json({
      rejections,
      analytics: {
        byCategory,
        byDisposition,
        totalDefects: rejections.reduce((sum, r) => sum + r.defect_quantity, 0),
      },
    });
  } catch (error: any) {
    console.error('Error fetching rejections:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
