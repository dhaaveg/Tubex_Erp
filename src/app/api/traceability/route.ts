import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || searchParams.get('tag') || searchParams.get('heat'))?.trim();

    if (!query) {
      return NextResponse.json(
        { error: 'Search parameter q (Heat No, Tube Tag, WO ID, PO No, or GRN ID) is required' },
        { status: 400 }
      );
    }

    // Attempt 1: Search by Tube Tag / TI_Id
    let tallyItem = await prisma.tallyItem.findFirst({
      where: { ti_id: { contains: query } },
      include: {
        tally_sheet: {
          include: {
            grn_item: {
              include: {
                product: true,
                po_item: true,
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
        work_orders: {
          include: {
            target_product: true,
            customer_order: true,
            customer_po_line_item: true,
            production_postings: {
              include: { rejections: true },
              orderBy: { operation_seq_no: 'asc' },
            },
            rejection_postings: true,
          },
        },
      },
    });

    // Attempt 2: Search by Heat No, Lot No, or MTC No
    if (!tallyItem) {
      const tallySheet = await prisma.tallySheet.findFirst({
        where: {
          OR: [
            { heat_no: { contains: query } },
            { lot_no: { contains: query } },
            { mill_test_certificate_no: { contains: query } },
          ],
        },
        include: {
          tally_items: {
            include: {
              work_orders: {
                include: {
                  target_product: true,
                  production_postings: {
                    include: { rejections: true },
                    orderBy: { operation_seq_no: 'asc' },
                  },
                  rejection_postings: true,
                },
              },
            },
          },
          grn_item: {
            include: {
              product: true,
              po_item: true,
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
      });

      if (tallySheet && tallySheet.tally_items.length > 0) {
        // Return full bundle
        return NextResponse.json({
          searchType: 'HEAT_LOT_MTC',
          tallySheet,
          primaryItem: tallySheet.tally_items[0],
          allItems: tallySheet.tally_items,
        });
      }
    }

    // Attempt 3: Search by Work Order ID
    if (!tallyItem) {
      const workOrder = await prisma.workOrder.findFirst({
        where: { wo_id: { contains: query } },
        include: {
          target_product: true,
          production_postings: {
            include: { rejections: true },
            orderBy: { operation_seq_no: 'asc' },
          },
          rejection_postings: true,
          tally_item: {
            include: {
              tally_sheet: {
                include: {
                  grn_item: {
                    include: {
                      product: true,
                      po_item: true,
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
        },
      });

      if (workOrder) {
        return NextResponse.json({
          searchType: 'WORK_ORDER',
          workOrder,
          tallyItem: workOrder.tally_item,
        });
      }
    }

    // Attempt 4: Search by PO No
    const po = await prisma.purchaseOrder.findFirst({
      where: { po_no: { contains: query } },
      include: {
        supplier: true,
        po_items: {
          include: { product: true },
        },
        grns: {
          include: {
            grn_items: {
              include: {
                product: true,
                tally_sheets: {
                  include: {
                    tally_items: {
                      include: {
                        work_orders: {
                          include: {
                            production_postings: true,
                            rejection_postings: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (po) {
      return NextResponse.json({
        searchType: 'PURCHASE_ORDER',
        purchaseOrder: po,
      });
    }

    // Attempt 5: Search by Customer PO No
    const customerOrder = await prisma.customerOrder.findFirst({
      where: { customer_po_no: { contains: query } },
      include: {
        items: true,
        work_orders: {
          include: {
            target_product: true,
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
              include: { rejections: true },
            },
            rejection_postings: true,
          },
        },
      },
    });

    if (customerOrder) {
      return NextResponse.json({
        searchType: 'CUSTOMER_ORDER',
        customerOrder,
      });
    }

    if (tallyItem) {
      return NextResponse.json({
        searchType: 'TUBE_TAG',
        tallyItem,
      });
    }

    return NextResponse.json(
      { error: `No traceability records found matching identifier "${query}"` },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error in traceability lookup:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
