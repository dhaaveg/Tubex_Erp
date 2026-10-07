import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { CustomerOrderSchema } from '@/lib/validations';
import { withApiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const status = searchParams.get('status')?.trim();

    const where: any = {};
    if (status) {
      where.order_status = status;
    }
    if (q) {
      where.OR = [
        { customer_po_no: { contains: q } },
        { customer_name: { contains: q } },
        { payment_terms: { contains: q } },
        { delivery_terms: { contains: q } },
        { remarks: { contains: q } },
        {
          items: {
            some: {
              OR: [
                { size: { contains: q } },
                { grade: { contains: q } },
                { thread: { contains: q } },
              ],
            },
          },
        },
      ];
    }

    const orders = await prisma.customerOrder.findMany({
      where,
      include: {
        items: {
          orderBy: { item_seq_no: 'asc' },
        },
        work_orders: {
          select: {
            wo_id: true,
            wo_status: true,
            target_product_id: true,
            planned_parts_to_produce: true,
            cpo_item_id: true,
          },
        },
        _count: {
          select: {
            items: true,
            work_orders: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error('Error fetching customer orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer orders' },
      { status: 500 }
    );
  }
});

export const POST = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const parseResult = CustomerOrderSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.message, details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Check if customer_po_no already exists
    const existing = await prisma.customerOrder.findUnique({
      where: { customer_po_no: data.customer_po_no },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Customer Order with PO No '${data.customer_po_no}' already exists.` },
        { status: 409 }
      );
    }

    // Compute line totals and order grand totals
    const preparedItems = data.items.map((item, index) => {
      const lineTotal = Number((item.quantity * item.price_per_unit).toFixed(2));
      const cpoItemId =
        item.cpo_item_id && item.cpo_item_id.trim() !== ''
          ? item.cpo_item_id.trim()
          : `${data.customer_po_no}-ITM-${String(index + 1).padStart(2, '0')}`;

      return {
        cpo_item_id: cpoItemId,
        item_seq_no: index + 1,
        size: item.size.trim(),
        grade: item.grade.trim(),
        thread: item.thread.trim(),
        quantity: item.quantity,
        price_per_unit: item.price_per_unit,
        line_total: lineTotal,
        fulfilled_qty: 0,
        line_status: item.line_status || 'Open',
      };
    });

    const totalAmount = preparedItems.reduce((acc, curr) => acc + curr.line_total, 0);
    const totalQuantity = preparedItems.reduce((acc, curr) => acc + curr.quantity, 0);

    const order = await prisma.customerOrder.create({
      data: {
        customer_po_no: data.customer_po_no.trim(),
        customer_name: data.customer_name.trim(),
        order_date: new Date(data.order_date),
        payment_terms: data.payment_terms.trim(),
        delivery_terms: data.delivery_terms.trim(),
        delivery_due_date: new Date(data.delivery_due_date),
        remarks: data.remarks || '',
        order_status: data.order_status || 'Open',
        total_amount: Number(totalAmount.toFixed(2)),
        total_quantity: Number(totalQuantity.toFixed(2)),
        items: {
          create: preparedItems,
        },
      },
      include: {
        items: true,
        _count: {
          select: { items: true, work_orders: true },
        },
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error('Error creating customer order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create customer order' },
      { status: 500 }
    );
  }
});

export const PUT = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const parseResult = CustomerOrderSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.message, details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    const existing = await prisma.customerOrder.findUnique({
      where: { customer_po_no: data.customer_po_no },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Customer Order '${data.customer_po_no}' not found.` },
        { status: 404 }
      );
    }

    // Prepare revised items
    const preparedItems = data.items.map((item, index) => {
      const lineTotal = Number((item.quantity * item.price_per_unit).toFixed(2));
      const cpoItemId =
        item.cpo_item_id && item.cpo_item_id.trim() !== ''
          ? item.cpo_item_id.trim()
          : `${data.customer_po_no}-ITM-${String(index + 1).padStart(2, '0')}`;

      return {
        cpo_item_id: cpoItemId,
        item_seq_no: index + 1,
        size: item.size.trim(),
        grade: item.grade.trim(),
        thread: item.thread.trim(),
        quantity: item.quantity,
        price_per_unit: item.price_per_unit,
        line_total: lineTotal,
        fulfilled_qty: 0,
        line_status: item.line_status || 'Open',
      };
    });

    const totalAmount = preparedItems.reduce((acc, curr) => acc + curr.line_total, 0);
    const totalQuantity = preparedItems.reduce((acc, curr) => acc + curr.quantity, 0);

    const updated = await prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.customerPOLineItem.deleteMany({
        where: { customer_po_no: data.customer_po_no },
      });

      // Update header and recreate items
      return await tx.customerOrder.update({
        where: { customer_po_no: data.customer_po_no },
        data: {
          customer_name: data.customer_name.trim(),
          order_date: new Date(data.order_date),
          payment_terms: data.payment_terms.trim(),
          delivery_terms: data.delivery_terms.trim(),
          delivery_due_date: new Date(data.delivery_due_date),
          remarks: data.remarks || '',
          order_status: data.order_status || 'Open',
          total_amount: Number(totalAmount.toFixed(2)),
          total_quantity: Number(totalQuantity.toFixed(2)),
          items: {
            create: preparedItems,
          },
        },
        include: {
          items: {
            orderBy: { item_seq_no: 'asc' },
          },
          work_orders: true,
          _count: {
            select: { items: true, work_orders: true },
          },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating customer order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update customer order' },
      { status: 500 }
    );
  }
});

export const DELETE = withApiHandler(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const customer_po_no = searchParams.get('customer_po_no')?.trim();

    if (!customer_po_no) {
      return NextResponse.json(
        { success: false, error: 'customer_po_no is required to delete an order' },
        { status: 400 }
      );
    }

    const order = await prisma.customerOrder.findUnique({
      where: { customer_po_no },
      include: { work_orders: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: `Customer Order '${customer_po_no}' not found.` },
        { status: 404 }
      );
    }

    if (order.work_orders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete Customer Order '${customer_po_no}' because it has ${order.work_orders.length} active Work Orders linked.`,
        },
        { status: 400 }
      );
    }

    await prisma.customerOrder.delete({
      where: { customer_po_no },
    });

    return NextResponse.json({ success: true, message: `Customer Order '${customer_po_no}' deleted.` });
  } catch (error: any) {
    console.error('Error deleting customer order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete customer order' },
      { status: 500 }
    );
  }
});
