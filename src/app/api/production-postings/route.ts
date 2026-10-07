import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ProductionPostingSchema } from '@/lib/validations';
import { validateProductionBalance, validateWorkOrderStageQuantityLimit } from '@/lib/calculations';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const woId = searchParams.get('wo_id');
    const stage = searchParams.get('stage');

    const where: any = {};
    if (woId) where.wo_id = woId;
    if (stage) where.process_stage_name = stage;

    const postings = await prisma.productionPosting.findMany({
      where,
      include: {
        work_order: {
          include: {
            target_product: true,
            tally_item: true,
          },
        },
        rejections: true,
      },
      orderBy: { operation_seq_no: 'asc' },
    });

    return NextResponse.json(postings);
  } catch (error: any) {
    console.error('Error fetching production postings:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error fetching production postings' }, { status: 500 });
  }
});

export const POST = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const validated = ProductionPostingSchema.parse(body);

    // Business Logic Gate 1: Strict Production Quantity Balance Equation
    const balanceCheck = validateProductionBalance(
      validated.input_quantity,
      validated.accepted_quantity,
      validated.rejected_quantity,
      validated.rework_quantity
    );

    if (!balanceCheck.isBalanced) {
      return NextResponse.json(
        { success: false, error: balanceCheck.errorMessage },
        { status: 400 }
      );
    }

    // Business Logic Gate 2: If rejected > 0, rejection logs must match count
    if (validated.rejected_quantity > 0) {
      if (!validated.rejections || validated.rejections.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Rejected quantity is ${validated.rejected_quantity}, but no defect log entries were provided. At least one defect entry is mandatory.`,
          },
          { status: 400 }
        );
      }

      const totalDefects = validated.rejections.reduce(
        (sum, r) => sum + r.defect_quantity,
        0
      );

      if (totalDefects !== validated.rejected_quantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Defect quantity mismatch: Total logged defects (${totalDefects}) does not equal Rejected Quantity (${validated.rejected_quantity}).`,
          },
          { status: 400 }
        );
      }
    }

    // Business Logic Gate 3: Work Order Quantity to Produce Reconciliation Gate
    // Rule: sum of all (Accepted Qty + Rejected Qty) associated with same work order
    //       for this stage must NOT exceed "Quantity to Produce (User Entry)" of same work order
    const wo = await prisma.workOrder.findUnique({
      where: { wo_id: validated.wo_id },
      include: {
        production_postings: true,
      },
    });

    if (!wo) {
      return NextResponse.json(
        { success: false, error: `Work Order '${validated.wo_id}' not found.` },
        { status: 404 }
      );
    }

    const woTargetQty = wo.planned_parts_to_produce || wo.order_quantity || 0;
    if (woTargetQty > 0) {
      const stagePostings = wo.production_postings.filter(
        (p) => p.operation_seq_no === validated.operation_seq_no
      );
      const existingStageAcc = stagePostings.reduce((sum, p) => sum + p.accepted_quantity, 0);
      const existingStageRej = stagePostings.reduce((sum, p) => sum + p.rejected_quantity, 0);

      const stageLimitGate = validateWorkOrderStageQuantityLimit(
        woTargetQty,
        existingStageAcc,
        existingStageRej,
        validated.accepted_quantity,
        validated.rejected_quantity,
        validated.process_stage_name,
        validated.operation_seq_no
      );

      if (stageLimitGate.isExceeded) {
        return NextResponse.json(
          { success: false, error: stageLimitGate.errorMessage },
          { status: 400 }
        );
      }
    }

    // Ensure pp_id is collision-free
    let finalPpId = validated.pp_id;
    const existingPosting = await prisma.productionPosting.findUnique({
      where: { pp_id: finalPpId },
    });
    if (existingPosting) {
      finalPpId = `${validated.pp_id}-${Date.now().toString().slice(-4)}`;
    }

    // Create Production Posting and nested Rejection Postings
    const posting = await prisma.productionPosting.create({
      data: {
        pp_id: finalPpId,
        wo_id: validated.wo_id,
        process_stage_name: validated.process_stage_name,
        operation_seq_no: validated.operation_seq_no,
        operator_machine_id: validated.operator_machine_id,
        input_quantity: validated.input_quantity,
        accepted_quantity: validated.accepted_quantity,
        rejected_quantity: validated.rejected_quantity,
        rework_quantity: validated.rework_quantity,
        rejections: validated.rejections && validated.rejections.length > 0
          ? {
              create: validated.rejections.map((rej, index) => ({
                rp_id: `RP-${finalPpId}-${String(index + 1).padStart(2, '0')}`,
                wo_id: validated.wo_id,
                defect_category: rej.defect_category,
                defect_quantity: rej.defect_quantity,
                disposition_action: rej.disposition_action,
                inspector_remarks: rej.inspector_remarks || '',
              })),
            }
          : undefined,
      },
      include: {
        work_order: true,
        rejections: true,
      },
    });

    // Update Work Order status to 'In Progress' if 'Released'
    if (wo.wo_status === 'Released') {
      await prisma.workOrder.update({
        where: { wo_id: validated.wo_id },
        data: { wo_status: 'In Progress' },
      });
      // Mark pipe as 'Consumed' once cutting starts
      if (validated.process_stage_name === 'Cutting') {
        await prisma.tallyItem.update({
          where: { ti_id: wo.ti_id },
          data: { pipe_allocation_status: 'Consumed' },
        });
      }
    }

    // If final packing stage completed
    if (validated.process_stage_name === 'Packing') {
      await prisma.workOrder.update({
        where: { wo_id: validated.wo_id },
        data: { wo_status: 'Completed' },
      });
    }

    return NextResponse.json(posting, { status: 201 });
  } catch (error: any) {
    console.error('Error creating production posting:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
});

