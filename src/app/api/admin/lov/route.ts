import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withApiHandler } from '@/lib/api-handler';
import { getCurrentSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

/**
 * GET /api/admin/lov?category=...
 * Admin endpoint to list all LOV items including inactive ones and available categories.
 */
export const GET = withApiHandler(
  async (request: Request) => {
    const sessionContext = await getCurrentSession();
    if (!sessionContext?.user || !ALLOWED_ADMIN_ROLES.includes(sessionContext.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where: any = {};
    if (category) {
      where.category = category.trim().toUpperCase();
    }

    const [items, distinctCategories] = await Promise.all([
      prisma.listOfValue.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { sort_order: 'asc' },
          { label: 'asc' },
        ],
      }),
      prisma.listOfValue.findMany({
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      }),
    ]);

    return NextResponse.json({
      items,
      categories: distinctCategories.map((c) => c.category),
    });
  },
  { requireAuth: true, allowedRoles: ALLOWED_ADMIN_ROLES }
);

/**
 * POST /api/admin/lov
 * Admin endpoint to create a new LOV item.
 */
export const POST = withApiHandler(
  async (request: Request) => {
    const sessionContext = await getCurrentSession();
    if (!sessionContext?.user || !ALLOWED_ADMIN_ROLES.includes(sessionContext.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { category, code, label, value, sort_order, is_active } = body;

    if (!category || typeof category !== 'string' || !category.trim()) {
      return NextResponse.json(
        { success: false, error: 'Category is required.' },
        { status: 400 }
      );
    }

    if (!label || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json(
        { success: false, error: 'Label is required.' },
        { status: 400 }
      );
    }

    const cleanCategory = category.trim().toUpperCase();
    const cleanLabel = label.trim();
    const cleanValue = (value && typeof value === 'string' && value.trim()) || cleanLabel;
    
    // Auto-generate safe code if not supplied
    let cleanCode = code ? String(code).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') : '';
    if (!cleanCode) {
      cleanCode = cleanLabel.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 32);
    }

    // Check duplicate
    const existing = await prisma.listOfValue.findUnique({
      where: {
        category_code: {
          category: cleanCategory,
          code: cleanCode,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `An item with code "${cleanCode}" already exists in category "${cleanCategory}".` },
        { status: 409 }
      );
    }

    const created = await prisma.listOfValue.create({
      data: {
        category: cleanCategory,
        code: cleanCode,
        label: cleanLabel,
        value: cleanValue,
        sort_order: typeof sort_order === 'number' ? sort_order : 100,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
        is_system_default: false,
      },
    });

    return NextResponse.json(created, { status: 201 });
  },
  { requireAuth: true, allowedRoles: ALLOWED_ADMIN_ROLES }
);
