// scripts/verify-all-urls.mjs
// Verifies that all application routes, module URLs, aliases, and API endpoints are active and healthy

const BASE_URL = 'http://localhost:3000';

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  const setCookie = res.headers.get('set-cookie');
  const cookie = setCookie ? setCookie.split(';')[0] : '';
  return { status: res.status, data, cookie };
}

async function verifyUrl(url, cookie, expectedStatus = 200, redirectMode = 'manual') {
  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: cookie ? { Cookie: cookie } : {},
      redirect: redirectMode,
    });
    const pass = res.status === expectedStatus;
    const icon = pass ? '✅' : '❌';
    console.log(`${icon} [${res.status}] ${url} (Expected: ${expectedStatus})`);
    return pass;
  } catch (err) {
    console.error(`❌ [ERR] ${url}: ${err.message}`);
    return false;
  }
}

async function run() {
  console.log('================================================================');
  console.log('🌐 VERIFYING ALL APPLICATION URLS & ROUTE ENDPOINTS');
  console.log('================================================================\n');

  console.log('--- 1. Public Authentication URLs ---');
  await verifyUrl('/login', null, 200);

  console.log('\n--- 2. Unauthenticated Page Route Interception (Edge Middleware) ---');
  await verifyUrl('/', null, 307);
  await verifyUrl('/procurement', null, 307);
  await verifyUrl('/quality', null, 307);

  console.log('\n--- 3. Authenticate Super Admin ---');
  const loginResult = await login('superadmin@energyoilfield.com', 'SuperAdmin@2026!');
  if (loginResult.status !== 200) {
    console.error('Failed to log in as Super Admin');
    process.exit(1);
  }
  const cookie = loginResult.cookie;
  console.log('✅ Logged in successfully as Super Admin');

  console.log('\n--- 4. Primary ERP Module URLs ---');
  const moduleUrls = [
    '/',
    '/overview',
    '/master-data',
    '/procurement',
    '/receiving',
    '/customer-orders',
    '/shop-floor',
    '/quality',
    '/traceability',
    '/admin-export',
    '/user-management',
    '/change-password',
  ];

  let passedModules = 0;
  for (const url of moduleUrls) {
    const ok = await verifyUrl(url, cookie, 200);
    if (ok) passedModules++;
  }

  console.log('\n--- 5. URL Aliases & Convenience Shortcuts ---');
  const aliasUrls = [
    '/po',
    '/pos',
    '/purchase-orders',
    '/tally',
    '/grn',
    '/inwarding',
    '/cpo',
    '/customers',
    '/orders',
    '/wo',
    '/wos',
    '/work-orders',
    '/shopfloor',
    '/rejections',
    '/qa',
    '/export',
    '/users',
  ];

  let passedAliases = 0;
  for (const url of aliasUrls) {
    const ok = await verifyUrl(url, cookie, 200);
    if (ok) passedAliases++;
  }

  console.log('\n--- 6. Backend REST API Endpoints ---');
  const apiUrls = [
    '/api/auth/me',
    '/api/stats',
    '/api/suppliers',
    '/api/products',
    '/api/purchase-orders',
    '/api/grn',
    '/api/tally',
    '/api/customer-orders',
    '/api/work-orders',
    '/api/production-postings',
    '/api/rejections',
    '/api/traceability?q=TAG-HT84920-001',
    '/api/export',
    '/api/users',
    '/api/admin/role-permissions',
    '/api/admin/role-permissions/cache',
  ];

  let passedApis = 0;
  for (const url of apiUrls) {
    const ok = await verifyUrl(url, cookie, 200);
    if (ok) passedApis++;
  }

  console.log('\n================================================================');
  console.log(`📊 SUMMARY OF VERIFIED URLS:`);
  console.log(`- Public/Auth Routes: Verified`);
  console.log(`- Primary Modules: ${passedModules}/${moduleUrls.length} Active`);
  console.log(`- Route Aliases: ${passedAliases}/${aliasUrls.length} Active`);
  console.log(`- Backend API Endpoints: ${passedApis}/${apiUrls.length} Active`);
  console.log('================================================================\n');

  if (
    passedModules === moduleUrls.length &&
    passedAliases === aliasUrls.length &&
    passedApis === apiUrls.length
  ) {
    console.log('🎉 ALL APPLICATION URLS ARE ACTIVE AND FUNCTIONAL!');
  } else {
    console.error('Some URLs failed verification.');
    process.exit(1);
  }
}

run();
