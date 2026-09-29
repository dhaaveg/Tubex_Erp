import { strict as assert } from 'assert';

const BASE_URL = 'http://localhost:3000';

function extractCookie(response) {
  const rawCookie = response.headers.get('set-cookie');
  if (!rawCookie) return null;
  const match = rawCookie.match(/eot_session=([^;]+)/);
  return match ? `eot_session=${match[1]}` : null;
}

async function testQuotaBoundary() {
  console.log('--- Testing Admin Quota Boundary (<= 5 allowed, > 5 blocked) ---');

  // 1. Login as Super Admin
  const superLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@energyoilfield.com',
      password: 'SuperAdmin@2026!'
    })
  });
  const superCookie = extractCookie(superLoginRes);

  // 2. Login as Admin
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@energyoilfield.com',
      password: 'EotErp@2026!'
    })
  });
  const adminCookie = extractCookie(adminLoginRes);

  // 3. Get current users
  const listRes = await fetch(`${BASE_URL}/api/users`, {
    headers: { 'Cookie': superCookie }
  });
  const listData = await listRes.json();
  console.log(`Current nonSuperAdminCount: ${listData.nonSuperAdminCount}`);

  // Find users we can temporarily delete to get nonSuperAdminCount <= 5
  // Default seeded non-superadmin: admin, md, procurement, manufacturing, sales, inventory, quality
  const tempCandidates = listData.users.filter(u => 
    !['admin@energyoilfield.com', 'superadmin@energyoilfield.com'].includes(u.email)
  );

  const backedUpUsers = [];
  // Delete until count is 4
  let currentCount = listData.nonSuperAdminCount;
  for (const user of tempCandidates) {
    if (currentCount <= 4) break;
    backedUpUsers.push(user);
    const delRes = await fetch(`${BASE_URL}/api/users/${user.id}`, {
      method: 'DELETE',
      headers: { 'Cookie': superCookie }
    });
    assert(delRes.status === 200, `Deleted ${user.email} for quota testing`);
    currentCount--;
  }

  console.log(`Reduced count to ${currentCount} (<= 5)`);

  // Verify GET /api/users shows canAdminProvision: true
  const checkRes = await fetch(`${BASE_URL}/api/users`, {
    headers: { 'Cookie': adminCookie }
  });
  const checkData = await checkRes.json();
  assert(checkData.nonSuperAdminCount <= 5, 'Count is <= 5');
  assert(checkData.canAdminProvision === true, 'canAdminProvision is true when count <= 5');
  console.log('✅ GET /api/users confirms canAdminProvision === true');

  // 4. Test: Admin provisions new user when count <= 5
  const adminCreatedEmail = `admin.provisioned.${Date.now()}@energyoilfield.com`;
  const adminCreateRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    },
    body: JSON.stringify({
      email: adminCreatedEmail,
      name: 'Admin Created User',
      roles: ['PROCUREMENT'],
      role: 'PROCUREMENT',
      temporaryPassword: 'EotErp@2026!'
    })
  });

  const adminCreateJson = await adminCreateRes.json();
  assert(adminCreateRes.status === 201, `Admin successfully provisions user when count <= 5 (Status: ${adminCreateRes.status})`);
  console.log('✅ PASS: Admin successfully created user while count <= 5');

  // Clean up created user
  if (adminCreateJson.user?.id) {
    await fetch(`${BASE_URL}/api/users/${adminCreateJson.user.id}`, {
      method: 'DELETE',
      headers: { 'Cookie': superCookie }
    });
  }

  // 5. Restore backed up users
  console.log('Restoring backed up accounts...');
  for (const u of backedUpUsers) {
    await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': superCookie
      },
      body: JSON.stringify({
        email: u.email,
        name: u.name,
        roles: u.roles || [u.role],
        role: u.role,
        department: u.department,
        temporaryPassword: 'EotErp@2026!'
      })
    });
  }

  // Verify restore
  const finalRes = await fetch(`${BASE_URL}/api/users`, {
    headers: { 'Cookie': adminCookie }
  });
  const finalData = await finalRes.json();
  console.log(`Final restored nonSuperAdminCount: ${finalData.nonSuperAdminCount}, canAdminProvision: ${finalData.canAdminProvision}`);
  assert(finalData.nonSuperAdminCount > 5, 'Count restored to > 5');
  assert(finalData.canAdminProvision === false, 'canAdminProvision locked when > 5');
  console.log('✅ PASS: All quota boundary assertions verified perfectly!');
}

testQuotaBoundary().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
