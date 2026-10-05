// scripts/test-cvn-options.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

const CVN_OPTIONS = [
  'L-7-21J (21°C ± 3°C)',
  'L-10-27J (21°C ± 3°C)',
  'T-10-20J (21°C ± 3°C)',
  'L-7-43J (0°C ± 3°C)',
  'L-10-54J (0°C ± 3°C)',
  'T-10-27J (0°C ± 3°C)',
  'T-10-30J (0°C ± 3°C)',
  'T-10-32J (0°C ± 3°C)',
];

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
  console.log('🚀 TESTING STANDARDIZED CVN OPTIONS PERSISTENCE & VERIFICATION');
  console.log('================================================================\n');

  // Step 1: Login
  console.log('--- STEP 1: Authenticate Super Admin ---');
  const authRes = await login('superadmin@energyoilfield.com', 'SuperAdmin@2026!');
  assert(authRes.status === 200, 'Super Admin logged in successfully');
  const cookie = authRes.cookie;

  // Step 2: Fetch active suppliers
  const supRes = await fetch(`${BASE_URL}/api/suppliers?status=Active`, {
    headers: { Cookie: cookie },
  });
  const suppliers = await supRes.json();
  assert(suppliers.length > 0, 'Found at least one active supplier');
  const supplierId = suppliers[0].supplier_id;

  // Step 3: Create PO with all 8 standardized CVN specifications across line items
  console.log('\n--- STEP 2: Create Purchase Order testing all 8 standardized CVN specifications ---');
  const timestamp = Date.now();
  const testPoNo = `PO-TEST-CVN-${timestamp}`;

  const poPayload = {
    po_no: testPoNo,
    po_date: new Date().toISOString().split('T')[0],
    supplier_id: supplierId,
    shipping_address: 'Dock 4, Tubular Inwarding Yard, Precision Hub',
    delivery_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    payment_terms: '30% Advance, Net 60 Days',
    delivery_terms: 'FOB Mill Yard',
    advance_amount: 10000,
    quality_stipulations: 'Standard MTC 3.1 & CVN impact test certificates required.',
    po_status: 'Draft',
    items: CVN_OPTIONS.map((cvn, idx) => ({
      size_od: 177.8,
      wall_thickness: 10.36,
      grade: 'L80',
      cvn_requirement: cvn,
      ordered_qty: 100 * (idx + 1),
      ordered_qty_mt: 5.5 * (idx + 1),
      unit_rate: 50,
      tolerable_variance_pct: 5,
    })),
  };

  const createRes = await fetch(`${BASE_URL}/api/purchase-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify(poPayload),
  });

  const createdData = await createRes.json();
  assert(createRes.status === 201, `PO created successfully with status 201 (got ${createRes.status})`);
  assert(createdData.po_no === testPoNo, `PO Number matches ${testPoNo}`);
  assert(createdData.po_items.length === CVN_OPTIONS.length, `PO created with ${CVN_OPTIONS.length} line items`);

  console.log('\n--- STEP 3: Verify each line item persisted with exact CVN specification ---');
  for (let i = 0; i < CVN_OPTIONS.length; i++) {
    const expectedCvn = CVN_OPTIONS[i];
    const createdItem = createdData.po_items[i];
    const itemCvn = createdItem.product?.cvn_requirement || createdItem.cvn_requirement;
    assert(
      itemCvn === expectedCvn,
      `Item #${i + 1} cvn_requirement matches expected "${expectedCvn}" (got "${itemCvn}")`
    );
  }

  // Step 4: Fetch PO via GET and check line items
  console.log('\n--- STEP 4: Query Purchase Order via GET and verify persisted data ---');
  const getRes = await fetch(`${BASE_URL}/api/purchase-orders?q=${testPoNo}`, {
    headers: { Cookie: cookie },
  });
  const listData = await getRes.json();
  const fetchedPo = listData.find((p) => p.po_no === testPoNo);
  assert(!!fetchedPo, `Found ${testPoNo} in GET response`);
  assert(fetchedPo.po_items.length === CVN_OPTIONS.length, `Retrieved PO contains all ${CVN_OPTIONS.length} items`);

  fetchedPo.po_items.forEach((item, idx) => {
    const itemCvn = item.product?.cvn_requirement || item.cvn_requirement;
    assert(
      itemCvn === CVN_OPTIONS[idx],
      `GET item #${idx + 1} cvn_requirement correctly retrieved: "${itemCvn}"`
    );
  });

  // Step 5: Clean up test PO
  console.log('\n--- STEP 5: Cleanup Test PO ---');
  const delRes = await fetch(`${BASE_URL}/api/purchase-orders?po_no=${encodeURIComponent(testPoNo)}`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  assert(delRes.status === 200, 'Test PO deleted successfully during cleanup');

  console.log('\n================================================================');
  console.log('🎉 ALL CVN SPECIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

run()
  .catch((err) => {
    console.error('Fatal Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
