import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { TallySheetSchema } from '@/lib/validations';
import { calculateCuttingYield } from '@/lib/calculations';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const heatNo = searchParams.get('heat_no') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};
    if (heatNo) {
      where.OR = [
        { heat_no: { contains: heatNo } },
        { tally_items: { some: { heat_no: { contains: heatNo } } } },
      ];
    }

    const tallySheets = await prisma.tallySheet.findMany({
      where,
      include: {
        grn_item: {
          include: {
            product: true,
            po_item: true,
            grn: {
              include: {
                purchase_order: {
                  include: {
                    supplier: true,
                    po_items: true,
                  },
                },
              },
            },
          },
        },
        tally_items: status
          ? { where: { pipe_allocation_status: status } }
          : true,
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(tallySheets);
  } catch (error: any) {
    console.error('Error fetching tally sheets:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error fetching tally sheets' }, { status: 500 });
  }
});

export const POST = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const validated = TallySheetSchema.parse(body);

    // Compute cutting yield math for each lot item
    const computedItems = validated.tally_items.map((item, idx) => {
      const yieldCalc = calculateCuttingYield(item.tube_length_mm, item.parting_length_mm);
      return {
        ti_id: item.ti_id,
        tube_sr_no: item.tube_sr_no || idx + 1,
        heat_no: item.heat_no || validated.heat_no || null,
        lot_no: item.lot_no || validated.lot_no || null,
        mill_test_certificate_no: item.mill_test_certificate_no || validated.mill_test_certificate_no || null,
        tube_count: item.tube_count ?? 1,
        tube_length_mm: item.tube_length_mm,
        parting_length_mm: item.parting_length_mm,
        expected_qty: yieldCalc.expectedQty,
        rounded_qty: yieldCalc.roundedQty,
        end_scrap_mm: yieldCalc.endScrapMm,
        pipe_allocation_status: 'Available',
      };
    });

    // Check if Tally Sheet ID already exists
    const existingTs = await prisma.tallySheet.findUnique({
      where: { ts_id: validated.ts_id },
    });
    if (existingTs) {
      return NextResponse.json(
        { success: false, error: `Duplicate Tally Sheet Error: Tally Sheet ID "${validated.ts_id}" already exists. Please specify a unique Tally Sheet ID.` },
        { status: 400 }
      );
    }

    // Check for internal duplicates within the submitted lots list
    const seenTiIds = new Set<string>();
    for (const item of computedItems) {
      const upper = item.ti_id.trim().toUpperCase();
      if (seenTiIds.has(upper)) {
        return NextResponse.json(
          { success: false, error: `Duplicate Barcode in Form: Lot Tag / Barcode "${item.ti_id}" appears more than once in this Tally Sheet. Every lot must have a unique barcode.` },
          { status: 400 }
        );
      }
      seenTiIds.add(upper);
    }

    // Check if any lot barcode already exists in the database
    const incomingTiIds = computedItems.map((item) => item.ti_id);
    const existingTiCollisions = await prisma.tallyItem.findMany({
      where: {
        ti_id: { in: incomingTiIds },
      },
      select: {
        ti_id: true,
        ts_id: true,
      },
    });

    if (existingTiCollisions.length > 0) {
      const dup = existingTiCollisions[0];
      return NextResponse.json(
        {
          success: false,
          error: `Duplicate Barcode Error: Lot Tag / Barcode "${dup.ti_id}" already exists in Tally Sheet "${dup.ts_id}". Every lot must have a unique Lot Tag Barcode.`,
        },
        { status: 400 }
      );
    }

    // Verify GRN item exists
    const grnItem = await prisma.gRNItem.findUnique({
      where: { grn_item_id: validated.grn_item_id },
    });

    if (!grnItem) {
      return NextResponse.json({ success: false, error: `GRN Item ${validated.grn_item_id} not found` }, { status: 404 });
    }

    const firstHeat = computedItems[0]?.heat_no || null;
    const firstLot = computedItems[0]?.lot_no || null;
    const firstMtc = computedItems[0]?.mill_test_certificate_no || null;

    // Create tally sheet and items
    const tallySheet = await prisma.tallySheet.create({
      data: {
        ts_id: validated.ts_id,
        grn_item_id: validated.grn_item_id,
        lot_no: validated.lot_no || firstLot,
        heat_no: validated.heat_no || firstHeat,
        mill_test_certificate_no: validated.mill_test_certificate_no || firstMtc,
        tally_sheet_date: new Date(validated.tally_sheet_date),
        inspector_name: validated.inspector_name,
        bundle_count: validated.bundle_count || 1,
        tally_items: {
          create: computedItems,
        },
      },
      include: {
        grn_item: {
          include: {
            product: true,
            po_item: true,
            grn: {
              include: {
                purchase_order: {
                  include: {
                    supplier: true,
                    po_items: true,
                  },
                },
              },
            },
          },
        },
        tally_items: true,
      },
    });

    // Update parent GRN's total_tubes_tally and tally_match_status
    const grnId = tallySheet.grn_item.grn_id;
    const allTallyItemsForGrn = await prisma.tallyItem.findMany({
      where: {
        tally_sheet: {
          grn_item: {
            grn_id: grnId,
          },
        },
      },
      select: {
        tube_count: true,
      },
    });
    const allTubesCount = allTallyItemsForGrn.reduce((acc, ti) => acc + (ti.tube_count ?? 1), 0);

    const parentGrn = await prisma.gRN.findUnique({
      where: { grn_id: grnId },
    });

    if (parentGrn) {
      const isMatched = parentGrn.total_tubes_received_actual === allTubesCount;
      await prisma.gRN.update({
        where: { grn_id: grnId },
        data: {
          total_tubes_tally: allTubesCount,
          tally_match_status: isMatched ? 'Matched' : 'Mismatch',
        },
      });
    }

    return NextResponse.json(tallySheet, { status: 201 });
  } catch (error: any) {
    console.error('Error creating tally sheet:', error);
    let errorMsg = error.message || 'Validation error';
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : error.meta?.target || 'field';
      errorMsg = `Duplicate Entry Error: A record with this unique identifier (${target}) already exists in the database. Every lot barcode must be unique.`;
    }
    return NextResponse.json(
      { success: false, error: errorMsg, details: error.errors },
      { status: 400 }
    );
  }
});

