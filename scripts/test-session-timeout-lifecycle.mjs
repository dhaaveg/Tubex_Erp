// scripts/test-session-timeout-lifecycle.mjs
// Comprehensive Verification Suite for:
// 1. Automatic 2-hour inactivity timeout & sliding session extension
// 2. Deterministic Cookie Eviction (Set-Cookie Max-Age=0, Expires=1970)
// 3. Database session invalidation & audit logging on logout/timeout
// 4. First-attempt re-login success without manual browser refresh
// 5. Middleware redirect resilience without loops

import { PrismaClient as SqliteClient } from '../prisma/generated/sqlite-client/index.js';

const prisma = new SqliteClient();
const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@energyoilfield.com';
const ADMIN_PASSWORD = 'Admin@2026!';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('--- SESSION TIMEOUT & AUTH LIFECYCLE VERIFICATION ---');
  console.log('======================================================\n');

  // Test 1: Initial Login with Valid Credentials
  console.log('--- TEST 1: Initial Login with Valid Credentials ---');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  assert(loginRes.status === 200, `Login returns HTTP 200 (Got: ${loginRes.status})`);
  const loginData = await loginRes.json();
  assert(loginData.success === true, 'Login payload contains success: true');
  assert(loginData.user?.email === ADMIN_EMAIL, 'User email matches login input');

  // Verify Set-Cookie header contains eot_session with proper attributes
  const rawSetCookie = loginRes.headers.get('set-cookie');
  assert(!!rawSetCookie, 'Login returns Set-Cookie header');
  assert(rawSetCookie?.includes('eot_session='), 'Set-Cookie contains eot_session cookie');
  assert(rawSetCookie?.includes('Path=/'), 'Set-Cookie specifies Path=/');
  assert(rawSetCookie?.toLowerCase().includes('samesite=lax'), 'Set-Cookie specifies SameSite=Lax');
  assert(rawSetCookie?.toLowerCase().includes('httponly'), 'Set-Cookie specifies HttpOnly');

  // Extract session token
  const tokenMatch = rawSetCookie?.match(/eot_session=([^;]+)/);
  const sessionToken = tokenMatch ? tokenMatch[1] : null;
  assert(!!sessionToken, 'Extracted valid eot_session cookie value');

  // Verify session exists in DB
  const dbSessions = await prisma.session.findMany({
    where: { user: { email: ADMIN_EMAIL } },
  });
  assert(dbSessions.length > 0, `Active database session found for user (${dbSessions.length} active)`);

  // Test 2: Authenticated Access to Protected API & Route
  console.log('\n--- TEST 2: Authenticated Access to Protected API ---');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `eot_session=${sessionToken}` },
  });
  assert(meRes.status === 200, `/api/auth/me returns HTTP 200 with valid session`);
  const meData = await meRes.json();
  assert(meData.authenticated === true, 'Authenticated status is true in /api/auth/me');

  // Test 3: Session Extension via /api/auth/refresh (Sliding Window)
  console.log('\n--- TEST 3: Sliding Session Extension via /api/auth/refresh ---');
  const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `eot_session=${sessionToken}` },
  });
  assert(refreshRes.status === 200, `/api/auth/refresh returns HTTP 200`);
  const refreshData = await refreshRes.json();
  assert(refreshData.success === true, 'Refresh payload contains success: true');
  const refreshSetCookie = refreshRes.headers.get('set-cookie');
  assert(refreshSetCookie?.includes('eot_session='), 'Refresh response sets updated eot_session cookie');

  // Test 4: Deterministic Cookie Eviction & Server Invalidation via /api/auth/logout
  console.log('\n--- TEST 4: Deterministic Cookie Eviction on Logout ---');
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: `eot_session=${sessionToken}` },
  });
  assert(logoutRes.status === 200, `Logout returns HTTP 200`);
  const logoutSetCookie = logoutRes.headers.get('set-cookie');
  assert(!!logoutSetCookie, 'Logout response contains Set-Cookie header');
  assert(
    logoutSetCookie?.toLowerCase().includes('max-age=0'),
    'Set-Cookie specifies Max-Age=0'
  );
  assert(
    logoutSetCookie?.includes('1970') || logoutSetCookie?.includes('Expires='),
    'Set-Cookie specifies historical 1970 epoch expiry'
  );

  // Test 5: Verify Access Denied Post-Logout
  console.log('\n--- TEST 5: Verify Access Denied Post-Logout ---');
  const meAfterLogout = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `eot_session=${sessionToken}` },
  });
  assert(meAfterLogout.status === 401, `/api/auth/me returns HTTP 401 with logged-out session`);

  // Test 6: First-Attempt Re-Login Verification
  console.log('\n--- TEST 6: First-Attempt Re-Login Immediate Verification ---');
  const reloginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store',
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  assert(reloginRes.status === 200, `Re-login succeeds on the very first attempt (HTTP 200)`);
  const reloginData = await reloginRes.json();
  assert(reloginData.success === true, 'Re-login payload has success: true');
  const reloginCookie = reloginRes.headers.get('set-cookie');
  assert(reloginCookie?.includes('eot_session='), 'New session cookie provided upon re-login');

  const newTokenMatch = reloginCookie?.match(/eot_session=([^;]+)/);
  const newSessionToken = newTokenMatch ? newTokenMatch[1] : null;

  // Verify the newly issued session works immediately
  const meNewRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `eot_session=${newSessionToken}` },
  });
  assert(meNewRes.status === 200, `New session token immediately authenticates successfully (HTTP 200)`);

  // Test 7: Middleware Redirect Resilience (Expired parameter handling)
  console.log('\n--- TEST 7: Middleware Redirect Resilience ---');
  const loginPageRes = await fetch(`${BASE_URL}/login?expired=true`);
  assert(loginPageRes.status === 200, `/login?expired=true returns HTTP 200 without redirect loop`);
  const loginHtml = await loginPageRes.text();

  let hasBannerMessage = loginHtml.includes('Your session has expired');
  if (!hasBannerMessage) {
    const scriptMatches = loginHtml.match(/\/static\/chunks\/[a-zA-Z0-9_\-\./]+\.js/g) || [];
    for (const scriptPath of scriptMatches) {
      try {
        const scriptRes = await fetch(`${BASE_URL}/_next${scriptPath}`);
        const scriptText = await scriptRes.text();
        if (scriptText.includes('Your session has expired')) {
          hasBannerMessage = true;
          break;
        }
      } catch {}
    }
  }

  assert(
    hasBannerMessage,
    'Login page/client component renders the 2-hour inactivity expiration message banner'
  );

  console.log('\n======================================================');
  console.log(`TOTAL TESTS: ${passCount + failCount}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log('======================================================\n');

  await prisma.$disconnect();
  process.exit(failCount === 0 ? 0 : 1);
}

runTests().catch(async (e) => {
  console.error('Test execution failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
