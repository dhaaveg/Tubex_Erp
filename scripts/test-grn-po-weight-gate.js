async function runTests() {
  console.log('=== Test Suite: PO Ordered MT vs Cumulative GRN Invoice MT Gate ===\n');

  // 1. Inspect PO-2026-003
  const poRes = await fetch('http://localhost:3000/api/purchase-orders');
  const pos = await poRes.json();
  const po = pos.find((p) => p.po_no === 'PO-2026-003');
  if (!po) throw new Error('PO-2026-003 not found');

  const poOrderedMtSum = po.po_items.reduce((s, i) => s + (Number(i.ordered_qty_mt) || 0), 0);
  console.log(`Target PO: ${po.po_no}`);
  console.log(`Total Ordered MT: ${poOrderedMtSum.toFixed(3)} MT`);

  const grnRes = await fetch('http://localhost:3000/api/grn');
  const grns = await grnRes.json();
  const existingGrnsForPo = grns.filter((g) => g.po_no === po.po_no);
  const existingInvoicedMt = existingGrnsForPo.reduce((s, g) => s + (Number(g.invoice_weight_mt) || 0), 0);
  console.log(`Existing GRNs Invoiced MT: ${existingInvoicedMt.toFixed(3)} MT`);
  const maxRemaining = poOrderedMtSum - existingInvoicedMt;
  console.log(`Allowable Remaining MT: ${maxRemaining.toFixed(3)} MT\n`);

  // Case 1: Try creating a GRN that exceeds the PO's total ordered MT (invoice_weight_mt: 10.00 MT)
  console.log('--- Test Case 1: Exceeding PO Ordered MT Limit ---');
  const excessivePayload = {
    grn_id: `GRN-TEST-OVER-${Date.now().toString().slice(-4)}`,
    grn_date: '2026-09-13',
    po_no: po.po_no,
    invoice_no: 'INV-TEST-EXCESS',
    invoice_date: '2026-09-13',
    vehicle_transporter_no: 'TRK-TEST-99',
    invoice_weight_mt: 10.0,
    actual_weighbridge_weight_mt: 9.98,
    total_tubes_received_actual: 50,
    items: [
      {
        po_item_id: po.po_items[0].po_item_id,
        product_id: po.po_items[0].product_id,
        invoice_quantity: 50,
        received_quantity: 50,
        rejected_damaged_qty: 0,
        item_inspection_status: 'Accepted',
      },
    ],
  };

  const res1 = await fetch('http://localhost:3000/api/grn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(excessivePayload),
  });
  const data1 = await res1.json();
  console.log(`Status: ${res1.status} (Expected: 400)`);
  console.log(`Response Error: ${data1.error}`);
  if (res1.status === 400 && data1.error.includes("exceeds PO PO-2026-003's Total Ordered Weight")) {
    console.log('✔ PASS: Excess weight was correctly rejected with HTTP 400 and detailed breakdown!\n');
  } else {
    throw new Error('Case 1 failed: Over-limit GRN was not rejected properly');
  }

  // Case 2: Create a GRN that fits cleanly within the remaining allowable MT (invoice_weight_mt: 3.50 MT)
  console.log('--- Test Case 2: Valid GRN Within Remaining MT ---');
  const testGrnId = `GRN-TEST-VALID-${Date.now().toString().slice(-4)}`;
  const validPayload = {
    grn_id: testGrnId,
    grn_date: '2026-09-13',
    po_no: po.po_no,
    invoice_no: 'INV-TEST-VALID-1',
    invoice_date: '2026-09-13',
    vehicle_transporter_no: 'TRK-TEST-VALID',
    invoice_weight_mt: 3.5,
    actual_weighbridge_weight_mt: 3.49,
    total_tubes_received_actual: 20,
    items: [
      {
        po_item_id: po.po_items[0].po_item_id,
        product_id: po.po_items[0].product_id,
        invoice_quantity: 20,
        received_quantity: 20,
        rejected_damaged_qty: 0,
        item_inspection_status: 'Accepted',
      },
    ],
  };

  const res2 = await fetch('http://localhost:3000/api/grn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  const data2 = await res2.json();
  console.log(`Status: ${res2.status} (Expected: 201)`);
  console.log(`Created GRN: ${data2.grn_id}`);
  if (res2.status === 201 && data2.grn_id === testGrnId) {
    console.log('✔ PASS: Valid GRN was accepted and persisted successfully!\n');
  } else {
    throw new Error('Case 2 failed: Valid GRN was not created');
  }

  // Case 3: Now that 42.5 + 3.5 = 46.0 MT is used, remaining is 48.285 - 46.0 = 2.285 MT.
  // Trying to add 3.0 MT must now fail!
  console.log('--- Test Case 3: Cumulative Multi-GRN Breach Check ---');
  const breachPayload = {
    grn_id: `GRN-TEST-BREACH-${Date.now().toString().slice(-4)}`,
    grn_date: '2026-09-13',
    po_no: po.po_no,
    invoice_no: 'INV-TEST-BREACH',
    invoice_date: '2026-09-13',
    vehicle_transporter_no: 'TRK-TEST-BREACH',
    invoice_weight_mt: 3.0,
    actual_weighbridge_weight_mt: 2.99,
    total_tubes_received_actual: 15,
    items: [
      {
        po_item_id: po.po_items[0].po_item_id,
        product_id: po.po_items[0].product_id,
        invoice_quantity: 15,
        received_quantity: 15,
        rejected_damaged_qty: 0,
        item_inspection_status: 'Accepted',
      },
    ],
  };

  const res3 = await fetch('http://localhost:3000/api/grn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(breachPayload),
  });
  const data3 = await res3.json();
  console.log(`Status: ${res3.status} (Expected: 400)`);
  console.log(`Response Error: ${data3.error}`);
  if (res3.status === 400 && data3.error.includes("exceeds PO PO-2026-003's Total Ordered Weight")) {
    console.log('✔ PASS: Cumulative multi-GRN limit accurately caught and blocked!\n');
  } else {
    throw new Error('Case 3 failed: Cumulative breach was not caught');
  }

  console.log('=== All 3 Gate Enforcement Tests Passed Successfully! ===');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
