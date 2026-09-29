import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PurchaseOrderSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};
    if (query) {
      where.OR = [
        { po_no: { contains: query } },
        { supplier: { supplier_name: { contains: query } } },
      ];
    }
    if (status) {
      where.po_status = status;
    }

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        po_items: {
          include: {
            product: true,
          },
        },
        grns: {
          select: {
            grn_id: true,
            grn_date: true,
            tally_match_status: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(pos);
  } catch (error: any) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function resolveProductId(item: {
  product_id?: string;
  size_od?: number;
  wall_thickness?: number;
  grade?: string;
  thread_type?: string;
  cvn_requirement?: string;
}): Promise<string> {
  // 1. If explicit product_id provided, reuse it directly without discriminating on thread
  if (item.product_id) {
    const existing = await prisma.product.findUnique({
      where: { product_id: item.product_id },
    });
    if (existing) {
      return existing.product_id;
    }
  }

  // 2. Check if a product exists matching size_od, grade, and wall_thickness
  if (item.size_od && item.grade && item.wall_thickness) {
    // Prefer Plain End raw pipe if one already exists
    const matchedPlain = await prisma.product.findFirst({
      where: {
        size_od: Number(item.size_od),
        wall_thickness: Number(item.wall_thickness),
        grade: item.grade,
        thread_type: 'Plain End',
      },
    });
    if (matchedPlain) return matchedPlain.product_id;

    // Otherwise link to any existing catalog item matching size, WT, and grade
    const matchedAny = await prisma.product.findFirst({
      where: {
        size_od: Number(item.size_od),
        wall_thickness: Number(item.wall_thickness),
        grade: item.grade,
      },
    });
    if (matchedAny) return matchedAny.product_id;

    // 3. Auto-create a Plain End raw pipe catalog product for procurement
    const count = await prisma.product.count();
    const newId = `PRD-${String(count + 1).padStart(3, '0')}`;
    const nomWeight = Number(
      ((Number(item.size_od) - Number(item.wall_thickness)) * Number(item.wall_thickness) * 0.0246615).toFixed(2)
    );
    const desc = `${item.size_od}mm OD x ${item.wall_thickness}mm WT API 5CT ${item.grade} Plain End Pipe`;

    const created = await prisma.product.create({
      data: {
        product_id: newId,
        product_description: desc,
        size_od: Number(item.size_od),
        wall_thickness: Number(item.wall_thickness),
        grade: item.grade,
        thread_type: 'Plain End',
        cvn_requirement: item.cvn_requirement || '27J Min Avg @ -10°C',
        nominal_weight_kg_m: nomWeight > 0 ? nomWeight : 30.0,
        uom: 'Meters',
      },
    });
    return created.product_id;
  }

  const fallback = await prisma.product.findFirst();
  return fallback?.product_id || 'PRD-001';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = PurchaseOrderSchema.parse(body);

    // Calculate line totals and grand total
    let totalPOValue = 0;
    const itemsData = [];
    for (let index = 0; index < validated.items.length; index++) {
      const item = validated.items[index];
      const lineTotal = Number(((item.ordered_qty_mt || 0) * item.unit_rate).toFixed(2));
      totalPOValue += lineTotal;
      const productId = await resolveProductId(item);
      itemsData.push({
        po_item_id: item.po_item_id || `POI-${validated.po_no}-${String(index + 1).padStart(2, '0')}`,
        product_id: productId,
        ordered_qty: item.ordered_qty ?? 0,
        ordered_qty_mt: item.ordered_qty_mt,
        unit_rate: item.unit_rate,
        line_total: lineTotal,
        tolerable_variance_pct: item.tolerable_variance_pct ?? 5.0,
        line_status: 'Pending',
      });
    }

    const advance = Number(validated.advance_amount || 0);
    const remainingAmount = Number((totalPOValue - advance).toFixed(2));

    const po = await prisma.purchaseOrder.create({
      data: {
        po_no: validated.po_no,
        po_date: new Date(validated.po_date),
        supplier_id: validated.supplier_id,
        shipping_address: validated.shipping_address,
        delivery_date: new Date(validated.delivery_date),
        payment_terms: validated.payment_terms,
        delivery_terms: validated.delivery_terms || 'FOB Mill Yard',
        quality_stipulations: validated.quality_stipulations || null,
        advance_amount: advance,
        remaining_amount: remainingAmount,
        po_status: validated.po_status || 'Draft',
        po_items: {
          create: itemsData,
        },
      },
      include: {
        supplier: true,
        po_items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(po, { status: 201 });
  } catch (error: any) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json(
      { error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const validated = PurchaseOrderSchema.parse(body);

    const existingPo = await prisma.purchaseOrder.findUnique({
      where: { po_no: validated.po_no },
      include: { po_items: true, grns: true },
    });

    if (!existingPo) {
      return NextResponse.json({ error: `Purchase Order ${validated.po_no} not found` }, { status: 404 });
    }

    // Calculate line totals and grand total
    let totalPOValue = 0;
    const itemsData = [];
    for (let index = 0; index < validated.items.length; index++) {
      const item = validated.items[index];
      const lineTotal = Number(((item.ordered_qty_mt || 0) * item.unit_rate).toFixed(2));
      totalPOValue += lineTotal;
      const productId = await resolveProductId(item);
      itemsData.push({
        po_item_id: item.po_item_id || `POI-${validated.po_no}-${String(index + 1).padStart(2, '0')}`,
        product_id: productId,
        ordered_qty: item.ordered_qty ?? 0,
        ordered_qty_mt: item.ordered_qty_mt,
        unit_rate: item.unit_rate,
        line_total: lineTotal,
        tolerable_variance_pct: item.tolerable_variance_pct ?? 5.0,
      });
    }

    const advance = Number(validated.advance_amount || 0);
    const remainingAmount = Number((totalPOValue - advance).toFixed(2));

    // Identify items that were removed
    const newItemIds = itemsData.map((i) => i.po_item_id);
    const itemsToDelete = existingPo.po_items.filter((i) => !newItemIds.includes(i.po_item_id));

    // Verify removed items are not linked to any GRN line
    for (const item of itemsToDelete) {
      const grnCount = await prisma.gRNItem.count({ where: { po_item_id: item.po_item_id } });
      if (grnCount > 0) {
        return NextResponse.json(
          { error: `Cannot remove line item ${item.po_item_id} because it already has received Goods Receipt Notes (GRN).` },
          { status: 400 }
        );
      }
    }

    // Execute atomic update
    const updatedPo = await prisma.$transaction(async (tx) => {
      // Delete removed lines
      if (itemsToDelete.length > 0) {
        await tx.pOItem.deleteMany({
          where: { po_item_id: { in: itemsToDelete.map((i) => i.po_item_id) } },
        });
      }

      // Upsert lines
      for (const item of itemsData) {
        await tx.pOItem.upsert({
          where: { po_item_id: item.po_item_id },
          update: {
            product_id: item.product_id,
            ordered_qty: item.ordered_qty,
            ordered_qty_mt: item.ordered_qty_mt,
            unit_rate: item.unit_rate,
            line_total: item.line_total,
            tolerable_variance_pct: item.tolerable_variance_pct,
          },
          create: {
            po_item_id: item.po_item_id,
            po_no: validated.po_no,
            product_id: item.product_id,
            ordered_qty: item.ordered_qty,
            ordered_qty_mt: item.ordered_qty_mt,
            unit_rate: item.unit_rate,
            line_total: item.line_total,
            tolerable_variance_pct: item.tolerable_variance_pct,
            line_status: 'Pending',
          },
        });
      }

      // Update PO Header
      return await tx.purchaseOrder.update({
        where: { po_no: validated.po_no },
        data: {
          po_date: new Date(validated.po_date),
          supplier_id: validated.supplier_id,
          shipping_address: validated.shipping_address,
          delivery_date: new Date(validated.delivery_date),
          payment_terms: validated.payment_terms,
          delivery_terms: validated.delivery_terms || existingPo.delivery_terms || 'FOB Mill Yard',
          quality_stipulations: validated.quality_stipulations !== undefined ? validated.quality_stipulations : existingPo.quality_stipulations,
          advance_amount: advance,
          remaining_amount: remainingAmount,
          po_status: validated.po_status || existingPo.po_status,
        },
        include: {
          supplier: true,
          po_items: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    return NextResponse.json(updatedPo);
  } catch (error: any) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json(
      { error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const poNo = searchParams.get('po_no');

    if (!poNo) {
      return NextResponse.json({ error: 'PO Number (po_no) is required' }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { po_no: poNo },
      include: { grns: true },
    });

    if (!po) {
      return NextResponse.json({ error: `Purchase Order ${poNo} not found` }, { status: 404 });
    }

    if (po.grns && po.grns.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete PO ${poNo} because it has ${po.grns.length} linked Goods Receipt Note(s).` },
        { status: 400 }
      );
    }

    await prisma.purchaseOrder.delete({
      where: { po_no: poNo },
    });

    return NextResponse.json({ success: true, message: `PO ${poNo} deleted successfully` });
  } catch (error: any) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
