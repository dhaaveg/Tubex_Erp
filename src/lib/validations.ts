import { z } from 'zod';
import { 
  DEFECT_CATEGORIES, 
  DISPOSITION_ACTIONS, 
  PROCESS_STAGES, 
  SHIFTS, 
  CVN_REQUIREMENT_OPTIONS, 
  DEFAULT_CVN_REQUIREMENT, 
  type CvnRequirementOption 
} from './types';

export { CVN_REQUIREMENT_OPTIONS, DEFAULT_CVN_REQUIREMENT, type CvnRequirementOption };

export const SupplierSchema = z.object({
  supplier_id: z.string().optional().or(z.literal('')),
  supplier_name: z.string().min(2, 'Supplier name is required'),
  supplier_onboarding_date: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  supplier_address: z.string().min(3, 'Address is required'),
  contact_person: z.string().min(2, 'Contact person is required'),
  telephone_no: z.string().min(5, 'Telephone is required'),
  supplier_mail: z.string().email('Invalid email address'),
  mill_name: z.string().min(2, 'Mill name is required'),
  mill_address: z.string().min(3, 'Mill address is required'),
  gst_tax_id: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});

export const ProductSchema = z.object({
  product_id: z.string().optional().or(z.literal('')),
  product_description: z.string().min(3, 'Description is required'),
  size_od: z.coerce.number().positive('Size OD must be positive'),
  wall_thickness: z.coerce.number().positive('Wall thickness must be positive'),
  grade: z.string().min(2, 'Grade is required (e.g., J55, K55, L80, P110)'),
  thread_type: z.string().min(2, 'Thread type is required (e.g., BTC, LTC, Premium)'),
  cvn_requirement: z.string().min(2, 'CVN requirement is required'),
  nominal_weight_kg_m: z.coerce.number().positive('Nominal weight must be positive'),
  uom: z.string().default('Meters'),
});

export const POItemSchema = z.object({
  po_item_id: z.string().optional(),
  product_id: z.string().optional(),
  size_od: z.coerce.number().optional(),
  wall_thickness: z.coerce.number().optional(),
  schedule: z.string().optional(),
  grade: z.string().optional(),
  cvn_requirement: z.string().optional(),
  ordered_qty: z.coerce.number().min(0).default(0),
  ordered_qty_mt: z.coerce.number().min(0, 'Ordered MT must be non-negative'),
  unit_rate: z.coerce.number().min(0, 'Unit rate must be non-negative'),
  tolerable_variance_pct: z.coerce.number().min(0).max(100).default(5),
});

export const PurchaseOrderSchema = z.object({
  po_no: z.string().min(2, 'PO Number is required'),
  po_date: z.string().min(1, 'PO date is required'),
  supplier_id: z.string().min(1, 'Supplier is required'),
  shipping_address: z.string().min(3, 'Shipping address is required'),
  delivery_date: z.string().min(1, 'Delivery due date is required'),
  payment_terms: z.string().min(2, 'Payment terms are required'),
  delivery_terms: z.string().optional().default('FOB Mill Yard'),
  quality_stipulations: z.string().optional(),
  advance_amount: z.coerce.number().min(0).default(0),
  po_status: z.enum(['Draft', 'Approved', 'Open', 'Closed']).default('Draft'),
  items: z.array(POItemSchema).min(1, 'At least one line item is required'),
});

export const GRNItemInputSchema = z.object({
  grn_item_id: z.string().optional().or(z.literal('')),
  po_item_id: z.string().optional().or(z.literal('')),
  product_id: z.string().optional().or(z.literal('')),
  size: z.union([z.string(), z.number()]).optional(),
  grade: z.string().optional(),
  thread: z.string().optional(),
  invoice_quantity: z.coerce.number().min(0).default(0),
  received_quantity: z.coerce.number().min(0).optional().default(0),
  invoice_quantity_mt: z.coerce.number().min(0, 'Qty as per invoice (MT) must be non-negative').default(0),
  actual_quantity_mt: z.coerce.number().min(0, 'Actual Qty (MT) must be non-negative').default(0),
  rejected_damaged_qty: z.coerce.number().min(0).default(0),
  item_inspection_status: z.enum(['Pending QA', 'Accepted', 'Rejected']).default('Pending QA'),
});

export const GRNSchema = z.object({
  grn_id: z.string().min(2, 'GRN ID is required'),
  grn_date: z.string().min(1, 'GRN Date is required'),
  po_no: z.string().min(1, 'PO reference is required'),
  invoice_no: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  vehicle_transporter_no: z.string().min(1, 'Transporter / Vehicle info required'),
  invoice_weight_mt: z.coerce.number().min(0, 'Invoice weight must be non-negative').default(0),
  actual_weighbridge_weight_mt: z.coerce.number().min(0, 'Weighbridge weight must be non-negative').default(0),
  total_tubes_received_actual: z.coerce.number().int().min(0).optional().default(0),
  items: z.array(GRNItemInputSchema).min(1, 'At least one item required'),
});

export const TallyItemInputSchema = z.object({
  ti_id: z.string().min(2, 'Barcode / Lot Tag is required'),
  tube_sr_no: z.coerce.number().int().positive('Lot serial number must be positive'),
  heat_no: z.string().optional().or(z.literal('')),
  lot_no: z.string().optional().or(z.literal('')),
  mill_test_certificate_no: z.string().optional().or(z.literal('')),
  tube_count: z.coerce.number().int().min(1).default(1),
  tube_length_mm: z.coerce.number().positive('Total tube length must be greater than 0'),
  parting_length_mm: z.coerce.number().positive('Parting length must be greater than 0'),
});

