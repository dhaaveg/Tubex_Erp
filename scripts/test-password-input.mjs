import { strict as assert } from 'assert';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000';

function extractCookie(response) {
  const rawCookie = response.headers.get('set-cookie');
  if (!rawCookie) return null;
  const match = rawCookie.match(/eot_session=([^;]+)/);
  return match ? `eot_session=${match[1]}` : null;
}

async function testPasswordFeatures() {
  console.log('--- Testing Administrative Set Temporary Password & RBAC Features ---');

  // 1. Verify /login page serves correctly
  const loginPageRes = await fetch(`${BASE_URL}/login`);
  assert(loginPageRes.status === 200, 'GET /login returns 200 OK');
  console.log('✅ PASS: /login page renders successfully with 200 OK');

  // 2. Login as Super Admin
  const superLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@energyoilfield.com',
      password: 'SuperAdmin@2026!'
    })
  });
  assert(superLoginRes.status === 200, 'Super Admin login returns 200 OK');
  const superCookie = extractCookie(superLoginRes);

  // 3. Create a test user with initial temporary password
  const testEmail = `pwd.test.${Date.now()}@energyoilfield.com`;
  const initialTempPwd = 'InitialTemp@2026!';
  const createRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': superCookie
    },
    body: JSON.stringify({
      email: testEmail,
      name: 'Password Test User',
      roles: ['PROCUREMENT'],
      role: 'PROCUREMENT',
      temporaryPassword: initialTempPwd
    })
  });
  assert(createRes.status === 201, 'Created user with temporary password');
  const createdData = await createRes.json();
  const testUserId = createdData.user.id;

  // 4. Test User logs in to establish an active session
  const initialLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: initialTempPwd
    })
  });
  assert(initialLoginRes.status === 200, 'Test user logged in with initial password');
  const initialUserCookie = extractCookie(initialLoginRes);

  // 5. Test Password Complexity Validation in PUT /api/users/[id]
  console.log('\n--- Testing Password Complexity Enforcement ---');

  // 5a. Too short (< 8 chars)
  const shortPwdRes = await fetch(`${BASE_URL}/api/users/${testUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': superCookie },
    body: JSON.stringify({ temporaryPassword: 'Aa1!' })
  });
  assert(shortPwdRes.status === 400, 'Password < 8 chars rejected (400 Bad Request)');
  const shortData = await shortPwdRes.json();
  assert(shortData.error.includes('Password complexity required'), 'Error explains complexity requirements');
  console.log('✅ PASS: Password < 8 characters rejected');

  // 5b. Missing numbers and symbols (letters only)
  const lettersOnlyRes = await fetch(`${BASE_URL}/api/users/${testUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': superCookie },
    body: JSON.stringify({ temporaryPassword: 'OnlyLettersPassword' })
  });
  assert(lettersOnlyRes.status === 400, 'Letters-only password rejected (400 Bad Request)');
  console.log('✅ PASS: Password missing numbers/symbols rejected');

  // 5c. Missing symbols (letters and numbers only)
  const noSymbolsRes = await fetch(`${BASE_URL}/api/users/${testUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': superCookie },
    body: JSON.stringify({ temporaryPassword: 'LettersAndNumbers123' })
  });
  assert(noSymbolsRes.status === 400, 'Letters+numbers without symbols rejected (400 Bad Request)');
  console.log('✅ PASS: Password missing symbols rejected');

  // 6. Test Valid Complex Temporary Password Reset
  console.log('\n--- Testing Valid Temporary Password Reset & Session Revocation ---');
  const newTempPwd = 'UpdatedComplex@2026!';
  const updatePwdRes = await fetch(`${BASE_URL}/api/users/${testUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': superCookie },
    body: JSON.stringify({
      name: 'Password Test User',
      temporaryPassword: newTempPwd
    })
  });
  assert(updatePwdRes.status === 200, 'Valid temporary password accepted (200 OK)');
  const updateData = await updatePwdRes.json();
  assert(updateData.user.force_password_change === true, 'force_password_change forced to true');
  console.log('✅ PASS: Valid complex temporary password successfully applied');

  // 7. Verify previous session was invalidated
  const sessionCheckRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Cookie': initialUserCookie }
  });
  assert(sessionCheckRes.status === 401, 'Old session is invalidated immediately upon password reset (401 Unauthorized)');
  console.log('✅ PASS: Existing user sessions immediately revoked');

  // 8. Verify AuditLog entry for 'ADMIN_PASSWORD_RESET'
  const auditEntry = await prisma.auditLog.findFirst({
    where: {
      action: 'ADMIN_PASSWORD_RESET',
      entity_id: testUserId,
    },
    orderBy: { created_at: 'desc' }
  });
  assert(!!auditEntry, 'AuditLog contains ADMIN_PASSWORD_RESET entry');
  assert(auditEntry.action === 'ADMIN_PASSWORD_RESET', 'Audit action matches ADMIN_PASSWORD_RESET');
  console.log('✅ PASS: AuditLog recorded action: ADMIN_PASSWORD_RESET');

  // 9. Test User logs in with newly set temporary password
  const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: newTempPwd
    })
  });
  assert(newLoginRes.status === 200, 'User successfully authenticated with new temporary password');
  const newUserCookie = extractCookie(newLoginRes);
  const newLoginData = await newLoginRes.json();
  assert(newLoginData.user?.force_password_change === true, 'User is flagged for force_password_change');
  console.log('✅ PASS: User login with newly set temporary password confirmed');

  // 10. Clean up test user
  await fetch(`${BASE_URL}/api/users/${testUserId}`, {
    method: 'DELETE',
    headers: { 'Cookie': superCookie }
  });
  console.log('✅ Test user cleaned up.');
  console.log('\n======================================================');
  console.log('🎉 ALL SET TEMPORARY PASSWORD & SECURITY AUDIT TESTS PASS');
  console.log('======================================================');
}

testPasswordFeatures().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
