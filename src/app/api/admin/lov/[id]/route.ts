import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withApiHandler } from '@/lib/api-handler';
import { getCurrentSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

/**
 * PUT /api/admin/lov/[id]
 * Admin endpoint to update an existing LOV item.
 */
export const PUT = withApiHandler(
  async (request: Request, { params }: { params: { id: string } }) => {
    const sessionContext = await getCurrentSession();
    if (!sessionContext?.user || !ALLOWED_ADMIN_ROLES.includes(sessionContext.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required.' },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { label, value, sort_order, is_active } = body;

    const existing = await prisma.listOfValue.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'LOV item not found.' },
        { status: 404 }
      );
    }

    const updated = await prisma.listOfValue.update({
      where: { id },
      data: {
        ...(label !== undefined ? { label: String(label).trim() } : {}),
        ...(value !== undefined ? { value: String(value).trim() } : {}),
        ...(sort_order !== undefined ? { sort_order: Number(sort_order) } : {}),
        ...(is_active !== undefined ? { is_active: Boolean(is_active) } : {}),
      },
    });

    return NextResponse.json(updated);
  },
  { requireAuth: true, allowedRoles: ALLOWED_ADMIN_ROLES }
);

/**
 * DELETE /api/admin/lov/[id]
 * Admin endpoint to delete an LOV item.
 * Protects is_system_default from deletion.
 */
export const DELETE = withApiHandler(
  async (request: Request, { params }: { params: { id: string } }) => {
    const sessionContext = await getCurrentSession();
    if (!sessionContext?.user || !ALLOWED_ADMIN_ROLES.includes(sessionContext.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required.' },
        { status: 403 }
      );
    }

    const { id } = params;

    const existing = await prisma.listOfValue.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'LOV item not found.' },
        { status: 404 }
      );
    }

    if (existing.is_system_default) {
      return NextResponse.json(
        {
          success: false,
          error: 'System default LOV items cannot be permanently deleted. You may deactivate them instead.',
        },
        { status: 400 }
      );
    }

    await prisma.listOfValue.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `LOV item "${existing.label}" deleted successfully.`,
    });
  },
  { requireAuth: true, allowedRoles: ALLOWED_ADMIN_ROLES }
);