export const PUT = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const validated = TallySheetSchema.parse(body);

    const existingSheet = await prisma.tallySheet.findUnique({
      where: { ts_id: validated.ts_id },
      include: { tally_items: true },
    });

    if (!existingSheet) {
      return NextResponse.json({ success: false, error: `Tally Sheet ${validated.ts_id} not found` }, { status: 404 });
    }

    // Compute cutting yield math for each lot item
    const computedItems = validated.tally_items.map((item, idx) => {
      const yieldCalc = calculateCuttingYield(item.tube_length_mm, item.parting_length_mm);
      const existingItem = existingSheet.tally_items.find((ti) => ti.ti_id === item.ti_id);
      return {
        ti_id: item.ti_id,
        tube_sr_no: item.tube_sr_no || idx + 1,
        heat_no: item.heat_no || validated.heat_no || null,
        lot_no: item.lot_no || validated.lot_no || null,
        mill_test_certificate_no: item.mill_test_certificate_no || validated.mill_test_certificate_no || null,
        tube_count: item.tube_count ?? 1,
        tube_length_mm: item.tube_length_mm,
        parting_length_mm: item.parting_length_mm,
        expected_qty: yieldCalc.expectedQty,
        rounded_qty: yieldCalc.roundedQty,
        end_scrap_mm: yieldCalc.endScrapMm,
        pipe_allocation_status: existingItem?.pipe_allocation_status || 'Available',
      };
    });

    // Check for internal duplicates within the submitted lots list
    const seenTiIds = new Set<string>();
    for (const item of computedItems) {
      const upper = item.ti_id.trim().toUpperCase();
      if (seenTiIds.has(upper)) {
        return NextResponse.json(
          { success: false, error: `Duplicate Barcode in Form: Lot Tag / Barcode "${item.ti_id}" appears more than once in this Tally Sheet. Every lot must have a unique barcode.` },
          { status: 400 }
        );
      }
      seenTiIds.add(upper);
    }

    // Check if any incoming lot barcode is registered under a DIFFERENT tally sheet
    const incomingTiIds = computedItems.map((ci) => ci.ti_id);
    const otherSheetCollisions = await prisma.tallyItem.findMany({
      where: {
        ti_id: { in: incomingTiIds },
        ts_id: { not: validated.ts_id },
      },
      select: {
        ti_id: true,
        ts_id: true,
      },
    });

    if (otherSheetCollisions.length > 0) {
      const dup = otherSheetCollisions[0];
      return NextResponse.json(
        {
          success: false,
          error: `Duplicate Barcode Error: Lot Tag / Barcode "${dup.ti_id}" is already registered under Tally Sheet "${dup.ts_id}". Every lot must have a unique Lot Tag Barcode.`,
        },
        { status: 400 }
      );
    }

    // Verify GRN item exists
    const grnItem = await prisma.gRNItem.findUnique({
      where: { grn_item_id: validated.grn_item_id },
    });

    if (!grnItem) {
      return NextResponse.json({ success: false, error: `GRN Item ${validated.grn_item_id} not found` }, { status: 404 });
    }

    const firstHeat = computedItems[0]?.heat_no || null;
    const firstLot = computedItems[0]?.lot_no || null;
    const firstMtc = computedItems[0]?.mill_test_certificate_no || null;

    // Safely update Tally Sheet and upsert/prune items
    const updatedTallySheet = await prisma.$transaction(async (tx) => {
      // 1. Update header
      await tx.tallySheet.update({
        where: { ts_id: validated.ts_id },
        data: {
          grn_item_id: validated.grn_item_id,
          lot_no: validated.lot_no || firstLot,
          heat_no: validated.heat_no || firstHeat,
          mill_test_certificate_no: validated.mill_test_certificate_no || firstMtc,
          tally_sheet_date: new Date(validated.tally_sheet_date),
          inspector_name: validated.inspector_name,
          bundle_count: validated.bundle_count || 1,
        },
      });

      // 2. Identify items to remove
      const incomingTiIds = computedItems.map((ci) => ci.ti_id);
      for (const existing of existingSheet.tally_items) {
        if (!incomingTiIds.includes(existing.ti_id)) {
          const woCount = await tx.workOrder.count({
            where: { ti_id: existing.ti_id },
          });
          if (woCount > 0) {
            throw new Error(`Cannot remove lot tag ${existing.ti_id} because it is referenced in Shop Work Orders.`);
          }
          await tx.tallyItem.delete({
            where: { ti_id: existing.ti_id },
          });
        }
      }

      // 3. Upsert each item
      for (const item of computedItems) {
        await tx.tallyItem.upsert({
          where: { ti_id: item.ti_id },
          create: {
            ti_id: item.ti_id,
            ts_id: validated.ts_id,
            tube_sr_no: item.tube_sr_no,
            heat_no: item.heat_no,
            lot_no: item.lot_no,
            mill_test_certificate_no: item.mill_test_certificate_no,
            tube_count: item.tube_count,
            tube_length_mm: item.tube_length_mm,
            parting_length_mm: item.parting_length_mm,
            expected_qty: item.expected_qty,
            rounded_qty: item.rounded_qty,
            end_scrap_mm: item.end_scrap_mm,
            pipe_allocation_status: item.pipe_allocation_status,
          },
          update: {
            tube_sr_no: item.tube_sr_no,
            heat_no: item.heat_no,
            lot_no: item.lot_no,
            mill_test_certificate_no: item.mill_test_certificate_no,
            tube_count: item.tube_count,
            tube_length_mm: item.tube_length_mm,
            parting_length_mm: item.parting_length_mm,
            expected_qty: item.expected_qty,
            rounded_qty: item.rounded_qty,
            end_scrap_mm: item.end_scrap_mm,
          },
        });
      }

      return await tx.tallySheet.findUnique({
        where: { ts_id: validated.ts_id },
        include: {
          grn_item: {
            include: {
              grn: {
                include: {
                  purchase_order: {
                    include: { supplier: true, po_items: true },
                  },
                },
              },
              product: true,
              po_item: true,
            },
          },
          tally_items: true,
        },
      });
    });

    // Update parent GRN's total_tubes_tally and tally_match_status
    if (updatedTallySheet) {
      const grnId = updatedTallySheet.grn_item.grn_id;
      const allTallyItemsForGrn = await prisma.tallyItem.findMany({
        where: {
          tally_sheet: {
            grn_item: {
              grn_id: grnId,
            },
          },
        },
        select: {
          tube_count: true,
        },
      });
      const allTubesCount = allTallyItemsForGrn.reduce((acc, ti) => acc + (ti.tube_count ?? 1), 0);

      const parentGrn = await prisma.gRN.findUnique({
        where: { grn_id: grnId },
      });

      if (parentGrn) {
        const isMatched = parentGrn.total_tubes_received_actual === allTubesCount;
        await prisma.gRN.update({
          where: { grn_id: grnId },
          data: {
            total_tubes_tally: allTubesCount,
            tally_match_status: isMatched ? 'Matched' : 'Mismatch',
          },
        });
      }
    }

    return NextResponse.json(updatedTallySheet);
  } catch (error: any) {
    console.error('Error updating tally sheet:', error);
    let errorMsg = error.message || 'Validation error';
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : error.meta?.target || 'field';
      errorMsg = `Duplicate Entry Error: A record with this unique identifier (${target}) already exists in the database. Every lot barcode must be unique.`;
    }
    return NextResponse.json(
      { success: false, error: errorMsg, details: error.errors },
      { status: 400 }
    );
  }
});

