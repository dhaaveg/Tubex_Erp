function validateProductionBalance(inputQuantity, acceptedQuantity, rejectedQuantity, reworkQuantity = 0) {
  const sumOfOutputs = acceptedQuantity + rejectedQuantity + reworkQuantity;
  const delta = inputQuantity - sumOfOutputs;

  if (delta !== 0) {
    return {
      isBalanced: false,
      delta,
      errorMessage: `Production Balance Violation: "Input Qty" (${inputQuantity}) - "Rejected Qty" (${rejectedQuantity}) must equal "Accepted Qty" (${acceptedQuantity}). (Mismatch delta: ${delta > 0 ? '+' : ''}${delta})`,
    };
  }

  return {
    isBalanced: true,
    delta: 0,
  };
}

async function main() {
  console.log('================================================================');
  console.log(' TESTING "Input Qty" - "Rejected Qty" = "Accepted Qty" BALANCE ');
  console.log('================================================================');

  // Test 1: Function logic verification
  console.log('\n--- 1. Testing validateProductionBalance Function ---');
  const check1 = validateProductionBalance(2000, 2000, 0, 0);
  console.log('Input: 2000, Rej: 0 => Acc: 2000 -> Balanced:', check1.isBalanced);
  if (!check1.isBalanced) throw new Error('Test 1 failed');

  const check2 = validateProductionBalance(2000, 1950, 50, 0);
  console.log('Input: 2000, Rej: 50 => Acc: 1950 (2000 - 50 = 1950) -> Balanced:', check2.isBalanced);
  if (!check2.isBalanced) throw new Error('Test 2 failed');

  const check3 = validateProductionBalance(2000, 1900, 50, 0);
  console.log('Input: 2000, Rej: 50, Acc: 1900 (Mismatch) -> Balanced:', check3.isBalanced, 'Message:', check3.errorMessage);
  if (check3.isBalanced) throw new Error('Test 3 failed: should be unbalanced');

  // Test 2: Live API test
  console.log('\n--- 2. Testing Live API /api/production-postings ---');
  
  // First fetch an existing Work Order to test against
  const woRes = await fetch('http://localhost:3000/api/work-orders');
  const wos = await woRes.json();
  if (!wos || wos.length === 0) {
    console.log('No work orders found to test live posting against.');
    return;
  }
  const testWo = wos[0];
  console.log('Testing with Work Order:', testWo.wo_id);

  const testPpId = `PP-TEST-${Date.now()}`;
  const validPayload = {
    pp_id: testPpId,
    wo_id: testWo.wo_id,
    process_stage_name: 'Cutting',
    operation_seq_no: 10,
    operator_machine_id: 'CNC-CELL-01 / Op: Lead',
    input_quantity: 100,
    rejected_quantity: 10,
    accepted_quantity: 90, // 100 - 10 = 90
    rework_quantity: 0,
    rejections: [
      {
        defect_category: 'Thread Flat',
        defect_quantity: 10,
        disposition_action: 'Rework Thread',
        inspector_remarks: 'Test rejection',
      },
    ],
  };

  const postRes = await fetch('http://localhost:3000/api/production-postings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });

  const postData = await postRes.json();
  console.log('POST status:', postRes.status);
  if (postRes.status !== 200 && postRes.status !== 201) {
    console.error('POST Error:', postData);
  } else {
    console.log('Created posting successfully:', postData.pp_id, 'Input:', postData.input_quantity, 'Rej:', postData.rejected_quantity, 'Acc:', postData.accepted_quantity);

    // Clean up
    const delRes = await fetch(`http://localhost:3000/api/production-postings?pp_id=${encodeURIComponent(testPpId)}`, {
      method: 'DELETE',
    });
    console.log('Cleaned up test posting:', delRes.status);
  }

  // Test unbalanced payload
  const invalidPayload = {
    ...validPayload,
    pp_id: `PP-TEST-INV-${Date.now()}`,
    input_quantity: 100,
    rejected_quantity: 10,
    accepted_quantity: 95, // Mismatch: 100 - 10 != 95
  };

  const invalidRes = await fetch('http://localhost:3000/api/production-postings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invalidPayload),
  });
  console.log('Unbalanced POST status (expected 400):', invalidRes.status);
  const invData = await invalidRes.json();
  console.log('Gate rejection message:', invData.error);
  if (invalidRes.status !== 400) {
    throw new Error('Expected 400 for unbalanced payload');
  }

  console.log('\n================================================================');
  console.log(' SUCCESS: "Input Qty" - "Rejected Qty" = "Accepted Qty" VERIFIED! ');
  console.log('================================================================');
}

main();
