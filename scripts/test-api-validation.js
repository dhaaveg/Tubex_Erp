async function testApi() {
  console.log('--- Testing API Production Balance Gate Enforcement ---');

  // Case 1: Unbalanced quantities (Input: 10, Outputs: 8 + 1 + 0 = 9)
  const res1 = await fetch('http://localhost:3000/api/production-postings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pp_id: 'PP-TEST-FAIL-1',
      wo_id: 'WO-2026-002',
      process_stage_name: 'OD Roughing',
      operation_seq_no: 30,
      operator_machine_id: 'CNC-OD-01',
      input_quantity: 10,
      accepted_quantity: 8,
      rejected_quantity: 1,
      rework_quantity: 0,
    }),
  });
  const data1 = await res1.json();
  console.log('Unbalanced Payload HTTP Status:', res1.status);
  console.log('Response Error Message:', data1.error);
  if (res1.status === 400 && data1.error.includes('Production Balance Gate')) {
    console.log('✔ PASS: Production Balance Gate successfully blocked unbalanced posting!');
  }

  // Case 2: Rejected > 0 without defect breakdown
  const res2 = await fetch('http://localhost:3000/api/production-postings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pp_id: 'PP-TEST-FAIL-2',
      wo_id: 'WO-2026-002',
      process_stage_name: 'OD Roughing',
      operation_seq_no: 30,
      operator_machine_id: 'CNC-OD-01',
      input_quantity: 8,
      accepted_quantity: 7,
      rejected_quantity: 1,
      rework_quantity: 0,
      rejections: [], // Empty defect breakdown
    }),
  });
  const data2 = await res2.json();
  console.log('\nMissing Defect Breakdown HTTP Status:', res2.status);
  console.log('Response Error Message:', data2.error);
  if (res2.status === 400) {
    console.log('✔ PASS: Rejection defect requirement successfully blocked invalid submission!');
  }

  // Case 3: Valid posting with matching defect breakdown (8 = 7 + 1 + 0, defect qty: 1)
  const res3 = await fetch('http://localhost:3000/api/production-postings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pp_id: 'PP-TEST-PASS-1',
      wo_id: 'WO-2026-002',
      process_stage_name: 'OD Roughing',
      operation_seq_no: 30,
      operator_machine_id: 'CNC-OD-01 / Op: Lead',
      input_quantity: 8,
      accepted_quantity: 7,
      rejected_quantity: 1,
      rework_quantity: 0,
      rejections: [
        {
          defect_category: 'OD Undersize',
          defect_quantity: 1,
          disposition_action: 'Scrap',
          inspector_remarks: 'Tool deflection caused 0.8mm undersize on OD flank',
        },
      ],
    }),
  });
  const data3 = await res3.json();
  console.log('\nValid Balanced Payload HTTP Status:', res3.status);
  if (res3.status === 201 && data3.pp_id === 'PP-TEST-PASS-1') {
    console.log('✔ PASS: Balanced posting successfully accepted and saved with defect record!');
  }
}

testApi().catch(console.error);
