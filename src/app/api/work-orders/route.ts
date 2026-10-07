import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WorkOrderSchema } from '@/lib/validations';
import { getCurrentSession } from '@/lib/auth';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const query = searchParams.get('q') || '';

    const where: any = {};
    if (status) where.wo_status = status;
    if (query) {
      where.OR = [
        { wo_id: { contains: query } },
        { ti_id: { contains: query } },
        { po_no: { contains: query } },
        { customer_po_no: { contains: query } },
        { machine_line_no: { contains: query } },
        { size: { contains: query } },
        { grade: { contains: query } },
        { thread: { contains: query } },
      ];
    }

    const workOrders = await prisma.workOrder.findMany({
      where,
      include: {
        target_product: true,
        customer_order: true,
        customer_po_line_item: true,
        purchase_order: {
          include: { supplier: true },
        },
        tally_item: {
          include: {
            tally_sheet: {
              include: {
                grn_item: {
                  include: {
                    grn: {
                      include: {
                        purchase_order: {
                          include: { supplier: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        production_postings: {
          include: {
            rejections: true,
          },
          orderBy: { operation_seq_no: 'asc' },
        },
        rejection_postings: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(workOrders);
  } catch (error: any) {
    console.error('Error fetching work orders:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const validated = WorkOrderSchema.parse(body);

    // Check if wo_id already exists
    const existing = await prisma.workOrder.findUnique({
      where: { wo_id: validated.wo_id },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Work Order '${validated.wo_id}' already exists.` },
        { status: 409 }
      );
    }

    // Resolve target product if not provided or to ensure valid foreign key
    let targetProductId = validated.target_product_id;
    if (!targetProductId) {
      // Find matching product by grade and thread
      if (validated.grade) {
        const matchingProduct = await prisma.product.findFirst({
          where: {
            grade: validated.grade,
            ...(validated.thread ? { thread_type: validated.thread } : {}),
          },
        });
        if (matchingProduct) {
          targetProductId = matchingProduct.product_id;
        }
      }
      // Fallback to first available product if none found
      if (!targetProductId) {
        const firstPrd = await prisma.product.findFirst();
        if (firstPrd) {
          targetProductId = firstPrd.product_id;
        } else {
          return NextResponse.json(
            { error: 'No products configured in the system. Create a product first.' },
            { status: 400 }
          );
        }
      }
    } else {
      // Verify product exists
      const prdExists = await prisma.product.findUnique({
        where: { product_id: targetProductId },
      });
      if (!prdExists) {
        const firstPrd = await prisma.product.findFirst();
        if (firstPrd) targetProductId = firstPrd.product_id;
      }
    }

    // Handle Tally Item allocation if ti_id provided or available
    let allocatedTiId: string | null = null;
    if (validated.ti_id) {
      const tallyItem = await prisma.tallyItem.findUnique({
        where: { ti_id: validated.ti_id },
      });
      if (tallyItem) {
        if (tallyItem.pipe_allocation_status === 'Available') {
          allocatedTiId = tallyItem.ti_id;
        } else {
          return NextResponse.json(
            {
              error: `Pipe ${validated.ti_id} is currently '${tallyItem.pipe_allocation_status}'. Only 'Available' pipes can be allocated.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Calculate planned parts to produce
    const plannedParts =
      validated.order_quantity ||
      validated.planned_parts_to_produce ||
      1;

    const workOrder = await prisma.workOrder.create({
      data: {
        wo_id: validated.wo_id,
        wo_date: new Date(validated.wo_date),
        source_type: validated.source_type || 'PO',
        po_no: validated.po_no || null,
        size: validated.size || null,
        grade: validated.grade || null,
        thread: validated.thread || null,
        order_quantity: validated.order_quantity || plannedParts,
        ti_id: allocatedTiId,
        target_product_id: targetProductId,
        planned_parts_to_produce: plannedParts,
        machine_line_no: validated.machine_line_no || 'CNC-CELL-01',
        shift: validated.shift || 'Shift A',
        wo_status: 'Released',
        customer_po_no: validated.customer_po_no || null,
        cpo_item_id: validated.cpo_item_id || null,
      },
      include: {
        target_product: true,
        customer_order: true,
        customer_po_line_item: true,
        purchase_order: {
          include: { supplier: true },
        },
        tally_item: true,
      },
    });

    // Update Pipe status to 'Allocated' if a pipe was allocated
    if (allocatedTiId) {
      await prisma.tallyItem.update({
        where: { ti_id: allocatedTiId },
        data: { pipe_allocation_status: 'Allocated' },
      });
    }

    // Audit Log WO_RELEASED
    const current = await getCurrentSession().catch(() => null);
    await prisma.auditLog.create({
      data: {
        user_id: current?.user?.id || null,
        action: 'WO_RELEASED',
        entity_type: 'WorkOrder',
        entity_id: workOrder.wo_id,
        details: JSON.stringify({
          wo_id: workOrder.wo_id,
          grade: workOrder.grade,
          size: workOrder.size,
          machine_line_no: workOrder.machine_line_no,
          planned_parts: workOrder.planned_parts_to_produce,
          shift: workOrder.shift,
        }),
      },
    }).catch(() => {});

    return NextResponse.json(workOrder, { status: 201 });
  } catch (error: any) {
    console.error('Error creating work order:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
});

export const PUT = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const validated = WorkOrderSchema.parse(body);

    const existing = await prisma.workOrder.findUnique({
      where: { wo_id: validated.wo_id },
      include: {
        tally_item: true,
        production_postings: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `Work Order '${validated.wo_id}' not found.` },
        { status: 404 }
      );
    }

    // Resolve target product if not provided or to ensure valid foreign key
    let targetProductId = validated.target_product_id || existing.target_product_id;
    if (validated.grade) {
      const matchingProduct = await prisma.product.findFirst({
        where: {
          grade: validated.grade,
          ...(validated.thread ? { thread_type: validated.thread } : {}),
        },
      });
      if (matchingProduct) {
        targetProductId = matchingProduct.product_id;
      }
    }

    // Handle Tally Item allocation if changed
    const newTiId: string | null = validated.ti_id !== undefined ? (validated.ti_id || null) : existing.ti_id;
    const oldTiId = existing.ti_id;

    if (newTiId && newTiId !== oldTiId) {
      const newTallyItem = await prisma.tallyItem.findUnique({
        where: { ti_id: newTiId },
      });
      if (!newTallyItem) {
        return NextResponse.json(
          { error: `Pipe '${newTiId}' not found.` },
          { status: 404 }
        );
      }
      if (newTallyItem.pipe_allocation_status !== 'Available') {
        return NextResponse.json(
          {
            error: `Pipe ${newTiId} is currently '${newTallyItem.pipe_allocation_status}'. Only 'Available' pipes can be allocated.`,
          },
          { status: 400 }
        );
      }
    }

    const plannedParts =
      validated.order_quantity ||
      validated.planned_parts_to_produce ||
      existing.planned_parts_to_produce ||
      1;

    const updatedWorkOrder = await prisma.workOrder.update({
      where: { wo_id: validated.wo_id },
      data: {
        wo_date: new Date(validated.wo_date),
        source_type: validated.source_type || existing.source_type,
        po_no: validated.source_type === 'Stock' ? null : (validated.po_no || existing.po_no),
        size: validated.size || null,
        grade: validated.grade || null,
        thread: validated.thread || null,
        order_quantity: validated.order_quantity || plannedParts,
        planned_parts_to_produce: plannedParts,
        ti_id: newTiId,
        target_product_id: targetProductId,
        machine_line_no: validated.machine_line_no || existing.machine_line_no,
        shift: validated.shift || existing.shift,
        wo_status: validated.wo_status || existing.wo_status,
        customer_po_no: validated.customer_po_no || null,
        cpo_item_id: validated.cpo_item_id || null,
      },
      include: {
        target_product: true,
        customer_order: true,
        customer_po_line_item: true,
        purchase_order: {
          include: { supplier: true },
        },
        tally_item: true,
        production_postings: {
          include: {
            rejections: true,
          },
          orderBy: { operation_seq_no: 'asc' },
        },
        rejection_postings: true,
      },
    });

    // Update Pipe allocations if changed
    if (newTiId !== oldTiId) {
      if (oldTiId) {
        await prisma.tallyItem.update({
          where: { ti_id: oldTiId },
          data: { pipe_allocation_status: 'Available' },
        }).catch((e) => console.warn('Could not reset old pipe allocation:', e));
      }
      if (newTiId) {
        await prisma.tallyItem.update({
          where: { ti_id: newTiId },
          data: { pipe_allocation_status: 'Allocated' },
        }).catch((e) => console.warn('Could not allocate new pipe:', e));
      }
    }

    return NextResponse.json(updatedWorkOrder);
  } catch (error: any) {
    console.error('Error updating work order:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
});

export const DELETE = withApiHandler(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    let woId = searchParams.get('wo_id');

    if (!woId) {
      const body = await request.json().catch(() => ({}));
      woId = body.wo_id;
    }

    if (!woId) {
      return NextResponse.json(
        { success: false, error: 'Work Order ID (wo_id) is required.' },
        { status: 400 }
      );
    }

    const existing = await prisma.workOrder.findUnique({
      where: { wo_id: woId },
      include: {
        tally_item: true,
        production_postings: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Work Order '${woId}' not found.` },
        { status: 404 }
      );
    }

    // If an allocated pipe exists, free it back to Available
    if (existing.ti_id) {
      await prisma.tallyItem.update({
        where: { ti_id: existing.ti_id },
        data: { pipe_allocation_status: 'Available' },
      }).catch((e) => console.warn('Could not reset pipe allocation status:', e));
    }

    // Delete the work order (cascades to production_postings & rejection_postings)
    await prisma.workOrder.delete({
      where: { wo_id: woId },
    });

    return NextResponse.json({
      success: true,
      message: `Work Order '${woId}' deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Error deleting work order:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
