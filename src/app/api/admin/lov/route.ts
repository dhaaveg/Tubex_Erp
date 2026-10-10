import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withApiHandler } from '@/lib/api-handler';
import {
  verifyLovMutationAuth,
  handleUnauthorizedLovMutation,
  logLovSuccessAudit,
} from '@/lib/lov-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/lov?category=...
 * Admin endpoint to list all LOV items including inactive ones and available categories.
 */
export const GET = withApiHandler(async (request: Request) => {
  const auth = await verifyLovMutationAuth(request);
  if (!auth.isAuthorized) {
    return handleUnauthorizedLovMutation(request, auth);
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
});

/**
 * POST /api/admin/lov
 * Admin endpoint to create a new LOV item.
 * Strictly restricted to SUPER_ADMIN and ADMIN roles.
 */
export const POST = withApiHandler(async (request: Request) => {
  const auth = await verifyLovMutationAuth(request);
  if (!auth.isAuthorized) {
    return handleUnauthorizedLovMutation(request, auth);
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

  // Record successful creation in AuditLog
  await logLovSuccessAudit('LOV_CREATED', auth, created.id, {
    category: created.category,
    code: created.code,
    label: created.label,
    value: created.value,
    sort_order: created.sort_order,
  });

  return NextResponse.json(created, { status: 201 });
});

/**
 * PATCH /api/admin/lov
 * Admin endpoint to reorder multiple LOV items in batch.
 * Strictly restricted to SUPER_ADMIN and ADMIN roles.
 */
export const PATCH = withApiHandler(async (request: Request) => {
  const auth = await verifyLovMutationAuth(request);
  if (!auth.isAuthorized) {
    return handleUnauthorizedLovMutation(request, auth);
  }

  const body = await request.json();
  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { success: false, error: 'An array of items with id and sort_order is required.' },
      { status: 400 }
    );
  }

  // Bulk update sort orders in a transaction
  await prisma.$transaction(
    items.map((it: { id: string; sort_order: number }) =>
      prisma.listOfValue.update({
        where: { id: it.id },
        data: { sort_order: Number(it.sort_order) },
      })
    )
  );

  // Record successful reorder in AuditLog
  await logLovSuccessAudit('LOV_REORDERED', auth, null, {
    reorderedCount: items.length,
    itemIds: items.map((i: any) => i.id),
  });

  return NextResponse.json({
    success: true,
    message: `${items.length} LOV items reordered successfully.`,
  });
});
