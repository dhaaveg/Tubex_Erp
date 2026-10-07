import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withApiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async () => {
  try {
    const [
      totalSuppliers,
      totalProducts,
      totalPOs,
      totalGRNs,
      totalPipes,
      availablePipes,
      totalWorkOrders,
      openWorkOrders,
      totalPostings,
      totalRejections,
      totalCustomerOrders,
      openCustomerOrders,
    ] = await Promise.all([
      prisma.supplier.count({ where: { status: 'Active' } }),
      prisma.product.count(),
      prisma.purchaseOrder.count(),
      prisma.gRN.count(),
      prisma.tallyItem.count(),
      prisma.tallyItem.count({ where: { pipe_allocation_status: 'Available' } }),
      prisma.workOrder.count(),
      prisma.workOrder.count({ where: { wo_status: { in: ['Released', 'In Progress'] } } }),
      prisma.productionPosting.count(),
      prisma.rejectionPosting.count(),
      prisma.customerOrder.count(),
      prisma.customerOrder.count({ where: { order_status: { in: ['Open', 'In Production'] } } }),
    ]);

    // Calculate yield statistics from tally items
    const tallyItems = await prisma.tallyItem.findMany({
      select: {
        tube_length_mm: true,
        parting_length_mm: true,
        rounded_qty: true,
        end_scrap_mm: true,
      },
    });

    let totalRawLength = 0;
    let totalScrapLength = 0;
    let totalPlannedParts = 0;

    tallyItems.forEach((t) => {
      totalRawLength += t.tube_length_mm;
      totalScrapLength += t.end_scrap_mm;
      totalPlannedParts += t.rounded_qty;
    });

    const averageCuttingYieldPct =
      totalRawLength > 0
        ? Number((((totalRawLength - totalScrapLength) / totalRawLength) * 100).toFixed(2))
        : 0;

    // Production scrap count
    const rejections = await prisma.rejectionPosting.findMany({
      select: { defect_quantity: true },
    });
    const totalDefectParts = rejections.reduce((sum, r) => sum + r.defect_quantity, 0);

    return NextResponse.json({
      totalSuppliers,
      totalProducts,
      totalPOs,
      totalGRNs,
      pipes: {
        total: totalPipes,
        available: availablePipes,
        allocated: totalPipes - availablePipes,
      },
      workOrders: {
        total: totalWorkOrders,
        active: openWorkOrders,
      },
      customerOrders: {
        total: totalCustomerOrders,
        active: openCustomerOrders,
      },
      quality: {
        totalPostings,
        totalRejectionEvents: totalRejections,
        totalDefectParts,
      },
      cuttingYield: {
        averageCuttingYieldPct,
        totalRawMeters: Number((totalRawLength / 1000).toFixed(2)),
        totalScrapMeters: Number((totalScrapLength / 1000).toFixed(2)),
        totalPlannedParts,
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error fetching dashboard stats' }, { status: 500 });
  }
});
