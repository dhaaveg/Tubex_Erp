import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatDate, formatDateTime } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dataset = searchParams.get('dataset') || 'all';

    // 1. Raw Pipe Inventory & Tally Items
    const getPipes = async () => {
      const tallyItems = await prisma.tallyItem.findMany({
        include: {
          tally_sheet: {
            include: {
              grn_item: {
                include: {
                  grn: true,
                  product: true,
                  po_item: {
                    include: {
                      purchase_order: {
                        include: {
                          supplier: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      return tallyItems.map((item) => ({
        'Pipe Tag ID': item.ti_id,
        'Serial No': item.tube_sr_no,
        'Heat Number': item.tally_sheet?.heat_no || '',
        'Lot Number': item.tally_sheet?.lot_no || '',
        'MTC Number': item.tally_sheet?.mill_test_certificate_no || '',
        'Length (mm)': item.tube_length_mm,
        'Parting Length (mm)': item.parting_length_mm,
        'Expected Pcs': item.expected_qty,
        'Rounded Yield Pcs': item.rounded_qty,
        'End Scrap (mm)': item.end_scrap_mm,
        'Allocation Status': item.pipe_allocation_status,
        'Steel Grade': item.tally_sheet?.grn_item?.product?.grade || 'L80',
        'OD (mm)': item.tally_sheet?.grn_item?.product?.size_od || 177.8,
        'WT (mm)': item.tally_sheet?.grn_item?.product?.wall_thickness || 10.36,
        'Thread Spec': item.tally_sheet?.grn_item?.product?.thread_type || 'BTC',
        'Supplier Name': item.tally_sheet?.grn_item?.po_item?.purchase_order?.supplier?.supplier_name || 'JFE Steel Corporation',
        'PO Number': item.tally_sheet?.grn_item?.po_item?.purchase_order?.po_no || 'PO-2026-001',
        'GRN Number': item.tally_sheet?.grn_item?.grn_id || 'GRN-2026-001',
        'Inspector': item.tally_sheet?.inspector_name || 'QA Lead',
        'Tally Date': item.tally_sheet?.tally_sheet_date ? formatDate(item.tally_sheet.tally_sheet_date) : '',
      }));
    };

    // 2. 8-Stage Routing Operations Postings
    const getRoutingPostings = async () => {
      const postings = await prisma.productionPosting.findMany({
        include: {
          work_order: {
            include: {
              target_product: true,
            },
          },
        },
        orderBy: [{ wo_id: 'asc' }, { operation_seq_no: 'asc' }, { stage_completion_timestamp: 'asc' }],
      });

      return postings.map((p) => ({
        'Posting ID': p.pp_id,
        'Work Order ID': p.wo_id,
        'Operation Seq': p.operation_seq_no,
        'Process Stage': p.process_stage_name,
        'Machine / Operator ID': p.operator_machine_id,
        'Input Quantity': p.input_quantity,
        'Accepted Quantity': p.accepted_quantity,
        'Rejected Quantity': p.rejected_quantity,
        'Rework Quantity': p.rework_quantity,
        'Completion Date': p.stage_completion_timestamp ? formatDateTime(p.stage_completion_timestamp) : '',
        'Target Product': p.work_order?.target_product?.product_description || '',
        'WO Shift': p.work_order?.shift || 'Shift A',
      }));
    };

    // 3. Work Orders
    const getWorkOrders = async () => {
      const wos = await prisma.workOrder.findMany({
        include: {
          target_product: true,
          customer_order: true,
          purchase_order: true,
          tally_item: {
            include: {
              tally_sheet: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      return wos.map((w) => ({
        'Work Order ID': w.wo_id,
        'Date': w.wo_date ? formatDate(w.wo_date) : '',
        'Source Type': w.source_type,
        'Customer PO No': w.customer_po_no || 'N/A',
        'Customer Name': w.customer_order?.customer_name || 'N/A',
        'Target Product ID': w.target_product_id,
        'Product Description': w.target_product?.product_description || '',
        'Size': w.size || `${w.target_product?.size_od || ''} mm`,
        'Grade': w.grade || w.target_product?.grade || '',
        'Thread': w.thread || w.target_product?.thread_type || '',
        'Quantity to Produce (User Entry)': w.order_quantity ?? w.planned_parts_to_produce,
        'Planned Parts Target': w.planned_parts_to_produce,
        'Allocated Pipe Tag': w.ti_id || 'N/A',
        'Source Heat No': w.tally_item?.tally_sheet?.heat_no || 'N/A',
        'Machine Line': w.machine_line_no,
        'Shift': w.shift,
        'Status': w.wo_status,
      }));
    };

    // 4. Quality & Defect Rejections
    const getRejections = async () => {
      const rejections = await prisma.rejectionPosting.findMany({
        include: {
          production_posting: true,
          work_order: true,
        },
        orderBy: { logged_timestamp: 'desc' },
      });

      return rejections.map((r) => ({
        'Rejection ID': r.rp_id,
        'Posting ID': r.pp_id,
        'Work Order ID': r.wo_id,
        'Process Stage': r.production_posting?.process_stage_name || 'N/A',
        'Operation Seq': r.production_posting?.operation_seq_no || 0,
        'Defect Category': r.defect_category,
        'Defect Quantity': r.defect_quantity,
        'Disposition Action': r.disposition_action,
        'Inspector Remarks': r.inspector_remarks || '',
        'Logged Date': r.logged_timestamp ? formatDateTime(r.logged_timestamp) : '',
      }));
    };

    // 5. Purchase Orders
    const getPurchaseOrders = async () => {
      const pos = await prisma.purchaseOrder.findMany({
        include: {
          supplier: true,
          po_items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { po_date: 'desc' },
      });

      const rows: Record<string, any>[] = [];
      pos.forEach((po) => {
        if (!po.po_items || po.po_items.length === 0) {
          rows.push({
            'PO Number': po.po_no,
            'PO Date': po.po_date ? formatDate(po.po_date) : '',
            'Supplier ID': po.supplier_id,
            'Supplier Name': po.supplier?.supplier_name || '',
            'Status': po.po_status,
            'Payment Terms': po.payment_terms,
            'Delivery Terms': po.delivery_terms || 'FOB Mill Yard',
            'Delivery Due Date': po.delivery_date ? formatDate(po.delivery_date) : '',
            'Shipping Address': po.shipping_address,
            'Item ID': 'N/A',
            'Product Description': 'N/A',
            'Ordered Qty (MT)': 0,
            'Unit Rate': 0,
            'Line Total': 0,
            'Line Status': 'N/A',
          });
        } else {
          po.po_items.forEach((item) => {
            rows.push({
              'PO Number': po.po_no,
              'PO Date': po.po_date ? formatDate(po.po_date) : '',
              'Supplier ID': po.supplier_id,
              'Supplier Name': po.supplier?.supplier_name || '',
              'Status': po.po_status,
              'Payment Terms': po.payment_terms,
              'Delivery Terms': po.delivery_terms || 'FOB Mill Yard',
              'Delivery Due Date': po.delivery_date ? formatDate(po.delivery_date) : '',
              'Shipping Address': po.shipping_address,
              'Item ID': item.po_item_id,
              'Product Description': item.product?.product_description || item.product_id,
              'Ordered Qty (MT)': item.ordered_qty_mt,
              'Unit Rate': item.unit_rate,
              'Line Total': item.line_total,
              'Line Status': item.line_status,
            });
          });
        }
      });
      return rows;
    };

    // 6. Goods Receipt Notes (GRN)
    const getGRNs = async () => {
      const grns = await prisma.gRN.findMany({
        include: {
          purchase_order: {
            include: {
              supplier: true,
            },
          },
          grn_items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { grn_date: 'desc' },
      });

      return grns.map((g) => ({
        'GRN ID': g.grn_id,
        'GRN Date': g.grn_date ? formatDate(g.grn_date) : '',
        'PO Number': g.po_no,
        'Supplier Name': g.purchase_order?.supplier?.supplier_name || '',
        'Invoice Number': g.invoice_no,
        'Invoice Date': g.invoice_date ? formatDate(g.invoice_date) : '',
        'Vehicle / Transporter': g.vehicle_transporter_no,
        'Invoice Weight (MT)': g.invoice_weight_mt,
        'Actual Weighbridge (MT)': g.actual_weighbridge_weight_mt,
        'Weight Variance (MT)': g.weight_difference_mt,
        'Tubes Received Count': g.total_tubes_received_actual,
        'Tally Item Count': g.total_tubes_tally,
        'Tally Match Status': g.tally_match_status,
      }));
    };

    // 7. Customer Orders
    const getCustomerOrders = async () => {
      const orders = await prisma.customerOrder.findMany({
        include: {
          items: true,
        },
        orderBy: { order_date: 'desc' },
      });

      const rows: Record<string, any>[] = [];
      orders.forEach((ord) => {
        if (!ord.items || ord.items.length === 0) {
          rows.push({
            'Customer PO No': ord.customer_po_no,
            'Customer Name': ord.customer_name,
            'Order Date': ord.order_date ? formatDate(ord.order_date) : '',
            'Delivery Due Date': ord.delivery_due_date ? formatDate(ord.delivery_due_date) : '',
            'Status': ord.order_status,
            'Payment Terms': ord.payment_terms,
            'Delivery Terms': ord.delivery_terms,
            'Total Order Amount': ord.total_amount,
            'Total Order Qty': ord.total_quantity,
            'Line Item ID': 'N/A',
            'Size': 'N/A',
            'Grade': 'N/A',
            'Thread': 'N/A',
            'Line Qty': 0,
            'Unit Price': 0,
            'Line Total': 0,
            'Fulfilled Qty': 0,
            'Line Status': 'N/A',
          });
        } else {
          ord.items.forEach((item) => {
            rows.push({
              'Customer PO No': ord.customer_po_no,
              'Customer Name': ord.customer_name,
              'Order Date': ord.order_date ? formatDate(ord.order_date) : '',
              'Delivery Due Date': ord.delivery_due_date ? formatDate(ord.delivery_due_date) : '',
              'Status': ord.order_status,
              'Payment Terms': ord.payment_terms,
              'Delivery Terms': ord.delivery_terms,
              'Total Order Amount': ord.total_amount,
              'Total Order Qty': ord.total_quantity,
              'Line Item ID': item.cpo_item_id,
              'Size': item.size,
              'Grade': item.grade,
              'Thread': item.thread,
              'Line Qty': item.quantity,
              'Unit Price': item.price_per_unit,
              'Line Total': item.line_total,
              'Fulfilled Qty': item.fulfilled_qty,
              'Line Status': item.line_status,
            });
          });
        }
      });
      return rows;
    };

    // 8. Product Master
    const getProducts = async () => {
      const products = await prisma.product.findMany({
        orderBy: { product_id: 'asc' },
      });

      return products.map((p) => ({
        'Product Code': p.product_id,
        'Description': p.product_description,
        'OD (mm)': p.size_od,
        'WT (mm)': p.wall_thickness,
        'Steel Grade': p.grade,
        'Thread Connection': p.thread_type,
        'CVN Requirement': p.cvn_requirement,
        'Nominal Weight (kg/m)': p.nominal_weight_kg_m,
        'UOM': p.uom,
      }));
    };

    // 9. Supplier Master
    const getSuppliers = async () => {
      const suppliers = await prisma.supplier.findMany({
        orderBy: { supplier_id: 'asc' },
      });

      return suppliers.map((s) => ({
        'Supplier ID': s.supplier_id,
        'Supplier Name': s.supplier_name,
        'Mill Name': s.mill_name,
        'Mill Address': s.mill_address,
        'Contact Person': s.contact_person,
        'Email Address': s.supplier_mail,
        'Telephone': s.telephone_no,
        'GST / Tax ID': s.gst_tax_id,
        'Onboarding Date': s.supplier_onboarding_date ? formatDate(s.supplier_onboarding_date) : '',
        'Status': s.status,
      }));
    };

    // Specific dataset requests
    if (dataset === 'pipes') {
      return NextResponse.json({ pipes: await getPipes() });
    }
    if (dataset === 'routing') {
      return NextResponse.json({ routing: await getRoutingPostings() });
    }
    if (dataset === 'work-orders') {
      return NextResponse.json({ workOrders: await getWorkOrders() });
    }
    if (dataset === 'quality') {
      return NextResponse.json({ quality: await getRejections() });
    }
    if (dataset === 'procurement') {
      return NextResponse.json({ purchaseOrders: await getPurchaseOrders(), grns: await getGRNs() });
    }
    if (dataset === 'customer-orders') {
      return NextResponse.json({ customerOrders: await getCustomerOrders() });
    }
    if (dataset === 'products') {
      return NextResponse.json({ products: await getProducts() });
    }
    if (dataset === 'suppliers') {
      return NextResponse.json({ suppliers: await getSuppliers() });
    }

    // Default: Fetch all datasets concurrently
    const [
      pipes,
      routing,
      workOrders,
      quality,
      purchaseOrders,
      grns,
      customerOrders,
      products,
      suppliers,
    ] = await Promise.all([
      getPipes(),
      getRoutingPostings(),
      getWorkOrders(),
      getRejections(),
      getPurchaseOrders(),
      getGRNs(),
      getCustomerOrders(),
      getProducts(),
      getSuppliers(),
    ]);

    return NextResponse.json({
      summary: {
        totalPipes: pipes.length,
        totalRoutingPostings: routing.length,
        totalWorkOrders: workOrders.length,
        totalQualityRejections: quality.length,
        totalPurchaseOrderLines: purchaseOrders.length,
        totalGRNs: grns.length,
        totalCustomerOrderLines: customerOrders.length,
        totalProducts: products.length,
        totalSuppliers: suppliers.length,
        exportedAt: new Date().toISOString(),
      },
      data: {
        'Pipe Inventory': pipes,
        'Shop Routing Logs': routing,
        'Work Orders': workOrders,
        'Quality & Defect Postings': quality,
        'Purchase Orders': purchaseOrders,
        'Goods Receipt (GRN)': grns,
        'Customer Sales Orders': customerOrders,
        'Product Catalog': products,
        'Supplier Master': suppliers,
      },
    });
  } catch (error: any) {
    console.error('Error in export data API:', error);
    return NextResponse.json({ error: error.message || 'Failed to export data' }, { status: 500 });
  }
}
