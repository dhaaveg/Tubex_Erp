// scripts/test-po-no-preset-inheritance.mjs
import http from 'http';

async function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('Testing Purchase Order creation without Catalog Preset inheritance...');

  const poNo = `PO-TEST-${Date.now()}`;
  const newPO = {
    po_no: poNo,
    po_date: new Date().toISOString().split('T')[0],
    supplier_id: 'SUP-001',
    shipping_address: 'Main Tubular Yard, Dock 2',
    delivery_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    payment_terms: '30% Advance, Net 60',
    delivery_terms: 'FOB Mill Yard',
    advance_amount: 1000,
    po_status: 'Draft',
    items: [
      {
        size_od: 93.7,
        grade: 'L80',
        wall_thickness: 11.91,
        cvn_requirement: '27J Min Avg @ -10°C',
        thread_type: 'Plain End', // Explicitly raw unthreaded stock!
        ordered_qty: 250,
        ordered_qty_mt: 10.5,
        unit_rate: 65,
        tolerable_variance_pct: 5,
      },
    ],
  };

  const createRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/purchase-orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    newPO
  );

  console.log('Create PO Status:', createRes.status);
  if (createRes.status !== 201) {
    console.error('Create PO Failed:', createRes);
    process.exit(1);
  }

  const createdItem = createRes.data.po_items[0];
  console.log('Created PO Item:', {
    po_item_id: createdItem.po_item_id,
    product_id: createdItem.product_id,
    product_desc: createdItem.product?.product_description,
    thread_type: createdItem.product?.thread_type,
    size_od: createdItem.product?.size_od,
    grade: createdItem.product?.grade,
  });

  // Verify that it did NOT inherit PRD-012's 'Premium' thread!
  if (createdItem.product?.thread_type !== 'Plain End') {
    console.error(
      `FAILURE: Expected thread_type to be 'Plain End', but got '${createdItem.product?.thread_type}'! Preset inheritance is still occurring!`
    );
    process.exit(1);
  }

  console.log('SUCCESS: Thread was correctly saved as Plain End and was NOT automatically inherited from PRD-012 (Premium)!');

  // Clean up the test PO
  const delRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/purchase-orders?po_no=${encodeURIComponent(poNo)}`,
    method: 'DELETE',
  });
  console.log('Cleaned up test PO:', delRes.status);
  console.log('All tests PASSED!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
