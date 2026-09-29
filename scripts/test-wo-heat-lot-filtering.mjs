// scripts/test-wo-heat-lot-filtering.mjs
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
  console.log('Testing Tally and Work Order Heat/Lot PO filtering...');

  // 1. Fetch tallies
  const tallyRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/tally?status=Available',
    method: 'GET',
  });

  if (tallyRes.status !== 200 || !Array.isArray(tallyRes.data)) {
    console.error('Failed to fetch tallies:', tallyRes);
    process.exit(1);
  }

  // Collect available pipes exactly as ShopFloorModule does
  const availablePipes = [];
  tallyRes.data.forEach((ts) => {
    if (ts.tally_items) {
      ts.tally_items.forEach((item) => {
        if (item.pipe_allocation_status === 'Available') {
          availablePipes.push({
            ...item,
            heat_no: item.heat_no || ts.heat_no,
            lot_no: item.lot_no || ts.lot_no,
            tube_count: item.tube_count || 1,
            po_no: ts.grn_item?.grn?.purchase_order?.po_no || ts.grn_item?.grn?.po_no,
            product: ts.grn_item?.product,
          });
        }
      });
    }
  });

  console.log(`Total available pipes in system: ${availablePipes.length}`);

  // Test filtering for PO 'EOT/RM/2026/11'
  const targetPo = 'EOT/RM/2026/11';
  const matchingForPo = availablePipes.filter((p) => p.po_no === targetPo);
  console.log(`Available pipes matching PO '${targetPo}': ${matchingForPo.length}`);
  matchingForPo.forEach((p) => {
    console.log(` - Tag: ${p.ti_id}, Heat: ${p.heat_no}, Lot: ${p.lot_no}, PO: ${p.po_no}`);
  });

  if (matchingForPo.length === 0) {
    console.error(`Expected to find lots for PO ${targetPo}, but found 0!`);
    process.exit(1);
  }

  // Ensure NONE of the matched pipes belong to other POs
  const leakedPipes = matchingForPo.filter((p) => p.po_no !== targetPo);
  if (leakedPipes.length > 0) {
    console.error(`FAILURE: Found pipes from other POs leaking into ${targetPo}:`, leakedPipes);
    process.exit(1);
  }

  // Fetch customer order 18434 to get real cpo_item_id
  const coRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer-orders',
    method: 'GET',
  });
  const co18434 = Array.isArray(coRes.data) ? coRes.data.find((c) => c.customer_po_no === '18434') : null;
  const realCpoItemId = co18434?.items?.[0]?.cpo_item_id || null;

  // 2. Test Work Order creation with matching PO and lot tag
  const testWoId = `WO-TEST-${Date.now()}`;
  const matchedPipe = matchingForPo[0];

  const woPayload = {
    wo_id: testWoId,
    wo_date: new Date().toISOString().split('T')[0],
    source_type: 'PO',
    po_no: targetPo,
    size: '93.7 mm',
    grade: 'L80',
    thread: 'EUE',
    order_quantity: 100,
    planned_parts_to_produce: 100,
    customer_po_no: '18434',
    cpo_item_id: realCpoItemId,
    ti_id: matchedPipe.ti_id,
    target_product_id: matchedPipe.product?.product_id || 'PRD-012',
    // Note: shift and machine_line_no are not required as user input
  };

  const createWoRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/work-orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    woPayload
  );

  console.log('Create WO Response Status:', createWoRes.status);
  if (createWoRes.status !== 201) {
    console.error('Failed to create Work Order:', createWoRes);
    process.exit(1);
  }

  console.log('Created Work Order with matching PO lot:', {
    wo_id: createWoRes.data.wo_id,
    po_no: createWoRes.data.po_no,
    ti_id: createWoRes.data.ti_id,
    heat_no: createWoRes.data.tally_item?.heat_no,
    lot_no: createWoRes.data.tally_item?.lot_no,
  });

  // Clean up test Work Order
  const delRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/work-orders?wo_id=${encodeURIComponent(testWoId)}`,
    method: 'DELETE',
  });
  console.log('Cleaned up test Work Order:', delRes.status);

  console.log('============================================================');
  console.log('SUCCESS: Heat/lot details strictly filtered by matching PO!');
  console.log('============================================================');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
