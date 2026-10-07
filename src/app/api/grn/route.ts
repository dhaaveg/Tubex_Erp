import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { GRNSchema } from '@/lib/validations';
import { calculateWeighbridge, validatePoGrnWeightLimit } from '@/lib/calculations';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    const where: any = {};
    if (query) {
      where.OR = [
        { grn_id: { contains: query } },
        { po_no: { contains: query } },
        { invoice_no: { contains: query } },
        { vehicle_transporter_no: { contains: query } },
      ];
    }

    const grns = await prisma.gRN.findMany({
      where,
      include: {
        purchase_order: {
          include: {
            supplier: true,
            po_items: true,
          },
        },
        grn_items: {
          include: {
            product: true,
            po_item: true,
            tally_sheets: {
              include: {
                tally_items: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(grns);
  } catch (error: any) {
    console.error('Error fetching GRNs:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error fetching GRNs' }, { status: 500 });
  }
});

async function validateGrnLineItemQuantities(
  poNo: string,
  grnId: string,
  resolvedItems: Array<{ po_item_id: string; invoice_quantity_mt: number; [key: string]: any }>,
  purchaseOrder: { po_no: string; po_items: Array<{ po_item_id: string; ordered_qty_mt: number }> }
) {
  const existingGrnItems = await prisma.gRNItem.findMany({
    where: {
      grn: {
        po_no: poNo,
        grn_id: { not: grnId },
      },
    },
  });

  const poTotalOrderedMt = Number(
    purchaseOrder.po_items.reduce((sum, item) => sum + (Number(item.ordered_qty_mt) || 0), 0).toFixed(4)
  );

  // Rule 1: Sum of ALL "Qty as per invoice (MT)" associated with the same PO <= PO's Total "Ordered MT"
  const totalExistingInvoiceMt = Number(
    existingGrnItems.reduce((sum, gi) => sum + (Number(gi.invoice_quantity_mt) || 0), 0).toFixed(4)
  );
  const totalThisGrnInvoiceMt = Number(
    resolvedItems.reduce((sum, ri) => sum + (Number(ri.invoice_quantity_mt) || 0), 0).toFixed(4)
  );
  const totalCumulativeInvoiceMt = Number((totalExistingInvoiceMt + totalThisGrnInvoiceMt).toFixed(4));
  const totalRemainingAllowableMt = Math.max(0, Number((poTotalOrderedMt - totalExistingInvoiceMt).toFixed(4)));

  if (totalCumulativeInvoiceMt > poTotalOrderedMt + 0.0001) {
    return {
      isValid: false,
      error: `Validation Error: Sum of all "Qty as per invoice (MT)" (${totalCumulativeInvoiceMt.toFixed(3)} MT) associated with PO ${poNo} exceeds PO's Total Ordered MT (${poTotalOrderedMt.toFixed(3)} MT). Already received in earlier GRNs: ${totalExistingInvoiceMt.toFixed(3)} MT. This GRN items total: ${totalThisGrnInvoiceMt.toFixed(3)} MT. Maximum allowable remaining is ${totalRemainingAllowableMt.toFixed(3)} MT.`,
      po_no: poNo,
      total_ordered_mt: poTotalOrderedMt,
      existing_invoice_mt: totalExistingInvoiceMt,
      this_grn_invoice_mt: totalThisGrnInvoiceMt,
      remaining_allowable_mt: totalRemainingAllowableMt,
    };
  }

  for (let i = 0; i < resolvedItems.length; i++) {
    const item = resolvedItems[i];
    const matchedPoi =
      purchaseOrder.po_items.find((poi) => poi.po_item_id === item.po_item_id) ||
      purchaseOrder.po_items[0];

    if (matchedPoi) {
      const poOrderedMt = Number(matchedPoi.ordered_qty_mt);

      // Rule 1: Individual line item Qty as per invoice (MT) cannot exceed PO Ordered MT
      if (item.invoice_quantity_mt > poOrderedMt + 0.0001) {
        return {
          isValid: false,
          error: `Validation Error: "Qty as per invoice (MT)" (${item.invoice_quantity_mt.toFixed(3)} MT) cannot be more than the PO's Ordered MT (${poOrderedMt.toFixed(3)} MT) for Line Item #${i + 1} (${matchedPoi.po_item_id}).`,
          po_item_id: matchedPoi.po_item_id,
          ordered_qty_mt: poOrderedMt,
          invoice_quantity_mt: item.invoice_quantity_mt,
        };
      }

      // Rule 2: Cumulative Qty as per invoice (MT) across all GRNs for this PO item cannot exceed PO Ordered MT
      const prevReceivedMt = existingGrnItems
        .filter((gi) => gi.po_item_id === matchedPoi.po_item_id)
        .reduce((sum, gi) => sum + (Number(gi.invoice_quantity_mt) || 0), 0);

      const thisGrnMtForPoi = resolvedItems
        .filter((ri) => ri.po_item_id === matchedPoi.po_item_id)
        .reduce((sum, ri) => sum + (Number(ri.invoice_quantity_mt) || 0), 0);

      const newCumulativePoiMt = prevReceivedMt + thisGrnMtForPoi;
      const remainingAllowableMt = Math.max(0, poOrderedMt - prevReceivedMt);

      if (newCumulativePoiMt > poOrderedMt + 0.0001) {
        return {
          isValid: false,
          error: `Validation Error: Cumulative "Qty as per invoice (MT)" (${newCumulativePoiMt.toFixed(3)} MT) exceeds PO ${poNo}'s Ordered MT (${poOrderedMt.toFixed(3)} MT) for item #${i + 1} (${matchedPoi.po_item_id}). Already received in earlier GRNs: ${prevReceivedMt.toFixed(3)} MT. Maximum allowable remaining is ${remainingAllowableMt.toFixed(3)} MT.`,
          po_item_id: matchedPoi.po_item_id,
          ordered_qty_mt: poOrderedMt,
          prev_received_mt: prevReceivedMt,
          this_grn_mt: thisGrnMtForPoi,
          remaining_allowable_mt: remainingAllowableMt,
        };
      }
    }
  }

  return { isValid: true };
}

function parsePipeSizeOd(sizeInput: string | number | null | undefined): number | null {
  if (sizeInput === null || sizeInput === undefined) return null;
  if (typeof sizeInput === 'number') {
    if (isNaN(sizeInput) || sizeInput <= 0) return null;
    return sizeInput <= 30 ? Number((sizeInput * 25.4).toFixed(2)) : sizeInput;
  }

  const str = String(sizeInput).trim();
  if (!str) return null;

  // 1. Explicit mm in string e.g. '177.8mm', '(177.8mm)', '177.8 mm OD'
  const mmMatch = str.match(/(?:^|[^\d.])([0-9]+(?:\.[0-9]+)?)\s*mm/i);
  if (mmMatch) {
    const val = parseFloat(mmMatch[1]);
    if (!isNaN(val) && val > 0) return Number(val.toFixed(2));
  }

  // 2. Fractional inches e.g. 9-5/8", 2-3/8", 3 1/2", 4-1/2
  const fractionMatch = str.match(/(\d+)\s*[- ]\s*(\d+)\/(\d+)/);
  if (fractionMatch) {
    const whole = parseInt(fractionMatch[1], 10);
    const num = parseInt(fractionMatch[2], 10);
    const den = parseInt(fractionMatch[3], 10);
    if (den > 0) {
      const inches = whole + (num / den);
      return Number((inches * 25.4).toFixed(2));
    }
  }

  // 3. Simple fraction e.g. 1/2", 3/4"
  const simpleFrac = str.match(/(\d+)\/(\d+)/);
  if (simpleFrac) {
    const num = parseInt(simpleFrac[1], 10);
    const den = parseInt(simpleFrac[2], 10);
    if (den > 0) {
      return Number(((num / den) * 25.4).toFixed(2));
    }
  }

  // 4. Decimal or integer number e.g. '7"', '7', '177.8', '114.3'
  const numMatch = str.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    if (!isNaN(val) && val > 0) {
      const hasInchMark = /["']|inch/i.test(str);
      if (hasInchMark || val <= 30) {
        return Number((val * 25.4).toFixed(2));
      }
      return Number(val.toFixed(2));
    }
  }

  return null;
}

async function resolveOrCreateProduct(item: {
  product_id?: string | null;
  size?: string | number | null;
  grade?: string | null;
  thread?: string | null;
}): Promise<string> {
  const parsedOd = parsePipeSizeOd(item.size);
  const grade = item.grade ? item.grade.trim() : null;
  const rawThread = item.thread ? item.thread.trim() : null;
  const thread = rawThread === 'Premium' ? 'EUE' : rawThread;

  // 1. If product_id is provided, verify whether it matches the requested specs
  if (item.product_id) {
    const existingProduct = await prisma.product.findUnique({
      where: { product_id: item.product_id },
    });

    if (existingProduct) {
      const odMatches = !parsedOd || Math.abs(existingProduct.size_od - parsedOd) <= 2.0;
      const gradeMatches = !grade || existingProduct.grade.toLowerCase() === grade.toLowerCase();

      const prdThreadNorm = existingProduct.thread_type === 'Premium' ? 'EUE' : existingProduct.thread_type;
      const reqThreadNorm = thread === 'Premium' ? 'EUE' : thread;
      const threadMatches = !reqThreadNorm || prdThreadNorm.toLowerCase() === reqThreadNorm.toLowerCase();

      if (odMatches && gradeMatches && threadMatches) {
        return existingProduct.product_id;
      }
    }
  }

  // 2. Search catalog for a product matching (parsedOd, grade, thread)
  const threadConditions = (thread === 'EUE' || thread === 'Premium')
    ? [{ thread_type: 'EUE' }, { thread_type: 'Premium' }]
    : thread ? [{ thread_type: thread }] : [];

  const matchedProduct = await prisma.product.findFirst({
    where: {
      AND: [
        parsedOd ? { size_od: { gte: parsedOd - 2.0, lte: parsedOd + 2.0 } } : {},
        grade ? { grade: { equals: grade } } : {},
        threadConditions.length > 0 ? { OR: threadConditions } : {},
      ],
    },
  });

  if (matchedProduct) {
    return matchedProduct.product_id;
  }

  // 3. Auto-create new Product in catalog if no matching product exists
  const allProducts = await prisma.product.findMany({ select: { product_id: true } });
  let maxNum = 0;
  for (const p of allProducts) {
    const match = p.product_id.match(/PRD-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const newProductId = `PRD-${String(maxNum + 1).padStart(3, '0')}`;

  const finalOd = parsedOd || 177.8;
  const finalGrade = grade || 'L80';
  const finalThread = thread || 'BTC';
  const finalWt = Number((finalOd * 0.06).toFixed(2));
  const finalNominalWeight = Number(((finalOd - finalWt) * finalWt * 0.0246615).toFixed(2));

  const createdProduct = await prisma.product.create({
    data: {
      product_id: newProductId,
      product_description: `${finalOd}mm OD x ${finalWt}mm WT API 5CT ${finalGrade} ${finalThread}`,
      size_od: finalOd,
      wall_thickness: finalWt,
      grade: finalGrade,
      thread_type: finalThread,
      cvn_requirement: '27J Min Avg @ -10°C',
      nominal_weight_kg_m: finalNominalWeight > 0 ? finalNominalWeight : 40.0,
      uom: 'Meters',
    },
  });

  return createdProduct.product_id;
}

export const POST = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const validated = GRNSchema.parse(body);

    // Domain Gate: Validate that cumulative GRN Invoice MT for this PO <= PO Ordered MT sum
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { po_no: validated.po_no },
      include: {
        po_items: true,
        grns: true,
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ success: false, error: `Purchase Order ${validated.po_no} not found.` }, { status: 404 });
    }

    const poOrderedMtSum = Number(
      purchaseOrder.po_items.reduce((sum, item) => sum + (Number(item.ordered_qty_mt) || 0), 0).toFixed(4)
    );
    const existingGrnInvoiceMtSum = Number(
      purchaseOrder.grns
        .filter((g) => g.grn_id !== validated.grn_id)
        .reduce((sum, g) => sum + (Number(g.invoice_weight_mt) || 0), 0)
        .toFixed(4)
    );

    // Auto calculate "Invoice Weight (MT)" as sum of all "Qty as per invoice (MT)"
    // and "Actual Weighbridge (MT)" as sum of all "Actual Qty (MT)"
    const invoiceWeightMt = Number(
      validated.items.reduce((sum, item) => sum + (Number(item.invoice_quantity_mt) || 0), 0).toFixed(3)
    );
    const actualWeighbridgeWeightMt = Number(
      validated.items.reduce((sum, item) => sum + (Number(item.actual_quantity_mt) || 0), 0).toFixed(3)
    );

    const weightGate = validatePoGrnWeightLimit(
      poOrderedMtSum,
      existingGrnInvoiceMtSum,
      invoiceWeightMt
    );

    if (weightGate.isExceeded) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation Error: Cumulative GRN Invoice Weight (${weightGate.newCumulativeInvoiceMt.toFixed(3)} MT) exceeds PO ${validated.po_no}'s Total Ordered Weight (${poOrderedMtSum.toFixed(3)} MT). Already received in earlier GRNs: ${existingGrnInvoiceMtSum.toFixed(3)} MT. Maximum allowable remaining Invoice Weight is ${weightGate.remainingAllowableMt.toFixed(3)} MT.`,
          po_no: validated.po_no,
          po_ordered_mt_sum: weightGate.poOrderedMtSum,
          existing_grn_invoice_mt_sum: weightGate.existingGrnInvoiceMtSum,
          this_grn_invoice_mt: invoiceWeightMt,
          new_cumulative_invoice_mt: weightGate.newCumulativeInvoiceMt,
          remaining_allowable_mt: weightGate.remainingAllowableMt,
        },
        { status: 400 }
      );
    }

    const { weightDifferenceMt } = calculateWeighbridge(
      invoiceWeightMt,
      actualWeighbridgeWeightMt
    );

    const resolvedItems = await Promise.all(
      validated.items.map(async (item, index) => {
        const productId = await resolveOrCreateProduct(item);
        let poItemId = item.po_item_id;

        if (!poItemId) {
          const matchedPoi = purchaseOrder.po_items.find((p) => p.product_id === productId);
          poItemId = matchedPoi?.po_item_id || purchaseOrder.po_items[0]?.po_item_id || 'POI-001';
        }

        const grnItemId = item.grn_item_id || `GRNI-${validated.grn_id}-${String(index + 1).padStart(2, '0')}`;

        return {
          grn_item_id: grnItemId,
          po_item_id: poItemId,
          product_id: productId,
          invoice_quantity: item.invoice_quantity || 0,
          received_quantity: item.received_quantity !== undefined ? item.received_quantity : (item.invoice_quantity || 0),
          invoice_quantity_mt: item.invoice_quantity_mt || 0,
          actual_quantity_mt: item.actual_quantity_mt || 0,
          rejected_damaged_qty: item.rejected_damaged_qty || 0,
          item_inspection_status: item.item_inspection_status || 'Pending QA',
        };
      })
    );

    const lineItemGate = await validateGrnLineItemQuantities(
      validated.po_no,
      validated.grn_id,
      resolvedItems,
      purchaseOrder
    );

    if (!lineItemGate.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: lineItemGate.error,
          po_item_id: lineItemGate.po_item_id,
          ordered_qty_mt: lineItemGate.ordered_qty_mt,
          invoice_quantity_mt: lineItemGate.invoice_quantity_mt,
          remaining_allowable_mt: lineItemGate.remaining_allowable_mt,
        },
        { status: 400 }
      );
    }

    const grn = await prisma.gRN.create({
      data: {
        grn_id: validated.grn_id,
        grn_date: new Date(validated.grn_date),
        po_no: validated.po_no,
        invoice_no: validated.invoice_no,
        invoice_date: new Date(validated.invoice_date),
        vehicle_transporter_no: validated.vehicle_transporter_no,
        invoice_weight_mt: invoiceWeightMt,
        actual_weighbridge_weight_mt: actualWeighbridgeWeightMt,
        weight_difference_mt: weightDifferenceMt,
        total_tubes_received_actual: 0,
        total_tubes_tally: 0,
        tally_match_status: 'Matched',
        grn_items: {
          create: resolvedItems,
        },
      },
      include: {
        purchase_order: {
          include: { supplier: true },
        },
        grn_items: {
          include: { product: true },
        },
      },
    });

    return NextResponse.json(grn, { status: 201 });
  } catch (error: any) {
    console.error('Error creating GRN:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
});

