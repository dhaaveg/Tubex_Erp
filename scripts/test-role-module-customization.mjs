// scripts/test-role-module-customization.mjs
// Comprehensive Automated Test Suite for Dynamic Role-to-Module Mapping & Permissions

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

let superAdminCookie = '';
let salesCookie = '';

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

async function runTests() {
  console.log('================================================================');
  console.log('🚀 TESTING DYNAMIC ROLE-TO-MODULE MAPPING & PERMISSION CUSTOMIZATION');
  console.log('================================================================\n');

  // --- STEP 1: Authentication ---
  console.log('--- TEST 1: Authenticate Super Admin & Sales ---');
  const superRes = await login('superadmin@energyoilfield.com', 'SuperAdmin@2026!');
  assert(superRes.status === 200, 'Super Admin logged in successfully (200 OK)');
  assert(superRes.cookie.includes('eot_session='), 'Super Admin session cookie received');
  superAdminCookie = superRes.cookie;

  // Ensure sales user doesn't have forced password reset pending
  await prisma.user.updateMany({
    where: { email: 'sales@energyoilfield.com' },
    data: { force_password_change: false },
  });

  const salesRes = await login('sales@energyoilfield.com', 'EotErp@2026!');
  assert(salesRes.status === 200, 'Sales user logged in successfully (200 OK)');
  salesCookie = salesRes.cookie;

  // --- TEST 2: GET /api/admin/role-permissions ---
  console.log('\n--- TEST 2: Query Permission Matrix ---');
  // 2a: Unauthenticated attempt blocked
  const unauthGet = await fetch(`${BASE_URL}/api/admin/role-permissions`);
  assert(unauthGet.status === 401, 'Unauthenticated GET /api/admin/role-permissions returns 401');

  // 2b: Non-admin attempt blocked
  const salesGet = await fetch(`${BASE_URL}/api/admin/role-permissions`, {
    headers: { Cookie: salesCookie },
  });
  assert(salesGet.status === 403, 'Non-admin (SALES) GET /api/admin/role-permissions returns 403');

  // 2c: Super Admin gets full matrix
  const superGet = await fetch(`${BASE_URL}/api/admin/role-permissions?fresh=true`, {
    headers: { Cookie: superAdminCookie },
  });
  assert(superGet.status === 200, 'Super Admin GET /api/admin/role-permissions returns 200 OK');
  const matrixData = await superGet.json();
  assert(matrixData.success === true, 'Matrix response indicates success');
  assert(Array.isArray(matrixData.permissions), 'Matrix permissions is an array');
  assert(matrixData.permissions.length >= 80, `Matrix contains all 80 permission records (found ${matrixData.permissions.length})`);
  assert(matrixData.matrixByRole !== undefined, 'matrixByRole dictionary present');
  assert(matrixData.matrixByRole.SUPER_ADMIN !== undefined, 'SUPER_ADMIN role present in matrix');
  assert(matrixData.matrixByRole.SALES !== undefined, 'SALES role present in matrix');

  // --- TEST 3: Root Super Admin Protection ---
  console.log('\n--- TEST 3: Super Admin Root Protection Invariance ---');
  const tamperAttempt = await fetch(`${BASE_URL}/api/admin/role-permissions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminCookie,
    },
    body: JSON.stringify({
      updates: [
        {
          role: 'SUPER_ADMIN',
          module_key: 'overview',
          is_enabled: false,
          can_read: false,
          can_write: false,
        },
      ],
    }),
  });
  assert(tamperAttempt.status === 400, 'Attempt to disable SUPER_ADMIN privilege rejected with 400 Bad Request');
  const tamperData = await tamperAttempt.json();
  assert(tamperData.error.includes('SUPER_ADMIN'), 'Error explicitly mentions SUPER_ADMIN core root protection');

  // --- TEST 4: Baseline - SALES Cannot Access /quality ---
  console.log('\n--- TEST 4: Baseline - SALES Blocked from /quality ---');
  // Check page request (Edge Middleware intercept)
  const baselinePage = await fetch(`${BASE_URL}/quality`, {
    headers: { Cookie: salesCookie },
    redirect: 'manual',
  });
  assert(baselinePage.status === 307, 'Edge Middleware intercepts SALES request to /quality with HTTP 307 Redirect');
  const location = baselinePage.headers.get('location') || '';
  assert(location.includes('unauthorized=quality'), `Redirect target includes ?unauthorized=quality (Location: ${location})`);

  // Check API request (Edge Middleware API intercept)
  const baselineApi = await fetch(`${BASE_URL}/api/rejections`, {
    headers: { Cookie: salesCookie },
  });
  assert(baselineApi.status === 403, 'Edge Middleware blocks SALES request to /api/rejections with HTTP 403 Forbidden');

  // --- TEST 5: Dynamically Grant SALES Access to /quality ---
  console.log('\n--- TEST 5: Dynamically Grant SALES Access to /quality ---');
  const grantRes = await fetch(`${BASE_URL}/api/admin/role-permissions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminCookie,
    },
    body: JSON.stringify({
      updates: [
        {
          role: 'SALES',
          module_key: 'quality',
          route_path: '/quality',
          is_enabled: true,
          can_read: true,
          can_write: true,
        },
      ],
    }),
  });
  assert(grantRes.status === 200, 'Super Admin successfully granted SALES access to /quality (200 OK)');
  const grantData = await grantRes.json();
  assert(grantData.success === true, 'Grant response reports success');

  // Check AuditLog
  const auditEntry = await prisma.auditLog.findFirst({
    where: { action: 'ROLE_PERMISSIONS_UPDATED' },
    orderBy: { created_at: 'desc' },
  });
  assert(auditEntry !== null, 'AuditLog entry created for ROLE_PERMISSIONS_UPDATED');
  assert(auditEntry.details.includes('SALES'), 'AuditLog details mention SALES role modification');

  // --- TEST 6: Assert Live Access Succeeds (HTTP 200) ---
  console.log('\n--- TEST 6: Assert Live Access Succeeds for SALES ---');
  // Page request to /quality should now return 200 OK
  const allowedPage = await fetch(`${BASE_URL}/quality`, {
    headers: { Cookie: salesCookie },
    redirect: 'manual',
  });
  assert(allowedPage.status === 200, 'SALES user can now access /quality page (HTTP 200 OK)');

  // API request to /api/rejections should now return 200 OK
  const allowedApi = await fetch(`${BASE_URL}/api/rejections`, {
    headers: { Cookie: salesCookie },
  });
  assert(allowedApi.status === 200, 'SALES user can now access /api/rejections (HTTP 200 OK)');

  // --- TEST 7: Dynamic Revocation ---
  console.log('\n--- TEST 7: Revoke /quality Permission & Verify Re-blocking ---');
  const revokeRes = await fetch(`${BASE_URL}/api/admin/role-permissions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminCookie,
    },
    body: JSON.stringify({
      updates: [
        {
          role: 'SALES',
          module_key: 'quality',
          route_path: '/quality',
          is_enabled: false,
          can_read: false,
          can_write: false,
        },
      ],
    }),
  });
  assert(revokeRes.status === 200, 'Super Admin revoked SALES access to /quality (200 OK)');

  // Verify Edge Middleware intercepts again
  const revokedPage = await fetch(`${BASE_URL}/quality`, {
    headers: { Cookie: salesCookie },
    redirect: 'manual',
  });
  assert(revokedPage.status === 307, 'Edge Middleware intercepts revoked SALES user on /quality with HTTP 307');

  const revokedApi = await fetch(`${BASE_URL}/api/rejections`, {
    headers: { Cookie: salesCookie },
  });
  assert(revokedApi.status === 403, 'Edge Middleware blocks revoked SALES user on /api/rejections with HTTP 403');

  // --- TEST 8: Multi-Role Union Evaluation ---
  console.log('\n--- TEST 8: Multi-Role Union Evaluation ---');
  // Create multi-role user with SALES + INVENTORY
  const multiEmail = `test.union.${Date.now()}@energyoilfield.com`;
  const createMulti = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminCookie,
    },
    body: JSON.stringify({
      email: multiEmail,
      name: 'Union Test User',
      roles: ['SALES', 'INVENTORY'],
      department: 'Logistics & Commercial',
      temporaryPassword: 'UnionTestUser@2026!',
    }),
  });
  assert(createMulti.status === 201, 'Multi-role user created successfully');
  const multiUserData = await createMulti.json();

  // Update password so user is active without forced password change
  await prisma.user.update({
    where: { id: multiUserData.user.id },
    data: { force_password_change: false },
  });

  const multiLogin = await login(multiEmail, 'UnionTestUser@2026!');
  assert(multiLogin.status === 200, 'Multi-role user logged in successfully');
  const multiCookie = multiLogin.cookie;

  // Multi-role user has SALES -> can access /customer-orders
  const multiSalesPage = await fetch(`${BASE_URL}/customer-orders`, {
    headers: { Cookie: multiCookie },
    redirect: 'manual',
  });
  assert(multiSalesPage.status === 200, 'Multi-role user inherits SALES role -> /customer-orders allowed (200 OK)');

  // Multi-role user has INVENTORY -> can access /receiving
  const multiInvPage = await fetch(`${BASE_URL}/receiving`, {
    headers: { Cookie: multiCookie },
    redirect: 'manual',
  });
  assert(multiInvPage.status === 200, 'Multi-role user inherits INVENTORY role -> /receiving allowed (200 OK)');

  // Multi-role user does NOT have MANUFACTURING -> blocked from /shop-floor
  const multiBlockedPage = await fetch(`${BASE_URL}/shop-floor`, {
    headers: { Cookie: multiCookie },
    redirect: 'manual',
  });
  assert(multiBlockedPage.status === 307, 'Multi-role user blocked from unassigned role module /shop-floor (307 Redirect)');

  // Cleanup test user
  await prisma.session.deleteMany({ where: { user_id: multiUserData.user.id } });
  await prisma.user.delete({ where: { id: multiUserData.user.id } });
  console.log('Cleaned up multi-role test user.');

  // --- TEST 9: Reset Role to Defaults ---
  console.log('\n--- TEST 9: Reset Role to Defaults ---');
  const resetRes = await fetch(`${BASE_URL}/api/admin/role-permissions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminCookie,
    },
    body: JSON.stringify({ resetRole: 'SALES' }),
  });
  assert(resetRes.status === 200, 'Reset role SALES to defaults returned 200 OK');
  const resetData = await resetRes.json();
  assert(resetData.success === true, 'Reset response confirmed success');

  const finalCheck = await fetch(`${BASE_URL}/api/admin/role-permissions?fresh=true`, {
    headers: { Cookie: superAdminCookie },
  });
  const finalMatrix = await finalCheck.json();
  assert(finalMatrix.matrixByRole.SALES.quality.is_enabled === false, 'SALES quality is disabled in default matrix');
  assert(finalMatrix.matrixByRole.SALES['customer-orders'].is_enabled === true, 'SALES customer-orders is enabled in default matrix');

  console.log('\n================================================================');
  console.log('🎉 ALL DYNAMIC ROLE & MODULE PERMISSION TESTS PASSED (100%)');
  console.log('================================================================\n');
}

runTests()
  .catch((e) => {
    console.error('Test suite failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
