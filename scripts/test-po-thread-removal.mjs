// scripts/test-po-thread-removal.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  const setCookie = res.headers.get('set-cookie');
  let cookie = '';
  if (setCookie) {
    cookie = setCookie.split(';')[0];
  }
  return { status: res.status, data, cookie };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function run() {
  console.log('================================================================');
  console.log('🚀 TESTING PO MODULE: THREAD TYPE REMOVAL VERIFICATION');
  console.log('================================================================\n');

  // Step 1: Authentication
  console.log('--- STEP 1: Authenticate Super Admin ---');
  const authRes = await login('superadmin@energyoilfield.com', 'SuperAdmin@2026!');
  assert(authRes.status === 200, 'Super Admin logged in successfully');
  const cookie = authRes.cookie;

  // Step 2: Create new PO without any thread_type
  console.log('\n--- STEP 2: Create Purchase Order without thread_type on line items ---');
  const timestamp = Date.now();
  const testPoNo = `PO-TEST-NOTHREAD-${timestamp}`;

  const newPO = {
    po_no: testPoNo,
    po_date: new Date().toISOString().split('T')[0],
    supplier_id: 'SUP-001',
    shipping_address: 'Dock 4, Tubular Inwarding Yard',
    delivery_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    payment_terms: '30% Advance, Net 60 Days',
    delivery_terms: 'FOB Mill Yard',
    quality_stipulations: 'Raw pipe according to API 5CT specifications. Plain end only.',
    advance_amount: 1500,
    po_status: 'Draft',
    items: [
      {
        size_od: 177.8,
        grade: 'L80',
        wall_thickness: 10.36,
        schedule: 'Sch 80',
        cvn_requirement: '27J Min Avg @ -10°C',
        // Note: No thread_type provided!
        ordered_qty: 1000,
        ordered_qty_mt: 43.15,
        unit_rate: 45,
        tolerable_variance_pct: 5,
      },
      {
        size_od: 244.48,
        grade: 'P110',
        wall_thickness: 13.84,
        schedule: 'Sch 100',
        cvn_requirement: '42J Min Avg @ -20°C',
        // Note: No thread_type provided!
        ordered_qty: 800,
        ordered_qty_mt: 62.4,
        unit_rate: 55,
        tolerable_variance_pct: 5,
      },
    ],
  };

  const createRes = await fetch(`${BASE_URL}/api/purchase-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify(newPO),
  });

  const createData = await createRes.json();
  assert(createRes.status === 201, `PO created with status 201 Created (got ${createRes.status})`);
  assert(createData.po_no === testPoNo, `PO Number matches: ${createData.po_no}`);
  assert(createData.po_items?.length === 2, `Created 2 PO line items`);
  for (const item of createData.po_items) {
    assert(item.product != null, `Line ${item.po_item_id} resolved to product: ${item.product.product_description}`);
    console.log(`   - Product ID: ${item.product.product_id}, Desc: ${item.product.product_description}, Thread: ${item.product.thread_type}`);
  }

  // Step 3: Update PO without thread_type
  console.log('\n--- STEP 3: Update Purchase Order (PUT) without thread_type ---');
  const updatePayload = {
    ...createData,
    advance_amount: 2500,
    items: createData.po_items.map((item) => ({
      po_item_id: item.po_item_id,
      product_id: item.product_id,
      size_od: item.product?.size_od || item.size_od,
      grade: item.product?.grade || item.grade,
      wall_thickness: item.product?.wall_thickness || item.wall_thickness,
      cvn_requirement: item.product?.cvn_requirement || item.cvn_requirement,
      // No thread_type!
      ordered_qty: item.ordered_qty,
      ordered_qty_mt: item.ordered_qty_mt,
      unit_rate: item.unit_rate,
      tolerable_variance_pct: item.tolerable_variance_pct,
    })),
  };

  const updateRes = await fetch(`${BASE_URL}/api/purchase-orders`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify(updatePayload),
  });

  const updateData = await updateRes.json();
  assert(updateRes.status === 200, `PO updated with status 200 OK (got ${updateRes.status})`);
  assert(updateData.advance_amount === 2500, 'PO advance amount successfully updated');

  // Step 4: GET /api/purchase-orders
  console.log('\n--- STEP 4: Query Purchase Orders via GET ---');
  const getRes = await fetch(`${BASE_URL}/api/purchase-orders`, {
    headers: { Cookie: cookie },
  });
  const getList = await getRes.json();
  assert(getRes.status === 200, 'GET /api/purchase-orders returned 200 OK');
  assert(Array.isArray(getList), 'Returned array of POs');
  const foundPo = getList.find((p) => p.po_no === testPoNo);
  assert(foundPo != null, `Found created PO ${testPoNo} in listing`);
  assert(foundPo.po_items?.length === 2, 'PO contains both line items');

  console.log('\n================================================================');
  console.log('🎉 ALL TESTS PASSED: PO Thread Type Removal Verified Successfully!');
  console.log('================================================================\n');

  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
