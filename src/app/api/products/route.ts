import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ProductSchema } from '@/lib/validations';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const grade = searchParams.get('grade') || '';

    const where: any = {};
    if (query) {
      where.OR = [
        { product_description: { contains: query } },
        { product_id: { contains: query } },
        { grade: { contains: query } },
        { thread_type: { contains: query } },
      ];
    }
    if (grade) {
      where.grade = grade;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        _count: {
          select: {
            po_items: true,
            work_orders: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(products);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const validated = ProductSchema.parse(body);

    let productId = validated.product_id?.trim();
    if (!productId) {
      const existing = await prisma.product.findMany({ select: { product_id: true } });
      let maxNum = 0;
      for (const p of existing) {
        const match = p.product_id.match(/PRD-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      productId = `PRD-${String(maxNum + 1).padStart(3, '0')}`;
    }

    const product = await prisma.product.create({
      data: {
        product_id: productId,
        product_description: validated.product_description,
        size_od: validated.size_od,
        wall_thickness: validated.wall_thickness,
        grade: validated.grade,
        thread_type: validated.thread_type,
        cvn_requirement: validated.cvn_requirement,
        nominal_weight_kg_m: validated.nominal_weight_kg_m,
        uom: validated.uom || 'Meters',
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
});

export const PUT = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const validated = ProductSchema.parse(body);

    if (!validated.product_id) {
      return NextResponse.json({ error: 'Product ID is required for editing.' }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({
      where: { product_id: validated.product_id },
    });

    if (!existing) {
      return NextResponse.json({ error: `Product ${validated.product_id} not found.` }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { product_id: validated.product_id },
      data: {
        product_description: validated.product_description,
        size_od: validated.size_od,
        wall_thickness: validated.wall_thickness,
        grade: validated.grade,
        thread_type: validated.thread_type,
        cvn_requirement: validated.cvn_requirement,
        nominal_weight_kg_m: validated.nominal_weight_kg_m,
        uom: validated.uom || 'Meters',
      },
      include: {
        _count: {
          select: {
            po_items: true,
            work_orders: true,
          },
        },
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
});