export const PUT = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const validated = GRNSchema.parse(body);

    const existingGrn = await prisma.gRN.findUnique({
      where: { grn_id: validated.grn_id },
      include: {
        grn_items: {
          include: {
            tally_sheets: true,
          },
        },
      },
    });

    if (!existingGrn) {
      return NextResponse.json({ success: false, error: `GRN ${validated.grn_id} not found.` }, { status: 404 });
    }

    // Domain Gate: Cumulative GRN invoice MT <= PO Ordered MT sum
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { po_no: validated.po_no },
      include: {
        po_items: true,
        grns: true,
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ success: false, error: `Purchase Order ${validated.po_no} not found.` }, { status: 404 });
    }

    const poOrderedMtSum = Number(
      purchaseOrder.po_items.reduce((sum, item) => sum + (Number(item.ordered_qty_mt) || 0), 0).toFixed(4)
    );
    const existingGrnInvoiceMtSum = Number(
      purchaseOrder.grns
        .filter((g) => g.grn_id !== validated.grn_id)
        .reduce((sum, g) => sum + (Number(g.invoice_weight_mt) || 0), 0)
        .toFixed(4)
    );

    // Auto calculate "Invoice Weight (MT)" as sum of all "Qty as per invoice (MT)"
    // and "Actual Weighbridge (MT)" as sum of all "Actual Qty (MT)"
    const invoiceWeightMt = Number(
      validated.items.reduce((sum, item) => sum + (Number(item.invoice_quantity_mt) || 0), 0).toFixed(3)
    );
    const actualWeighbridgeWeightMt = Number(
      validated.items.reduce((sum, item) => sum + (Number(item.actual_quantity_mt) || 0), 0).toFixed(3)
    );

    const weightGate = validatePoGrnWeightLimit(
      poOrderedMtSum,
      existingGrnInvoiceMtSum,
      invoiceWeightMt
    );

    if (weightGate.isExceeded) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation Error: Cumulative GRN Invoice Weight (${weightGate.newCumulativeInvoiceMt.toFixed(3)} MT) exceeds PO ${validated.po_no}'s Total Ordered Weight (${poOrderedMtSum.toFixed(3)} MT). Already received in earlier GRNs: ${existingGrnInvoiceMtSum.toFixed(3)} MT. Maximum allowable remaining Invoice Weight is ${weightGate.remainingAllowableMt.toFixed(3)} MT.`,
          po_no: validated.po_no,
          po_ordered_mt_sum: weightGate.poOrderedMtSum,
          existing_grn_invoice_mt_sum: weightGate.existingGrnInvoiceMtSum,
          this_grn_invoice_mt: invoiceWeightMt,
          new_cumulative_invoice_mt: weightGate.newCumulativeInvoiceMt,
          remaining_allowable_mt: weightGate.remainingAllowableMt,
        },
        { status: 400 }
      );
    }

    const { weightDifferenceMt } = calculateWeighbridge(
      invoiceWeightMt,
      actualWeighbridgeWeightMt
    );

    // Resolve products & PO items for updated items
    const resolvedItems = await Promise.all(
      validated.items.map(async (item, index) => {
        const productId = await resolveOrCreateProduct(item);
        let poItemId = item.po_item_id;

        if (!poItemId) {
          const matchedPoi = purchaseOrder.po_items.find((p) => p.product_id === productId);
          poItemId = matchedPoi?.po_item_id || purchaseOrder.po_items[0]?.po_item_id || 'POI-001';
        }

        const existingGrnItem = item.grn_item_id
          ? existingGrn.grn_items.find((gi: any) => gi.grn_item_id === item.grn_item_id)
          : existingGrn.grn_items[index];
        const grnItemId = existingGrnItem?.grn_item_id || item.grn_item_id || `GRNI-${validated.grn_id}-${String(index + 1).padStart(2, '0')}`;

        return {
          grn_item_id: grnItemId,
          po_item_id: poItemId,
          product_id: productId,
          invoice_quantity: item.invoice_quantity || 0,
          received_quantity: item.received_quantity !== undefined ? item.received_quantity : (item.invoice_quantity || 0),
          invoice_quantity_mt: item.invoice_quantity_mt || 0,
          actual_quantity_mt: item.actual_quantity_mt || 0,
          rejected_damaged_qty: item.rejected_damaged_qty || 0,
          item_inspection_status: item.item_inspection_status || 'Pending QA',
        };
      })
    );

    // Line item quantity gate: "Qty as per invoice (MT)" <= PO Ordered MT
    const lineItemGate = await validateGrnLineItemQuantities(
      validated.po_no,
      validated.grn_id,
      resolvedItems,
      purchaseOrder
    );

    if (!lineItemGate.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: lineItemGate.error,
          po_item_id: lineItemGate.po_item_id,
          ordered_qty_mt: lineItemGate.ordered_qty_mt,
          invoice_quantity_mt: lineItemGate.invoice_quantity_mt,
          remaining_allowable_mt: lineItemGate.remaining_allowable_mt,
        },
        { status: 400 }
      );
    }

    // Update in transaction
    const updatedGrn = await prisma.$transaction(async (tx) => {
      // 1. Update GRN header
      await tx.gRN.update({
        where: { grn_id: validated.grn_id },
        data: {
          grn_date: new Date(validated.grn_date),
          po_no: validated.po_no,
          invoice_no: validated.invoice_no,
          invoice_date: new Date(validated.invoice_date),
          vehicle_transporter_no: validated.vehicle_transporter_no,
          invoice_weight_mt: invoiceWeightMt,
          actual_weighbridge_weight_mt: actualWeighbridgeWeightMt,
          weight_difference_mt: weightDifferenceMt,
          total_tubes_received_actual: 0,
        },
      });

      // 2. Upsert each resolved item
      for (const item of resolvedItems) {
        await tx.gRNItem.upsert({
          where: { grn_item_id: item.grn_item_id },
          create: {
            grn_item_id: item.grn_item_id,
            grn_id: validated.grn_id,
            po_item_id: item.po_item_id,
            product_id: item.product_id,
            invoice_quantity: item.invoice_quantity,
            received_quantity: item.received_quantity,
            invoice_quantity_mt: item.invoice_quantity_mt,
            actual_quantity_mt: item.actual_quantity_mt,
            rejected_damaged_qty: item.rejected_damaged_qty,
            item_inspection_status: item.item_inspection_status,
          },
          update: {
            po_item_id: item.po_item_id,
            product_id: item.product_id,
            invoice_quantity: item.invoice_quantity,
            received_quantity: item.received_quantity,
            invoice_quantity_mt: item.invoice_quantity_mt,
            actual_quantity_mt: item.actual_quantity_mt,
            rejected_damaged_qty: item.rejected_damaged_qty,
            item_inspection_status: item.item_inspection_status,
          },
        });
      }

      // 3. Remove any extra existing items if safe (not linked to work orders)
      const incomingIds = resolvedItems.map((ri) => ri.grn_item_id);
      for (const existingItem of existingGrn.grn_items) {
        if (!incomingIds.includes(existingItem.grn_item_id)) {
          const tsIds = (existingItem.tally_sheets || []).map((ts: any) => ts.ts_id);
          if (tsIds.length > 0) {
            const activeWorkOrders = await tx.workOrder.count({
              where: { tally_item: { ts_id: { in: tsIds } } },
            });
            if (activeWorkOrders > 0) {
              throw new Error(
                `Cannot remove line item ${existingItem.grn_item_id}: It has ${activeWorkOrders} pipe(s) linked to active Work Orders.`
              );
            }
            await tx.tallyItem.deleteMany({
              where: { ts_id: { in: tsIds } },
            });
            await tx.tallySheet.deleteMany({
              where: { ts_id: { in: tsIds } },
            });
          }
          await tx.gRNItem.delete({
            where: { grn_item_id: existingItem.grn_item_id },
          });
        }
      }

      return await tx.gRN.findUnique({
        where: { grn_id: validated.grn_id },
        include: {
          purchase_order: {
            include: { supplier: true },
          },
          grn_items: {
            include: { product: true },
          },
        },
      });
    });

    return NextResponse.json(updatedGrn);
  } catch (error: any) {
    console.error('Error updating GRN:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
});

