export type ProcessStageName =
  | 'Cutting'
  | 'ID Roughing'
  | 'OD Roughing'
  | 'Threading'
  | 'MPI'
  | 'Phosphating'
  | 'Painting'
  | 'Packing';

export const PROCESS_STAGES: { name: ProcessStageName; seq: number; description: string }[] = [
  { name: 'Cutting', seq: 10, description: 'Band saw or cold saw cut to parting length' },
  { name: 'ID Roughing', seq: 20, description: 'Boring/chamfering of internal diameter' },
  { name: 'OD Roughing', seq: 30, description: 'Turning & facing of outer diameter' },
  { name: 'Threading', seq: 40, description: 'CNC threading (BTC, LTC, STC, Premium)' },
  { name: 'MPI', seq: 50, description: 'Magnetic Particle Inspection for cracks/flaws' },
  { name: 'Phosphating', seq: 60, description: 'Anti-galling manganese phosphate coating' },
  { name: 'Painting', seq: 70, description: 'Color coding band & external clear vanish' },
  { name: 'Packing', seq: 80, description: 'Thread protector install & bundling/crating' },
];

export const DEFECT_CATEGORIES = [
  'MPI Rejection',
  'Material Fault (M.F.)',
  'Thread Mismatch',
  'Thread Step',
  'Total Length Undersize',
  'OD Undersize',
  'Thread Flat',
  'Thread Cut',
  'Thread Cut Due to Power off',
  'Standoff Undersize/Oversize',
  'ID Oversize',
  'Chatter Mark',
  'Bearing Face Undersize',
  'Short Qty',
] as const;

export type DefectCategory = (typeof DEFECT_CATEGORIES)[number];

export const DISPOSITION_ACTIONS = [
  'Scrap',
  'Down-grade',
  'Recut Short',
  'Rework Thread',
] as const;

export type DispositionAction = (typeof DISPOSITION_ACTIONS)[number];

export const PIPE_STATUSES = ['Available', 'Allocated', 'Consumed', 'Scrapped'] as const;
export type PipeAllocationStatus = (typeof PIPE_STATUSES)[number];

export const SHIFTS = ['Shift A', 'Shift B', 'Shift C'] as const;
export type ShiftType = (typeof SHIFTS)[number];

export const WO_STATUSES = ['Released', 'In Progress', 'Completed', 'Closed'] as const;
export type WorkOrderStatus = (typeof WO_STATUSES)[number];

export const PO_STATUSES = ['Draft', 'Approved', 'Open', 'Closed'] as const;
export type POStatus = (typeof PO_STATUSES)[number];

export const LINE_STATUSES = ['Pending', 'Partially Received', 'Fulfilled'] as const;
export type LineStatus = (typeof LINE_STATUSES)[number];

export const INSPECTION_STATUSES = ['Pending QA', 'Accepted', 'Rejected'] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const CUSTOMER_ORDER_STATUSES = [
  'Open',
  'In Production',
  'Partially Fulfilled',
  'Fulfilled',
  'Cancelled',
] as const;
export type CustomerOrderStatus = (typeof CUSTOMER_ORDER_STATUSES)[number];

export interface CustomerPOLineItem {
  cpo_item_id: string;
  customer_po_no: string;
  item_seq_no: number;
  size: string;
  grade: string;
  thread: string;
  quantity: number;
  price_per_unit: number;
  line_total: number;
  fulfilled_qty: number;
  line_status: 'Open' | 'In Production' | 'Fulfilled';
  created_at?: string;
  updated_at?: string;
}

export interface CustomerOrder {
  customer_po_no: string;
  customer_name: string;
  order_date: string;
  payment_terms: string;
  delivery_terms: string;
  delivery_due_date: string;
  remarks?: string | null;
  order_status: CustomerOrderStatus;
  total_amount: number;
  total_quantity: number;
  created_at?: string;
  updated_at?: string;
  items?: CustomerPOLineItem[];
  work_orders?: any[];
}

export interface WorkOrder {
  wo_id: string;
  wo_date: string;
  source_type?: 'PO' | 'Stock';
  po_no?: string | null;
  size?: string | null;
  grade?: string | null;
  thread?: string | null;
  order_quantity?: number | null;
  ti_id?: string | null;
  target_product_id?: string;
  planned_parts_to_produce: number;
  machine_line_no: string;
  shift: ShiftType;
  wo_status: WorkOrderStatus;
  customer_po_no?: string | null;
  cpo_item_id?: string | null;
  created_at?: string;
  updated_at?: string;
  target_product?: any;
  customer_order?: CustomerOrder | null;
  customer_po_line_item?: CustomerPOLineItem | null;
  purchase_order?: any;
  tally_item?: any;
  production_postings?: any[];
  rejection_postings?: any[];
}

export const DEFAULT_QUALITY_STIPULATIONS = `1. Mill Test Certificate (MTC Type 3.1 per EN 10204) mandatory upon delivery with heat chemistry and Charpy V-Notch (CVN) impact reports.
2. Actual weighbridge net weights will be reconciled against invoice MT. Variance exceeding ±1.5% triggers automatic QA hold.
3. Pipe ends must be fitted with protective bevel protectors / end caps and anti-corrosive mill varnish prior to dispatch.`;

export const CVN_REQUIREMENT_OPTIONS = [
  'L-7-21J (21°C ± 3°C)',
  'L-10-27J (21°C ± 3°C)',
  'T-10-20J (21°C ± 3°C)',
  'L-7-43J (0°C ± 3°C)',
  'L-10-54J (0°C ± 3°C)',
  'T-10-27J (0°C ± 3°C)',
  'T-10-30J (0°C ± 3°C)',
  'T-10-32J (0°C ± 3°C)',
] as const;

export type CvnRequirementOption = (typeof CVN_REQUIREMENT_OPTIONS)[number];
export const DEFAULT_CVN_REQUIREMENT: CvnRequirementOption = 'L-10-27J (21°C ± 3°C)';

