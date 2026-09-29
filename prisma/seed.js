const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Tube & Pipe Processing ERP Database...');

  // Clean up in reverse dependency order
  await prisma.rejectionPosting.deleteMany({});
  await prisma.productionPosting.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.tallyItem.deleteMany({});
  await prisma.tallySheet.deleteMany({});
  await prisma.gRNItem.deleteMany({});
  await prisma.gRN.deleteMany({});
  await prisma.pOItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.supplier.deleteMany({});

  console.log('1. Seeding Suppliers...');
  const s1 = await prisma.supplier.create({
    data: {
      supplier_id: 'SUP-001',
      supplier_name: 'Tenaris Global Tubulars Ltd',
      supplier_onboarding_date: new Date('2024-01-15'),
      supplier_address: '26 Boulevard Royal, L-2449 Luxembourg',
      contact_person: 'Gianluca Rossi',
      telephone_no: '+39 035 560 111',
      supplier_mail: 'sales.octg@tenaris.com',
      mill_name: 'Dalmine Seamless Tube Mill',
      mill_address: 'Piazza Caduti 6 Luglio 1944, 1, 24044 Dalmine BG, Italy',
      gst_tax_id: 'LU-218492019',
      status: 'Active',
    },
  });

  const s2 = await prisma.supplier.create({
    data: {
      supplier_id: 'SUP-002',
      supplier_name: 'Vallourec OCTG Solutions SAS',
      supplier_onboarding_date: new Date('2024-03-20'),
      supplier_address: '12 Rue de la Verrerie, 92190 Meudon, France',
      contact_person: 'Claire Dubois',
      telephone_no: '+33 1 49 09 38 00',
      supplier_mail: 'claire.dubois@vallourec.com',
      mill_name: 'Aulnoye-Aymeries Seamless Works',
      mill_address: 'Rue de l’Usine, 59620 Aulnoye-Aymeries, France',
      gst_tax_id: 'FR-849201938',
      status: 'Active',
    },
  });

  const s3 = await prisma.supplier.create({
    data: {
      supplier_id: 'SUP-003',
      supplier_name: 'JFE Steel Pipe Corporation',
      supplier_onboarding_date: new Date('2024-05-10'),
      supplier_address: '2-2-3 Uchisaiwaicho, Chiyoda-ku, Tokyo, Japan',
      contact_person: 'Kenji Sato',
      telephone_no: '+81 3 3597 3111',
      supplier_mail: 'k-sato@jfe-steel.co.jp',
      mill_name: 'Chita Pipe & Tube Works',
      mill_address: '1-1 Kawasaki-cho, Handa, Aichi, Japan',
      gst_tax_id: 'JP-901000100',
      status: 'Active',
    },
  });

  console.log('2. Seeding Products...');
  const p1 = await prisma.product.create({
    data: {
      product_id: 'PRD-001',
      product_description: '7" OD x 0.408" WT API 5CT L80 BTC Casing Pipe',
      size_od: 177.8, // 7.000 inches in mm
      wall_thickness: 10.36, // 0.408 inches in mm
      grade: 'L80',
      thread_type: 'BTC',
      cvn_requirement: '27J Min Avg @ -10°C',
      nominal_weight_kg_m: 43.15,
      uom: 'Meters',
    },
  });

  const p2 = await prisma.product.create({
    data: {
      product_id: 'PRD-002',
      product_description: '9-5/8" OD x 0.472" WT API 5CT P110 Premium Casing',
      size_od: 244.48, // 9.625 inches in mm
      wall_thickness: 11.99, // 0.472 inches in mm
      grade: 'P110',
      thread_type: 'Premium',
      cvn_requirement: '42J Min Avg @ -20°C',
      nominal_weight_kg_m: 69.94,
      uom: 'Meters',
    },
  });

  const p3 = await prisma.product.create({
    data: {
      product_id: 'PRD-003',
      product_description: '3-1/2" OD x 0.254" WT API 5CT J55 STC Tubing Pipe',
      size_od: 88.9, // 3.500 inches in mm
      wall_thickness: 6.45, // 0.254 inches in mm
      grade: 'J55',
      thread_type: 'STC',
      cvn_requirement: 'API 5CT Standard SR16',
      nominal_weight_kg_m: 13.84,
      uom: 'Meters',
    },
  });

  const p4 = await prisma.product.create({
    data: {
      product_id: 'PRD-004',
      product_description: '5-1/2" OD x 0.361" WT API 5CT L80 LTC Casing Pipe',
      size_od: 139.7, // 5.500 inches in mm
      wall_thickness: 9.17, // 0.361 inches in mm
      grade: 'L80',
      thread_type: 'LTC',
      cvn_requirement: '27J Min Avg @ -10°C',
      nominal_weight_kg_m: 29.76,
      uom: 'Meters',
    },
  });

  console.log('3. Seeding Purchase Orders...');
  const po1 = await prisma.purchaseOrder.create({
    data: {
      po_no: 'PO-2026-001',
      po_date: new Date('2026-08-10'),
      supplier_id: s1.supplier_id,
      shipping_address: 'Dock 4, Industrial Bay 2, Precision Tubular Hub, Port Terminal',
      delivery_date: new Date('2026-09-15'),
      payment_terms: '30% Advance, Net 60 Days',
      advance_amount: 50000.0,
      remaining_amount: 90000.0,
      po_status: 'Open',
    },
  });

  const poi1 = await prisma.pOItem.create({
    data: {
      po_item_id: 'POI-2026-001-A',
      po_no: po1.po_no,
      product_id: p1.product_id,
      ordered_qty: 2000.0,
      ordered_qty_mt: 86.3,
      unit_rate: 45.0,
      line_total: 90000.0,
      tolerable_variance_pct: 5.0,
      line_status: 'Partially Received',
    },
  });

  const poi2 = await prisma.pOItem.create({
    data: {
      po_item_id: 'POI-2026-001-B',
      po_no: po1.po_no,
      product_id: p4.product_id,
      ordered_qty: 1000.0,
      ordered_qty_mt: 29.76,
      unit_rate: 50.0,
      line_total: 50000.0,
      tolerable_variance_pct: 5.0,
      line_status: 'Fulfilled',
    },
  });

  console.log('4. Seeding GRN and Weighbridge Entry...');
  const grn1 = await prisma.gRN.create({
    data: {
      grn_id: 'GRN-2026-001',
      grn_date: new Date('2026-09-01'),
      po_no: po1.po_no,
      invoice_no: 'INV-TEN-90218',
      invoice_date: new Date('2026-08-25'),
      vehicle_transporter_no: 'TX-HAUL-8842',
      invoice_weight_mt: 42.5,
      actual_weighbridge_weight_mt: 42.38,
      weight_difference_mt: -0.12, // Actual - Invoice
      total_tubes_received_actual: 5,
      total_tubes_tally: 5,
      tally_match_status: 'Matched',
    },
  });

  const grni1 = await prisma.gRNItem.create({
    data: {
      grn_item_id: 'GRNI-2026-001-01',
      grn_id: grn1.grn_id,
      po_item_id: poi1.po_item_id,
      product_id: p1.product_id,
      invoice_quantity: 60.75, // meters
      received_quantity: 60.6,
      rejected_damaged_qty: 0.0,
      item_inspection_status: 'Accepted',
    },
  });

  console.log('5. Seeding Tally Sheet & Pipe-by-Pipe Items...');
  const ts1 = await prisma.tallySheet.create({
    data: {
      ts_id: 'TS-2026-001',
      grn_item_id: grni1.grn_item_id,
      lot_no: 'LOT-2026-A1',
      heat_no: 'HT-84920',
      mill_test_certificate_no: 'MTC-TEN-84920-REV2',
      tally_sheet_date: new Date('2026-09-01'),
      inspector_name: 'Marcus Vance (Level III NDT)',
      bundle_count: 2,
    },
  });

  // Tally Items with automatic cutting yield calculations
  // Tube 1: 12150 mm, Parting: 1500 mm => Exp: 8.1, Rnd: 8, Scrap: 150 mm
  const ti1 = await prisma.tallyItem.create({
    data: {
      ti_id: 'TAG-HT84920-001',
      ts_id: ts1.ts_id,
      tube_sr_no: 1,
      tube_length_mm: 12150.0,
      parting_length_mm: 1500.0,
      expected_qty: 8.1,
      rounded_qty: 8,
      end_scrap_mm: 150.0,
      pipe_allocation_status: 'Consumed',
    },
  });

  // Tube 2: 12200 mm, Parting: 1500 mm => Exp: 8.1333, Rnd: 8, Scrap: 200 mm
  const ti2 = await prisma.tallyItem.create({
    data: {
      ti_id: 'TAG-HT84920-002',
      ts_id: ts1.ts_id,
      tube_sr_no: 2,
      tube_length_mm: 12200.0,
      parting_length_mm: 1500.0,
      expected_qty: 8.1333,
      rounded_qty: 8,
      end_scrap_mm: 200.0,
      pipe_allocation_status: 'Allocated',
    },
  });

  // Tube 3: 11980 mm, Parting: 1500 mm => Exp: 7.9867, Rnd: 7, Scrap: 1480 mm
  const ti3 = await prisma.tallyItem.create({
    data: {
      ti_id: 'TAG-HT84920-003',
      ts_id: ts1.ts_id,
      tube_sr_no: 3,
      tube_length_mm: 11980.0,
      parting_length_mm: 1500.0,
      expected_qty: 7.9867,
      rounded_qty: 7,
      end_scrap_mm: 1480.0,
      pipe_allocation_status: 'Available',
    },
  });

  // Tube 4: 12050 mm, Parting: 1500 mm => Exp: 8.0333, Rnd: 8, Scrap: 50 mm
  const ti4 = await prisma.tallyItem.create({
    data: {
      ti_id: 'TAG-HT84920-004',
      ts_id: ts1.ts_id,
      tube_sr_no: 4,
      tube_length_mm: 12050.0,
      parting_length_mm: 1500.0,
      expected_qty: 8.0333,
      rounded_qty: 8,
      end_scrap_mm: 50.0,
      pipe_allocation_status: 'Available',
    },
  });

  // Tube 5: 12220 mm, Parting: 1500 mm => Exp: 8.1467, Rnd: 8, Scrap: 220 mm
  const ti5 = await prisma.tallyItem.create({
    data: {
      ti_id: 'TAG-HT84920-005',
      ts_id: ts1.ts_id,
      tube_sr_no: 5,
      tube_length_mm: 12220.0,
      parting_length_mm: 1500.0,
      expected_qty: 8.1467,
      rounded_qty: 8,
      end_scrap_mm: 220.0,
      pipe_allocation_status: 'Available',
    },
  });

  console.log('6. Seeding Work Orders...');
  const wo1 = await prisma.workOrder.create({
    data: {
      wo_id: 'WO-2026-001',
      wo_date: new Date('2026-09-02'),
      ti_id: ti1.ti_id,
      target_product_id: p1.product_id,
      planned_parts_to_produce: ti1.rounded_qty, // 8 parts
      machine_line_no: 'CNC-CELL-01',
      shift: 'Shift A',
      wo_status: 'Completed',
    },
  });

  const wo2 = await prisma.workOrder.create({
    data: {
      wo_id: 'WO-2026-002',
      wo_date: new Date('2026-09-03'),
      ti_id: ti2.ti_id,
      target_product_id: p1.product_id,
      planned_parts_to_produce: ti2.rounded_qty, // 8 parts
      machine_line_no: 'CNC-CELL-02',
      shift: 'Shift B',
      wo_status: 'In Progress',
    },
  });

  console.log('7. Seeding 8 Production Routing Stages for WO-2026-001...');
  // Operation 10: Cutting
  await prisma.productionPosting.create({
    data: {
      pp_id: 'PP-WO1-010',
      wo_id: wo1.wo_id,
      process_stage_name: 'Cutting',
      operation_seq_no: 10,
      operator_machine_id: 'BANDSAW-M01 / Op: J.Miller',
      input_quantity: 8,
      accepted_quantity: 8,
      rejected_quantity: 0,
      rework_quantity: 0,
    },
  });

  // Operation 20: ID Roughing
  await prisma.productionPosting.create({
    data: {
      pp_id: 'PP-WO1-020',
      wo_id: wo1.wo_id,
      process_stage_name: 'ID Roughing',
      operation_seq_no: 20,
      operator_machine_id: 'LATHE-ID-03 / Op: R.Patel',
      input_quantity: 8,
      accepted_quantity: 8,
      rejected_quantity: 0,
      rework_quantity: 0,
    },
  });

  // Operation 30: OD Roughing
  await prisma.productionPosting.create({
    data: {
      pp_id: 'PP-WO1-030',
      wo_id: wo1.wo_id,
      process_stage_name: 'OD Roughing',
      operation_seq_no: 30,
      operator_machine_id: 'LATHE-OD-02 / Op: R.Patel',
      input_quantity: 8,
      accepted_quantity: 8,
      rejected_quantity: 0,
      rework_quantity: 0,
    },
  });

  // Operation 40: Threading (1 defect detected! Balance Gate: In: 8 = Acc: 7 + Rej: 1 + Rew: 0)
  const ppThreading = await prisma.productionPosting.create({
    data: {
      pp_id: 'PP-WO1-040',
      wo_id: wo1.wo_id,
      process_stage_name: 'Threading',
      operation_seq_no: 40,
      operator_machine_id: 'CNC-THREAD-01 / Op: S.Chen',
      input_quantity: 8,
      accepted_quantity: 7,
      rejected_quantity: 1,
      rework_quantity: 0,
    },
  });

  // Rejection Posting for Threading
  await prisma.rejectionPosting.create({
    data: {
      rp_id: 'RP-2026-001',
      pp_id: ppThreading.pp_id,
      wo_id: wo1.wo_id,
      defect_category: 'Thread Flat',
      defect_quantity: 1,
      disposition_action: 'Rework Thread',
      inspector_remarks: 'Tool insert chipped at 3rd thread flank causing flat spot. Sent to rework bench.',
    },
  });

  // Operation 50: MPI (Magnetic Particle Inspection)
  await prisma.productionPosting.create({
    data: {
      pp_id: 'PP-WO1-050',
      wo_id: wo1.wo_id,
      process_stage_name: 'MPI',
      operation_seq_no: 50,
      operator_machine_id: 'BENCH-MPI-01 / Insp: M.Vance',
      input_quantity: 7,
      accepted_quantity: 7,
      rejected_quantity: 0,
      rework_quantity: 0,
    },
  });

  // Operation 60: Phosphating
  await prisma.productionPosting.create({
    data: {
      pp_id: 'PP-WO1-060',
      wo_id: wo1.wo_id,
      process_stage_name: 'Phosphating',
      operation_seq_no: 60,
      operator_machine_id: 'PHOSPHATE-BATH-A / Op: D.Koval',
      input_quantity: 7,
      accepted_quantity: 7,
      rejected_quantity: 0,
      rework_quantity: 0,
    },
  });

  // Operation 70: Painting
  await prisma.productionPosting.create({
    data: {
      pp_id: 'PP-WO1-070',
      wo_id: wo1.wo_id,
      process_stage_name: 'Painting',
      operation_seq_no: 70,
      operator_machine_id: 'SPRAY-BOOTH-02 / Op: A.Becker',
      input_quantity: 7,
      accepted_quantity: 7,
      rejected_quantity: 0,
      rework_quantity: 0,
    },
  });

  // Operation 80: Packing
  await prisma.productionPosting.create({
    data: {
      pp_id: 'PP-WO1-080',
      wo_id: wo1.wo_id,
      process_stage_name: 'Packing',
      operation_seq_no: 80,
      operator_machine_id: 'PACK-LINE-01 / Op: A.Becker',
      input_quantity: 7,
      accepted_quantity: 7,
      rejected_quantity: 0,
      rework_quantity: 0,
    },
  });

  console.log('8. Seeding Production Postings for WO-2026-002...');
  // Operation 10: Cutting
  await prisma.productionPosting.create({
    data: {
      pp_id: 'PP-WO2-010',
      wo_id: wo2.wo_id,
      process_stage_name: 'Cutting',
      operation_seq_no: 10,
      operator_machine_id: 'BANDSAW-M02 / Op: J.Miller',
      input_quantity: 8,
      accepted_quantity: 8,
      rejected_quantity: 0,
      rework_quantity: 0,
    },
  });

  // Operation 20: ID Roughing (Material fault defect found! In: 8 = Acc: 7 + Rej: 1 + Rew: 0)
  const ppID2 = await prisma.productionPosting.create({
    data: {
      pp_id: 'PP-WO2-020',
      wo_id: wo2.wo_id,
      process_stage_name: 'ID Roughing',
      operation_seq_no: 20,
      operator_machine_id: 'LATHE-ID-04 / Op: E.Stone',
      input_quantity: 8,
      accepted_quantity: 7,
      rejected_quantity: 1,
      rework_quantity: 0,
    },
  });

  // Rejection Posting for Material Fault (Scrap)
  await prisma.rejectionPosting.create({
    data: {
      rp_id: 'RP-2026-002',
      pp_id: ppID2.pp_id,
      wo_id: wo2.wo_id,
      defect_category: 'Material Fault (M.F.)',
      defect_quantity: 1,
      disposition_action: 'Scrap',
      inspector_remarks: 'Internal seam lamination opened up during boring cut. Non-reparable metallurgical defect.',
    },
  });

  console.log('Seed data successfully loaded across all 11 tables!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