export const PUT = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const validated = ProductionPostingSchema.parse(body);

    // Business Logic Gate 1: Strict Production Quantity Balance Equation
    const balanceCheck = validateProductionBalance(
      validated.input_quantity,
      validated.accepted_quantity,
      validated.rejected_quantity,
      validated.rework_quantity
    );

    if (!balanceCheck.isBalanced) {
      return NextResponse.json(
        { success: false, error: balanceCheck.errorMessage },
        { status: 400 }
      );
    }

    // Business Logic Gate 2: If rejected > 0, rejection logs must match count
    if (validated.rejected_quantity > 0) {
      if (!validated.rejections || validated.rejections.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Rejected quantity is ${validated.rejected_quantity}, but no defect log entries were provided. At least one defect entry is mandatory.`,
          },
          { status: 400 }
        );
      }

      const totalDefects = validated.rejections.reduce(
        (sum, r) => sum + r.defect_quantity,
        0
      );

      if (totalDefects !== validated.rejected_quantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Defect quantity mismatch: Total logged defects (${totalDefects}) does not equal Rejected Quantity (${validated.rejected_quantity}).`,
          },
          { status: 400 }
        );
      }
    }

    // Verify existing posting
    const existingPosting = await prisma.productionPosting.findUnique({
      where: { pp_id: validated.pp_id },
      include: { rejections: true },
    });

    if (!existingPosting) {
      return NextResponse.json(
        { success: false, error: `Production Posting '${validated.pp_id}' not found.` },
        { status: 404 }
      );
    }

    // Business Logic Gate 3: Work Order Quantity to Produce Limit Gate
    const wo = await prisma.workOrder.findUnique({
      where: { wo_id: validated.wo_id },
      include: { production_postings: true },
    });

    if (wo) {
      const woTargetQty = wo.planned_parts_to_produce || wo.order_quantity || 0;
      if (woTargetQty > 0) {
        // Exclude current posting being edited from prior existing totals
        const otherStagePostings = wo.production_postings.filter(
          (p) => p.operation_seq_no === validated.operation_seq_no && p.pp_id !== validated.pp_id
        );
        const existingStageAcc = otherStagePostings.reduce((sum, p) => sum + p.accepted_quantity, 0);
        const existingStageRej = otherStagePostings.reduce((sum, p) => sum + p.rejected_quantity, 0);

        const stageLimitGate = validateWorkOrderStageQuantityLimit(
          woTargetQty,
          existingStageAcc,
          existingStageRej,
          validated.accepted_quantity,
          validated.rejected_quantity,
          validated.process_stage_name,
          validated.operation_seq_no
        );

        if (stageLimitGate.isExceeded) {
          return NextResponse.json(
            { success: false, error: stageLimitGate.errorMessage },
            { status: 400 }
          );
        }
      }
    }

    // Clean up previous rejection postings for this posting
    await prisma.rejectionPosting.deleteMany({
      where: { pp_id: validated.pp_id },
    });

    // Update posting and re-create rejections
    const updated = await prisma.productionPosting.update({
      where: { pp_id: validated.pp_id },
      data: {
        process_stage_name: validated.process_stage_name,
        operation_seq_no: validated.operation_seq_no,
        operator_machine_id: validated.operator_machine_id,
        input_quantity: validated.input_quantity,
        accepted_quantity: validated.accepted_quantity,
        rejected_quantity: validated.rejected_quantity,
        rework_quantity: validated.rework_quantity,
        rejections: validated.rejections && validated.rejections.length > 0
          ? {
              create: validated.rejections.map((rej, index) => ({
                rp_id: `RP-${validated.pp_id}-${String(index + 1).padStart(2, '0')}`,
                wo_id: validated.wo_id,
                defect_category: rej.defect_category,
                defect_quantity: rej.defect_quantity,
                disposition_action: rej.disposition_action,
                inspector_remarks: rej.inspector_remarks || '',
              })),
            }
          : undefined,
      },
      include: {
        work_order: true,
        rejections: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating production posting:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
});

export const DELETE = withApiHandler(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const ppId = searchParams.get('pp_id');

    if (!ppId) {
      return NextResponse.json({ success: false, error: 'Posting ID (pp_id) is required.' }, { status: 400 });
    }

    await prisma.rejectionPosting.deleteMany({ where: { pp_id: ppId } });
    await prisma.productionPosting.delete({ where: { pp_id: ppId } });

    return NextResponse.json({ success: true, message: `Production Posting '${ppId}' deleted successfully.` });
  } catch (error: any) {
    console.error('Error deleting production posting:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error deleting production posting' }, { status: 500 });
  }
});