export const TallySheetSchema = z.object({
  ts_id: z.string().min(2, 'Tally Sheet ID required'),
  grn_item_id: z.string().min(1, 'GRN Item reference required'),
  lot_no: z.string().optional().or(z.literal('')),
  heat_no: z.string().optional().or(z.literal('')),
  mill_test_certificate_no: z.string().optional().or(z.literal('')),
  tally_sheet_date: z.string().min(1, 'Date required'),
  inspector_name: z.string().min(2, 'Inspector name is required'),
  bundle_count: z.coerce.number().int().positive().default(1),
  tally_items: z.array(TallyItemInputSchema).min(1, 'At least one lot must be tallied'),
});

export const WorkOrderSchema = z.object({
  wo_id: z.string().min(2, 'Work Order ID required'),
  wo_date: z.string().min(1, 'Date is required'),
  source_type: z.enum(['PO', 'Stock']).default('PO'),
  po_no: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  thread: z.string().optional().nullable(),
  order_quantity: z.coerce.number().int().positive().optional().nullable(),
  planned_parts_to_produce: z.coerce.number().int().positive().optional().nullable(),
  ti_id: z.string().optional().nullable(),
  target_product_id: z.string().optional().nullable(),
  machine_line_no: z.string().min(1, 'Machine Line No required').default('CNC-CELL-01'),
  shift: z.enum(SHIFTS).default('Shift A'),
  wo_status: z.enum(['Released', 'In Progress', 'Completed', 'Closed', 'Cancelled']).optional(),
  customer_po_no: z.string().optional().nullable(),
  cpo_item_id: z.string().optional().nullable(),
});

export const RejectionEntrySchema = z.object({
  defect_category: z.enum(DEFECT_CATEGORIES),
  defect_quantity: z.coerce.number().int().positive('Defect quantity must be > 0'),
  disposition_action: z.enum(DISPOSITION_ACTIONS),
  inspector_remarks: z.string().optional(),
});

export const ProductionPostingSchema = z.object({
  pp_id: z.string().min(2, 'Production Posting ID required'),
  wo_id: z.string().min(1, 'Work Order reference required'),
  process_stage_name: z.enum([
    'Cutting',
    'ID Roughing',
    'OD Roughing',
    'Threading',
    'MPI',
    'Phosphating',
    'Painting',
    'Packing',
  ]),
  operation_seq_no: z.coerce.number().int().positive(),
  operator_machine_id: z.string().min(1, 'Operator / Machine ID required'),
  input_quantity: z.coerce.number().int().min(0, 'Input qty cannot be negative'),
  accepted_quantity: z.coerce.number().int().min(0, 'Accepted qty cannot be negative'),
  rejected_quantity: z.coerce.number().int().min(0, 'Rejected qty cannot be negative'),
  rework_quantity: z.coerce.number().int().min(0, 'Rework qty cannot be negative'),
  rejections: z.array(RejectionEntrySchema).optional(),
}).refine(
  (data) => data.input_quantity === data.accepted_quantity + data.rejected_quantity + data.rework_quantity,
  {
    message: 'Production Balance Gate: "Input Qty" - "Rejected Qty" must equal "Accepted Qty"',
    path: ['accepted_quantity'],
  }
).refine(
  (data) => {
    if (data.rejected_quantity > 0) {
      if (!data.rejections || data.rejections.length === 0) return false;
      const totalDefects = data.rejections.reduce((sum, r) => sum + r.defect_quantity, 0);
      return totalDefects === data.rejected_quantity;
    }
    return true;
  },
  {
    message: 'Rejection Log: Sum of defect quantities must exactly match Rejected Quantity',
    path: ['rejected_quantity'],
  }
);

export const CustomerPOLineItemSchema = z.object({
  cpo_item_id: z.string().optional(),
  item_seq_no: z.coerce.number().optional(),
  size: z.string().min(1, 'Size is required (e.g. 7 in OD, 9-5/8 in)'),
  grade: z.string().min(1, 'Grade is required (e.g. L80, P110, J55)'),
  thread: z.string().min(1, 'Thread is required (e.g. BTC, LTC, Premium)'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  price_per_unit: z.coerce.number().min(0, 'Price per unit cannot be negative'),
  line_status: z.enum(['Open', 'In Production', 'Fulfilled']).default('Open'),
});

export const CustomerOrderSchema = z.object({
  customer_po_no: z.string().min(1, "Customer's PO No is required"),
  customer_name: z.string().min(1, "Customer's Name is required"),
  order_date: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  payment_terms: z.string().min(1, 'Paying terms are required'),
  delivery_terms: z.string().min(1, 'Delivery terms are required'),
  delivery_due_date: z.string().min(1, 'Delivery due date is required'),
  remarks: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
  order_status: z
    .enum(['Open', 'In Production', 'Partially Fulfilled', 'Fulfilled', 'Cancelled'])
    .default('Open'),
  items: z.array(CustomerPOLineItemSchema).min(1, 'At least one Customer PO line item is required'),
});

