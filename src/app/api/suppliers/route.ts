import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SupplierSchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};
    if (query) {
      where.OR = [
        { supplier_name: { contains: query } },
        { supplier_id: { contains: query } },
        { mill_name: { contains: query } },
        { contact_person: { contains: query } },
        { gst_tax_id: { contains: query } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: { purchase_orders: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(suppliers);
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = SupplierSchema.parse(body);

    let supplierId = validated.supplier_id?.trim();
    if (!supplierId) {
      const existing = await prisma.supplier.findMany({ select: { supplier_id: true } });
      let maxNum = 0;
      for (const s of existing) {
        const match = s.supplier_id.match(/SUP-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      supplierId = `SUP-${String(maxNum + 1).padStart(3, '0')}`;
    }

    const supplier = await prisma.supplier.create({
      data: {
        supplier_id: supplierId,
        supplier_name: validated.supplier_name,
        supplier_onboarding_date: new Date(validated.supplier_onboarding_date),
        supplier_address: validated.supplier_address,
        contact_person: validated.contact_person,
        telephone_no: validated.telephone_no,
        supplier_mail: validated.supplier_mail,
        mill_name: validated.mill_name,
        mill_address: validated.mill_address,
        gst_tax_id: validated.gst_tax_id || '',
        status: validated.status || 'Active',
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const validated = SupplierSchema.parse(body);

    if (!validated.supplier_id) {
      return NextResponse.json({ error: 'Supplier ID is required for editing.' }, { status: 400 });
    }

    const existing = await prisma.supplier.findUnique({
      where: { supplier_id: validated.supplier_id },
    });

    if (!existing) {
      return NextResponse.json({ error: `Supplier ${validated.supplier_id} not found.` }, { status: 404 });
    }

    const updated = await prisma.supplier.update({
      where: { supplier_id: validated.supplier_id },
      data: {
        supplier_name: validated.supplier_name,
        supplier_onboarding_date: new Date(validated.supplier_onboarding_date),
        supplier_address: validated.supplier_address,
        contact_person: validated.contact_person,
        telephone_no: validated.telephone_no,
        supplier_mail: validated.supplier_mail,
        mill_name: validated.mill_name,
        mill_address: validated.mill_address,
        gst_tax_id: validated.gst_tax_id || '',
        status: validated.status || 'Active',
      },
      include: {
        _count: {
          select: { purchase_orders: true },
        },
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    return NextResponse.json(
      { error: error.message || 'Validation error', details: error.errors },
      { status: 400 }
    );
  }
}
