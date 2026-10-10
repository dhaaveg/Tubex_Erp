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
 * PUT /api/admin/lov/[id]
 * Admin endpoint to update an existing LOV item.
 * Strictly restricted to SUPER_ADMIN and ADMIN roles.
 */
export const PUT = withApiHandler(
  async (request: Request, { params }: { params: { id: string } }) => {
    const { id } = params;
    const auth = await verifyLovMutationAuth(request);
    if (!auth.isAuthorized) {
      return handleUnauthorizedLovMutation(request, auth, id);
    }

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

    // Record successful update in AuditLog
    await logLovSuccessAudit('LOV_UPDATED', auth, updated.id, {
      category: updated.category,
      code: updated.code,
      label: updated.label,
      value: updated.value,
      sort_order: updated.sort_order,
      is_active: updated.is_active,
    });

    return NextResponse.json(updated);
  }
);

/**
 * PATCH /api/admin/lov/[id]
 * Partial update for LOV item (e.g. sort order or status toggle).
 */
export const PATCH = PUT;

/**
 * DELETE /api/admin/lov/[id]
 * Admin endpoint to delete an LOV item.
 * Protects is_system_default from deletion.
 * Strictly restricted to SUPER_ADMIN and ADMIN roles.
 */
export const DELETE = withApiHandler(
  async (request: Request, { params }: { params: { id: string } }) => {
    const { id } = params;
    const auth = await verifyLovMutationAuth(request);
    if (!auth.isAuthorized) {
      return handleUnauthorizedLovMutation(request, auth, id);
    }

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

    // Record successful deletion in AuditLog
    await logLovSuccessAudit('LOV_DELETED', auth, existing.id, {
      category: existing.category,
      code: existing.code,
      label: existing.label,
      value: existing.value,
    });

    return NextResponse.json({
      success: true,
      message: `LOV item "${existing.label}" deleted successfully.`,
    });
  }
);