export const DELETE = withApiHandler(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const tsId = searchParams.get('ts_id');

    if (!tsId) {
      return NextResponse.json({ success: false, error: 'Tally Sheet ID (ts_id) is required' }, { status: 400 });
    }

    const ts = await prisma.tallySheet.findUnique({
      where: { ts_id: tsId },
      include: {
        grn_item: true,
        tally_items: {
          include: {
            work_orders: true,
          },
        },
      },
    });

    if (!ts) {
      return NextResponse.json({ success: false, error: `Tally Sheet ${tsId} not found` }, { status: 404 });
    }

    // Check if any lots have work orders
    const lotsWithWos = ts.tally_items.filter((ti) => ti.work_orders.length > 0);
    if (lotsWithWos.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete Tally Sheet ${tsId} because ${lotsWithWos.length} lot(s) (${lotsWithWos.map((p) => p.ti_id).join(', ')}) have active Shop Work Orders.`,
        },
        { status: 400 }
      );
    }

    const grnId = ts.grn_item.grn_id;

    await prisma.tallySheet.delete({
      where: { ts_id: tsId },
    });

    // Update parent GRN's total_tubes_tally and tally_match_status
    const allTallyItemsForGrn = await prisma.tallyItem.findMany({
      where: {
        tally_sheet: {
          grn_item: {
            grn_id: grnId,
          },
        },
      },
      select: {
        tube_count: true,
      },
    });
    const allTubesCount = allTallyItemsForGrn.reduce((acc, ti) => acc + (ti.tube_count ?? 1), 0);

    const parentGrn = await prisma.gRN.findUnique({
      where: { grn_id: grnId },
    });

    if (parentGrn) {
      const isMatched = parentGrn.total_tubes_received_actual === allTubesCount;
      await prisma.gRN.update({
        where: { grn_id: grnId },
        data: {
          total_tubes_tally: allTubesCount,
          tally_match_status: isMatched ? 'Matched' : 'Mismatch',
        },
      });
    }

    return NextResponse.json({ success: true, message: `Tally Sheet ${tsId} deleted successfully` });
  } catch (error: any) {
    console.error('Error deleting tally sheet:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error deleting tally sheet' }, { status: 500 });
  }
});
