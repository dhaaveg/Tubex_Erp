// Automated verification for Customer Order thread dropdown options
const baseUrl = 'http://localhost:3000';

async function testCustomerOrderThreads() {
  console.log('Testing Customer Order thread types (BTC, LTC, STC, EUE, NU)...');

  const testPoNo = `CPO-TEST-TH-${Date.now().toString().slice(-6)}`;
  
  const payload = {
    customer_po_no: testPoNo,
    customer_name: 'Antigravity Energy Services Corp',
    order_date: new Date().toISOString(),
    payment_terms: 'Net 60 Days',
    delivery_terms: 'FOB Houston Port',
    delivery_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    remarks: 'Testing Thread Options: BTC, LTC, STC, EUE, NU',
    order_status: 'Open',
    items: [
      {
        size: '7 in (177.8 mm)',
        grade: 'L80',
        thread: 'BTC',
        quantity: 100,
        price_per_unit: 120
      },
      {
        size: '9-5/8 in (244.48 mm)',
        grade: 'P110',
        thread: 'LTC',
        quantity: 80,
        price_per_unit: 140
      },
      {
        size: '5-1/2 in (139.7 mm)',
        grade: 'J55',
        thread: 'STC',
        quantity: 120,
        price_per_unit: 95
      },
      {
        size: '2-7/8 in (73.02 mm)',
        grade: 'L80',
        thread: 'EUE',
        quantity: 250,
        price_per_unit: 110
      },
      {
        size: '2-3/8 in (60.32 mm)',
        grade: 'J55',
        thread: 'NU',
        quantity: 300,
        price_per_unit: 85
      }
    ]
  };

  console.log(`Creating test customer order: ${testPoNo}...`);
  const createRes = await fetch(`${baseUrl}/api/customer-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create customer order: ${createRes.status} ${createRes.statusText} - ${errorText}`);
  }

  const createdOrder = await createRes.json();
  console.log(`Created Order PO: ${createdOrder.customer_po_no}, Items count: ${createdOrder.items.length}`);

  // Verify threads
  const expectedThreads = ['BTC', 'LTC', 'STC', 'EUE', 'NU'];
  for (const expected of expectedThreads) {
    const itm = createdOrder.items.find(i => i.thread === expected);
    if (!itm) {
      throw new Error(`Expected thread option '${expected}' was not found in saved items!`);
    }
    console.log(`Verified line item with thread: ${itm.thread} (${itm.size}, ${itm.grade})`);
  }

  // Verify retrieval via search
  const searchRes = await fetch(`${baseUrl}/api/customer-orders?q=NU`);
  const searchResults = await searchRes.json();
  const matched = searchResults.find(o => o.customer_po_no === testPoNo);
  if (!matched) {
    throw new Error(`Search for query 'NU' did not find order ${testPoNo}`);
  }
  console.log(`Successfully searched and found order ${testPoNo} with thread query 'NU'!`);

  console.log('\n============================================================');
  console.log('CUSTOMER ORDER THREAD DROPDOWN TEST PASSED 100%!');
  console.log('============================================================');
}

testCustomerOrderThreads().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
