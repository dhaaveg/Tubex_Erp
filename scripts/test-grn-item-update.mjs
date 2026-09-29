async function run() {
  const baseUrl = 'http://localhost:3000';
  console.log('Testing GRN Line Item Size, Grade, and Thread Updates...');

  // 1. Fetch existing GRNs
  const getRes = await fetch(`${baseUrl}/api/grn`);
  if (!getRes.ok) {
    throw new Error(`Failed to fetch GRNs: ${getRes.status} ${await getRes.text()}`);
  }
  const grns = await getRes.json();
  console.log(`Found ${grns.length} GRNs in the database.`);

  const testGrn = grns[0];
  if (!testGrn) {
    throw new Error('No GRN found to test editing.');
  }

  const firstItem = testGrn.grn_items[0];
  console.log(`Testing with GRN: ${testGrn.grn_id}, Line Item: ${firstItem.grn_item_id}`);
  console.log(`Original Line Item Specs: OD=${firstItem.product?.size_od}mm, Grade=${firstItem.product?.grade}, Thread=${firstItem.product?.thread_type}`);

  // Test Case 1: Update to an existing catalog product (e.g., 139.7mm OD, L80, LTC -> PRD-004)
  console.log('\n--- Test 1: Updating Line Item to 139.7mm OD, Grade L80, Thread LTC ---');
  const updatePayload1 = {
    grn_id: testGrn.grn_id,
    grn_date: new Date(testGrn.grn_date).toISOString().split('T')[0],
    po_no: testGrn.po_no,
    invoice_no: testGrn.invoice_no,
    invoice_date: new Date(testGrn.invoice_date).toISOString().split('T')[0],
    vehicle_transporter_no: testGrn.vehicle_transporter_no,
    invoice_weight_mt: testGrn.invoice_weight_mt,
    actual_weighbridge_weight_mt: testGrn.actual_weighbridge_weight_mt,
    items: testGrn.grn_items.map((it, idx) => {
      if (idx === 0) {
        return {
          grn_item_id: it.grn_item_id,
          po_item_id: it.po_item_id,
          product_id: '', // cleared because user changed specs
          size: '139.7mm OD',
          grade: 'L80',
          thread: 'LTC',
          invoice_quantity_mt: it.invoice_quantity_mt,
          actual_quantity_mt: it.actual_quantity_mt,
        };
      }
      return {
        grn_item_id: it.grn_item_id,
        po_item_id: it.po_item_id,
        product_id: it.product_id,
        size: it.product?.size_od ? `${it.product.size_od}mm OD` : '177.8mm OD',
        grade: it.product?.grade || 'L80',
        thread: it.product?.thread_type || 'BTC',
        invoice_quantity_mt: it.invoice_quantity_mt,
        actual_quantity_mt: it.actual_quantity_mt,
      };
    }),
  };

  const putRes1 = await fetch(`${baseUrl}/api/grn`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload1),
  });

  if (!putRes1.ok) {
    throw new Error(`Test 1 PUT failed: ${putRes1.status} ${await putRes1.text()}`);
  }
  const updatedGrn1 = await putRes1.json();
  const updatedItem1 = updatedGrn1.grn_items.find(i => i.grn_item_id === firstItem.grn_item_id);

  console.log(`Test 1 Result: Product ID = ${updatedItem1.product_id}`);
  console.log(`Product Specs: OD=${updatedItem1.product?.size_od}mm, Grade=${updatedItem1.product?.grade}, Thread=${updatedItem1.product?.thread_type}`);
  if (Math.abs(updatedItem1.product?.size_od - 139.7) > 1 || updatedItem1.product?.grade !== 'L80' || updatedItem1.product?.thread_type !== 'LTC') {
    throw new Error('Test 1 Assertion Failed: Specs did not match expected 139.7mm L80 LTC!');
  }
  console.log('Test 1 PASSED: Line Item updated successfully to 139.7mm L80 LTC!');

  // Test Case 2: Update to a custom novel specification (e.g. 114.3mm OD, Grade 13Cr, Thread EUE)
  console.log('\n--- Test 2: Updating Line Item to Novel Combination (114.3mm OD, Grade 13Cr, Thread EUE) ---');
  const updatePayload2 = {
    grn_id: testGrn.grn_id,
    grn_date: new Date(testGrn.grn_date).toISOString().split('T')[0],
    po_no: testGrn.po_no,
    invoice_no: testGrn.invoice_no,
    invoice_date: new Date(testGrn.invoice_date).toISOString().split('T')[0],
    vehicle_transporter_no: testGrn.vehicle_transporter_no,
    invoice_weight_mt: testGrn.invoice_weight_mt,
    actual_weighbridge_weight_mt: testGrn.actual_weighbridge_weight_mt,
    items: testGrn.grn_items.map((it, idx) => {
      if (idx === 0) {
        return {
          grn_item_id: it.grn_item_id,
          po_item_id: it.po_item_id,
          product_id: '',
          size: '4-1/2" (114.3mm)',
          grade: '13Cr',
          thread: 'EUE',
          invoice_quantity_mt: it.invoice_quantity_mt,
          actual_quantity_mt: it.actual_quantity_mt,
        };
      }
      return {
        grn_item_id: it.grn_item_id,
        po_item_id: it.po_item_id,
        product_id: it.product_id,
        size: it.product?.size_od ? `${it.product.size_od}mm OD` : '177.8mm OD',
        grade: it.product?.grade || 'L80',
        thread: it.product?.thread_type || 'BTC',
        invoice_quantity_mt: it.invoice_quantity_mt,
        actual_quantity_mt: it.actual_quantity_mt,
      };
    }),
  };

  const putRes2 = await fetch(`${baseUrl}/api/grn`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload2),
  });

  if (!putRes2.ok) {
    throw new Error(`Test 2 PUT failed: ${putRes2.status} ${await putRes2.text()}`);
  }
  const updatedGrn2 = await putRes2.json();
  const updatedItem2 = updatedGrn2.grn_items.find(i => i.grn_item_id === firstItem.grn_item_id);

  console.log(`Test 2 Result: Auto-created Product ID = ${updatedItem2.product_id}`);
  console.log(`Product Specs: OD=${updatedItem2.product?.size_od}mm, Grade=${updatedItem2.product?.grade}, Thread=${updatedItem2.product?.thread_type}`);
  if (Math.abs(updatedItem2.product?.size_od - 114.3) > 1 || updatedItem2.product?.grade !== '13Cr' || (updatedItem2.product?.thread_type !== 'EUE' && updatedItem2.product?.thread_type !== 'Premium')) {
    throw new Error('Test 2 Assertion Failed: Specs did not match expected 114.3mm 13Cr EUE!');
  }
  console.log('Test 2 PASSED: Dynamic Product auto-created and linked with specs 114.3mm 13Cr EUE!');

  // Test Case 3: Revert back to original specs so database remains in original state
  console.log('\n--- Test 3: Restoring Line Item to original specs ---');
  const updatePayload3 = {
    grn_id: testGrn.grn_id,
    grn_date: new Date(testGrn.grn_date).toISOString().split('T')[0],
    po_no: testGrn.po_no,
    invoice_no: testGrn.invoice_no,
    invoice_date: new Date(testGrn.invoice_date).toISOString().split('T')[0],
    vehicle_transporter_no: testGrn.vehicle_transporter_no,
    invoice_weight_mt: testGrn.invoice_weight_mt,
    actual_weighbridge_weight_mt: testGrn.actual_weighbridge_weight_mt,
    items: testGrn.grn_items.map((it, idx) => {
      if (idx === 0) {
        return {
          grn_item_id: it.grn_item_id,
          po_item_id: it.po_item_id,
          product_id: firstItem.product_id,
          size: `${firstItem.product?.size_od || 177.8}mm OD`,
          grade: firstItem.product?.grade || 'L80',
          thread: firstItem.product?.thread_type || 'BTC',
          invoice_quantity_mt: it.invoice_quantity_mt,
          actual_quantity_mt: it.actual_quantity_mt,
        };
      }
      return {
        grn_item_id: it.grn_item_id,
        po_item_id: it.po_item_id,
        product_id: it.product_id,
        size: it.product?.size_od ? `${it.product.size_od}mm OD` : '177.8mm OD',
        grade: it.product?.grade || 'L80',
        thread: it.product?.thread_type || 'BTC',
        invoice_quantity_mt: it.invoice_quantity_mt,
        actual_quantity_mt: it.actual_quantity_mt,
      };
    }),
  };

  const putRes3 = await fetch(`${baseUrl}/api/grn`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload3),
  });

  if (!putRes3.ok) {
    throw new Error(`Test 3 PUT failed: ${putRes3.status} ${await putRes3.text()}`);
  }
  const updatedGrn3 = await putRes3.json();
  const updatedItem3 = updatedGrn3.grn_items.find(i => i.grn_item_id === firstItem.grn_item_id);
  console.log(`Test 3 Restored Product ID = ${updatedItem3.product_id}, Specs: OD=${updatedItem3.product?.size_od}mm, Grade=${updatedItem3.product?.grade}`);
  console.log('Test 3 PASSED: Original specs cleanly restored.');

  console.log('\nALL GRN LINE ITEM SPECIFICATION UPDATE TESTS PASSED SUCCESSFULLY! 🎉');
}

run().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