export const DELETE = withApiHandler(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const grnId = searchParams.get('grn_id');
    const grnItemId = searchParams.get('grn_item_id');

    if (!grnId && !grnItemId) {
      return NextResponse.json(
        { success: false, error: 'Missing parameter: either grn_id or grn_item_id is required.' },
        { status: 400 }
      );
    }

    // Option 1: Delete an entire GRN
    if (grnId) {
      const grn = await prisma.gRN.findUnique({
        where: { grn_id: grnId },
        include: {
          grn_items: {
            include: {
              tally_sheets: {
                include: {
                  tally_items: {
                    include: {
                      work_orders: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!grn) {
        return NextResponse.json({ success: false, error: `GRN ${grnId} not found.` }, { status: 404 });
      }

      // Check if any pipes are locked by Work Orders or consumed
      const activeWorkOrders: string[] = [];
      for (const item of grn.grn_items) {
        for (const ts of item.tally_sheets) {
          for (const ti of ts.tally_items) {
            if (ti.work_orders && ti.work_orders.length > 0) {
              activeWorkOrders.push(...ti.work_orders.map((w: any) => w.wo_id));
            }
            if (ti.pipe_allocation_status === 'Allocated' || ti.pipe_allocation_status === 'Consumed') {
              activeWorkOrders.push(`${ti.ti_id} (${ti.pipe_allocation_status})`);
            }
          }
        }
      }

      if (activeWorkOrders.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot delete GRN ${grnId}: Contains pipes linked to Work Orders (${activeWorkOrders.slice(0, 5).join(', ')}${activeWorkOrders.length > 5 ? '...' : ''}). Please close or remove the Work Orders first.`,
          },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        const grnItemIds = grn.grn_items.map((gi) => gi.grn_item_id);
        const tallySheets = await tx.tallySheet.findMany({
          where: { grn_item_id: { in: grnItemIds } },
          select: { ts_id: true },
        });
        const tsIds = tallySheets.map((ts) => ts.ts_id);

        if (tsIds.length > 0) {
          await tx.tallyItem.deleteMany({
            where: { ts_id: { in: tsIds } },
          });
          await tx.tallySheet.deleteMany({
            where: { ts_id: { in: tsIds } },
          });
        }

        await tx.gRNItem.deleteMany({
          where: { grn_id: grnId },
        });

        await tx.gRN.delete({
          where: { grn_id: grnId },
        });
      });

      return NextResponse.json({
        success: true,
        message: `GRN ${grnId} and all associated items were successfully deleted.`,
        deleted_grn_id: grnId,
      });
    }

    // Option 2: Delete a single GRN line item
    if (grnItemId) {
      const grnItem = await prisma.gRNItem.findUnique({
        where: { grn_item_id: grnItemId },
        include: {
          grn: {
            include: {
              grn_items: true,
            },
          },
          tally_sheets: {
            include: {
              tally_items: {
                include: {
                  work_orders: true,
                },
              },
            },
          },
        },
      });

      if (!grnItem) {
        return NextResponse.json({ success: false, error: `GRN Item ${grnItemId} not found.` }, { status: 404 });
      }

      if (grnItem.grn.grn_items.length <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot delete GRN Item ${grnItemId}: It is the only line item for GRN ${grnItem.grn_id}. A GRN must have at least one line item. To remove this item, delete the GRN itself or add another line item first.`,
          },
          { status: 400 }
        );
      }

      const activeWorkOrders: string[] = [];
      for (const ts of grnItem.tally_sheets) {
        for (const ti of ts.tally_items) {
          if (ti.work_orders && ti.work_orders.length > 0) {
            activeWorkOrders.push(...ti.work_orders.map((w: any) => w.wo_id));
          }
          if (ti.pipe_allocation_status === 'Allocated' || ti.pipe_allocation_status === 'Consumed') {
            activeWorkOrders.push(`${ti.ti_id} (${ti.pipe_allocation_status})`);
          }
        }
      }

      if (activeWorkOrders.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot delete GRN Item ${grnItemId}: Contains pipes linked to Work Orders (${activeWorkOrders.slice(0, 5).join(', ')}${activeWorkOrders.length > 5 ? '...' : ''}).`,
          },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        const tsIds = grnItem.tally_sheets.map((ts) => ts.ts_id);
        if (tsIds.length > 0) {
          await tx.tallyItem.deleteMany({
            where: { ts_id: { in: tsIds } },
          });
          await tx.tallySheet.deleteMany({
            where: { ts_id: { in: tsIds } },
          });
        }
        await tx.gRNItem.delete({
          where: { grn_item_id: grnItemId },
        });

        // Auto-recalculate parent GRN's total_tubes_received_actual as sum of remaining line items
        const remainingItems = await tx.gRNItem.findMany({
          where: { grn_id: grnItem.grn_id },
          select: { invoice_quantity: true },
        });
        const updatedTubes = Math.round(
          remainingItems.reduce((s, it) => s + (Number(it.invoice_quantity) || 0), 0)
        );
        await tx.gRN.update({
          where: { grn_id: grnItem.grn_id },
          data: { total_tubes_received_actual: updatedTubes },
        });
      });

      return NextResponse.json({
        success: true,
        message: `GRN Item ${grnItemId} was successfully deleted.`,
        deleted_grn_item_id: grnItemId,
      });
    }
  } catch (error: any) {
    console.error('Error deleting GRN / GRN Item:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error during deletion' }, { status: 500 });
  }
});

