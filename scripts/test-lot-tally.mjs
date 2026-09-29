// Automated verification for Lot-by-Lot Dimensional Inwarding with Multi-Heat & Multi-Lot Support
const baseUrl = 'http://localhost:3000';

async function main() {
  console.log('Testing Lot-by-Lot Tally Sheet API...');

  // 1. Fetch GRNs to pick an existing GRN item
  const grnRes = await fetch(`${baseUrl}/api/grn`);
  if (!grnRes.ok) {
    throw new Error(`Failed to fetch GRNs: ${grnRes.statusText}`);
  }
  const grns = await grnRes.json();
  console.log(`Fetched ${grns.length} GRNs.`);
  
  if (grns.length === 0) {
    throw new Error('No GRNs found to test with.');
  }

  const grn = grns[0];
  console.log(`Using GRN: ${grn.grn_id}`);
  
  if (!grn.grn_items || grn.grn_items.length === 0) {
    throw new Error('GRN has no grn_items.');
  }

  const grnItem = grn.grn_items[0];
  console.log(`Using GRN Item: ID ${grnItem.grn_item_id}, Product: ${grnItem.product?.product_description}`);

  // 2. Create a Lot Tally Sheet with:
  // - Multi-Heat (HT-ALPHA-100 and HT-BETA-200)
  // - Multi-Lot (LOT-A1, LOT-A2 under HT-ALPHA-100, and LOT-B1 under HT-BETA-200)
  // - Total tube length per lot:
  //   Lot 1: 5 tubes, 60750 mm total, parting length 135 mm -> 450 parts, 0 scrap
  //   Lot 2: 5 tubes, 60800 mm total, parting length 135 mm -> 450 parts, 50 mm scrap
  //   Lot 3: 10 tubes, 121500 mm total, parting length 135 mm -> 900 parts, 0 scrap
  const uniqueId = Date.now().toString().slice(-6);
  const tallyPayload = {
    ts_id: `TS-TEST-${uniqueId}`,
    grn_item_id: grnItem.grn_item_id,
    heat_no: 'HT-ALPHA-100', // default header
    lot_no: 'LOT-A1',
    mill_test_certificate_no: 'MTC-991',
    tally_sheet_date: new Date().toISOString(),
    inspector_name: 'Antigravity Test Engineer',
    bundle_count: 3,
    tally_items: [
      {
        ti_id: `LOT-HT-ALPHA-100-LOT-A1-${uniqueId}`,
        tube_sr_no: 1,
        heat_no: 'HT-ALPHA-100',
        lot_no: 'LOT-A1',
        mill_test_certificate_no: 'MTC-991',
        tube_count: 5,
        tube_length_mm: 60750,
        parting_length_mm: 135,
      },
      {
        ti_id: `LOT-HT-ALPHA-100-LOT-A2-${uniqueId}`,
        tube_sr_no: 2,
        heat_no: 'HT-ALPHA-100',
        lot_no: 'LOT-A2',
        mill_test_certificate_no: 'MTC-991',
        tube_count: 5,
        tube_length_mm: 60800,
        parting_length_mm: 135,
      },
      {
        ti_id: `LOT-HT-BETA-200-LOT-B1-${uniqueId}`,
        tube_sr_no: 3,
        heat_no: 'HT-BETA-200',
        lot_no: 'LOT-B1',
        mill_test_certificate_no: 'MTC-992',
        tube_count: 10,
        tube_length_mm: 121500,
        parting_length_mm: 135,
      }
    ]
  };

  console.log('Posting new lot tally sheet payload...');
  const postRes = await fetch(`${baseUrl}/api/tally`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tallyPayload)
  });

  if (!postRes.ok) {
    const errorText = await postRes.text();
    throw new Error(`Failed to create tally sheet: ${postRes.status} ${postRes.statusText} - ${errorText}`);
  }

  const createdTally = await postRes.json();
  console.log(`Created Tally Sheet: ${createdTally.ts_id}`);
  console.log(`Total Lot Items: ${createdTally.tally_items.length}`);

  // 3. Verify Item Calculations
  const item1 = createdTally.tally_items.find(i => i.lot_no === 'LOT-A1');
  const item2 = createdTally.tally_items.find(i => i.lot_no === 'LOT-A2');
  const item3 = createdTally.tally_items.find(i => i.lot_no === 'LOT-B1');

  console.log('Verifying Lot 1 (5 tubes, 60750mm total, 135mm parting):', {
    heat_no: item1.heat_no,
    lot_no: item1.lot_no,
    tube_count: item1.tube_count,
    rounded_qty: item1.rounded_qty,
    end_scrap_mm: item1.end_scrap_mm,
    avg_per_tube: item1.tube_length_mm / item1.tube_count
  });

  if (item1.rounded_qty !== 450) throw new Error(`Expected 450 parts for Lot 1, got ${item1.rounded_qty}`);
  if (item1.end_scrap_mm !== 0) throw new Error(`Expected 0 scrap for Lot 1, got ${item1.end_scrap_mm}`);
  if (item1.tube_count !== 5) throw new Error(`Expected tube_count=5 for Lot 1, got ${item1.tube_count}`);

  console.log('Verifying Lot 2 (5 tubes, 60800mm total, 135mm parting):', {
    heat_no: item2.heat_no,
    lot_no: item2.lot_no,
    tube_count: item2.tube_count,
    rounded_qty: item2.rounded_qty,
    end_scrap_mm: item2.end_scrap_mm,
    avg_per_tube: item2.tube_length_mm / item2.tube_count
  });

  if (item2.rounded_qty !== 450) throw new Error(`Expected 450 parts for Lot 2, got ${item2.rounded_qty}`);
  if (item2.end_scrap_mm !== 50) throw new Error(`Expected 50mm scrap for Lot 2, got ${item2.end_scrap_mm}`);
  if (item2.tube_count !== 5) throw new Error(`Expected tube_count=5 for Lot 2, got ${item2.tube_count}`);

  console.log('Verifying Lot 3 (10 tubes, 121500mm total, 135mm parting):', {
    heat_no: item3.heat_no,
    lot_no: item3.lot_no,
    tube_count: item3.tube_count,
    rounded_qty: item3.rounded_qty,
    end_scrap_mm: item3.end_scrap_mm,
    avg_per_tube: item3.tube_length_mm / item3.tube_count
  });

  if (item3.rounded_qty !== 900) throw new Error(`Expected 900 parts for Lot 3, got ${item3.rounded_qty}`);
  if (item3.end_scrap_mm !== 0) throw new Error(`Expected 0 scrap for Lot 3, got ${item3.end_scrap_mm}`);
  if (item3.tube_count !== 10) throw new Error(`Expected tube_count=10 for Lot 3, got ${item3.tube_count}`);

  // 4. Verify Parent GRN aggregation (sum of tube_count = 5 + 5 + 10 = 20)
  const refetchedGrnRes = await fetch(`${baseUrl}/api/grn`);
  const refetchedGrns = await refetchedGrnRes.json();
  const updatedGrn = refetchedGrns.find(g => g.grn_id === grn.grn_id);
  console.log(`Parent GRN total_tubes_tally: ${updatedGrn.total_tubes_tally} (Summed tube count across all lots)`);
  if (updatedGrn.total_tubes_tally < 20) {
    throw new Error(`Expected total_tubes_tally >= 20, got ${updatedGrn.total_tubes_tally}`);
  }

  // 5. Test Search by Heat No and Lot No via GET /api/tally
  const searchHeatRes = await fetch(`${baseUrl}/api/tally?search=HT-BETA-200`);
  const searchHeatData = await searchHeatRes.json();
  const foundSheet = searchHeatData.find(s => s.ts_id === createdTally.ts_id);
  if (!foundSheet) throw new Error('Failed to find tally sheet by search query HT-BETA-200');
  console.log(`Successfully searched and found tally sheet by heat number HT-BETA-200!`);

  // 6. Test GET /api/tally with grn_item_id filter
  const grnTallyRes = await fetch(`${baseUrl}/api/tally?grn_item_id=${grnItem.grn_item_id}`);
  const grnTallyData = await grnTallyRes.json();
  if (!grnTallyData.some(s => s.ts_id === createdTally.ts_id)) {
    throw new Error('Failed to retrieve tally sheet by grn_item_id');
  }
  console.log(`Successfully retrieved tally sheet by grn_item_id!`);

  console.log('\n============================================================');
  console.log('ALL LOT-BY-LOT TALLY SHEET VERIFICATIONS PASSED 100%!');
  console.log('============================================================');
}

main().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
