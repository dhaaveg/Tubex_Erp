// scripts/test-e2e-rbac.mjs
// Comprehensive End-to-End Test Suite for EOT ERP Authentication & RBAC

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE E2E RBAC & SECURITY VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  // Helper for cookie extraction
  function extractCookie(response) {
    const rawCookie = response.headers.get('set-cookie');
    if (!rawCookie) return null;
    const match = rawCookie.match(/eot_session=([^;]+)/);
    return match ? `eot_session=${match[1]}` : null;
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Unauthenticated API Access Protection
    // -------------------------------------------------------------
    console.log('--- TEST 1: Unauthenticated API Guard ---');
    const unauthRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { 'Accept': 'application/json' }
    });
    assert(unauthRes.status === 401, 'Unauthenticated GET /api/users returns 401 Unauthorized', `Got ${unauthRes.status}`);

    // -------------------------------------------------------------
    // TEST 2: Middleware Page Guard Redirect
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Middleware Unauthenticated Page Redirect ---');
    const redirectRes = await fetch(`${BASE_URL}/procurement`, {
      redirect: 'manual'
    });
    const location = redirectRes.headers.get('location') || '';
    assert(redirectRes.status === 307 || redirectRes.status === 308 || redirectRes.status === 302, 
      'Unauthenticated request to /procurement is redirected by Edge Middleware', 
      `Status: ${redirectRes.status}`);
    assert(location.includes('/login'), 'Redirect destination is /login', `Location: ${location}`);

    // -------------------------------------------------------------
    // TEST 3: Login as Super Admin (Encrypted Cookie & Session)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Super Admin Authentication ---');
    const superLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'superadmin@energyoilfield.com',
        password: 'SuperAdmin@2026!'
      })
    });
    assert(superLoginRes.status === 200, 'Super Admin login returns 200 OK', `Got ${superLoginRes.status}`);
    const superCookie = extractCookie(superLoginRes);
    assert(!!superCookie, 'Encrypted eot_session cookie returned in Set-Cookie header');
    const superData = await superLoginRes.json();
    assert(superData.user?.role === 'SUPER_ADMIN', 'Super Admin user profile confirmed');

    // -------------------------------------------------------------
    // TEST 4: Super Admin Visibility (Sees all users including Super Admin)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Super Admin Full Visibility ---');
    const superListRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { 'Cookie': superCookie }
    });
    const superListData = await superListRes.json();
    const hasSuperAdminInSuperView = superListData.users?.some(u => u.role === 'SUPER_ADMIN');
    assert(hasSuperAdminInSuperView === true, 'Super Admin can view SUPER_ADMIN accounts in user management');

    // -------------------------------------------------------------
    // TEST 5: Super Admin creates a new user
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Super Admin User Creation ---');
    const testEmail = `test.operator.${Date.now()}@energyoilfield.com`;
    const createRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': superCookie
      },
      body: JSON.stringify({
        email: testEmail,
        name: 'Test Floor Operator',
        role: 'MANUFACTURING',
        department: 'Machining',
        password: 'EotErp@2026!'
      })
    });
    assert(createRes.status === 201, 'Super Admin successfully creates new user (201 Created)', `Got ${createRes.status}`);
    const createdUserData = await createRes.json();
    const testUserId = createdUserData.user?.id;
    assert(!!testUserId, 'Created user has valid database ID');

    // -------------------------------------------------------------
    // TEST 6: Admin Login & SUPER_ADMIN Invisibility
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Admin Authentication & Super Admin Invisibility ---');
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@energyoilfield.com',
        password: 'EotErp@2026!'
      })
    });
    assert(adminLoginRes.status === 200, 'Admin login returns 200 OK');
    const adminCookie = extractCookie(adminLoginRes);

    const adminListRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { 'Cookie': adminCookie }
    });
    const adminListData = await adminListRes.json();
    const hasSuperAdminInAdminView = adminListData.users?.some(u => u.role === 'SUPER_ADMIN');
    assert(hasSuperAdminInAdminView === false, 
      'SUPER_ADMIN is completely invisible to ADMIN in user listings (Server Filter WHERE role != SUPER_ADMIN)');

    // -------------------------------------------------------------
    // TEST 7: Admin Provisioning Quota Enforcement (<=5 allowed, >5 blocked; Super Admin unlimited)
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Admin User Provisioning Quota Enforcement ---');
    // Verify GET /api/users returns quota metadata
    const userMetaRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { 'Cookie': adminCookie }
    });
    const userMetaData = await userMetaRes.json();
    assert(typeof userMetaData.nonSuperAdminCount === 'number', 'GET /api/users returns nonSuperAdminCount');
    assert(userMetaData.adminQuotaLimit === 5, 'GET /api/users returns adminQuotaLimit of 5');
    assert(userMetaData.canAdminProvision === (userMetaData.nonSuperAdminCount <= 5), 
      'GET /api/users canAdminProvision flag accurately matches count <= 5 condition');

    // Ensure nonSuperAdminCount > 5 so we can verify Admin block condition
    while (userMetaData.nonSuperAdminCount <= 5) {
      await fetch(`${BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': superCookie },
        body: JSON.stringify({
          email: `quota.pad.${Date.now()}.${Math.random().toString(36).substring(7)}@energyoilfield.com`,
          name: 'Quota Padding User',
          role: 'SALES',
          password: 'EotErp@2026!'
        })
      });
      userMetaData.nonSuperAdminCount++;
    }

    // Because nonSuperAdminCount > 5, ADMIN must be strictly blocked with HTTP 403 Forbidden & quotaExceeded flag
    const adminCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        email: 'unauthorized.user@energyoilfield.com',
        name: 'Unauthorized User',
        role: 'PROCUREMENT',
        password: 'EotErp@2026!'
      })
    });
    const adminCreateData = await adminCreateRes.json();
    assert(adminCreateRes.status === 403, 
      'Admin is blocked from creating users when non-Super-Admin count > 5 (403 Forbidden)', 
      `Got ${adminCreateRes.status}`);
    assert(adminCreateData.quotaExceeded === true, 
      'Admin block response explicitly indicates quotaExceeded: true');
    assert(adminCreateData.error.includes('Admin Provisioning Quota Exceeded'), 
      'Admin block response explains the <= 5 quota policy');

    // Verify Super Admin is completely unrestricted (unlimited accounts regardless of count)
    const superUnrestrictedEmail = `unrestricted.super.${Date.now()}@energyoilfield.com`;
    const superCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': superCookie
      },
      body: JSON.stringify({
        email: superUnrestrictedEmail,
        name: 'Super Admin Unrestricted User',
        roles: ['SALES'],
        role: 'SALES',
        temporaryPassword: 'EotErp@2026!'
      })
    });
    assert(superCreateRes.status === 201, 
      'Super Admin has unrestricted user provisioning even when non-Super-Admin accounts > 5 (201 Created)', 
      `Got ${superCreateRes.status}`);
    const superCreatedData = await superCreateRes.json();
    if (superCreatedData.user?.id) {
      // Clean up the created test user
      await fetch(`${BASE_URL}/api/users/${superCreatedData.user.id}`, {
        method: 'DELETE',
        headers: { 'Cookie': superCookie }
      });
    }

    // -------------------------------------------------------------
    // TEST 8: Admin Privilege Escalation Guard (Cannot assign SUPER_ADMIN)
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Privilege Escalation Prevention ---');
    const escalateRes = await fetch(`${BASE_URL}/api/users/${testUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        role: 'SUPER_ADMIN'
      })
    });
    assert(escalateRes.status === 403, 
      'Admin cannot promote an account to SUPER_ADMIN (403 Forbidden)', 
      `Got ${escalateRes.status}`);

    // -------------------------------------------------------------
    // TEST 9: Admin User Deactivation & Instant Session Invalidation
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: User Deactivation & Immediate Session Termination ---');
    // First, login as the newly created test user to establish an active session
    const testUserLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'EotErp@2026!'
      })
    });
    assert(testUserLoginRes.status === 200, 'Test user logged in successfully');
    const testUserCookie = extractCookie(testUserLoginRes);

    // Verify test user can access their /api/auth/me
    const testMeBefore = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Cookie': testUserCookie }
    });
    assert(testMeBefore.status === 200, 'Test user session is currently valid');

    // Admin deactivates test user
    const deactivateRes = await fetch(`${BASE_URL}/api/users/${testUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        is_active: false
      })
    });
    assert(deactivateRes.status === 200, 'Admin successfully deactivated user');

    // Verify test user session is instantly rejected
    const testMeAfter = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Cookie': testUserCookie }
    });
    assert(testMeAfter.status === 401, 
      'Deactivated user session is immediately rejected (401 Unauthorized)', 
      `Got ${testMeAfter.status}`);

    // Clean up test user
    await fetch(`${BASE_URL}/api/users/${testUserId}`, {
      method: 'DELETE',
      headers: { 'Cookie': superCookie }
    });

    // -------------------------------------------------------------
    // TEST 10: Super Admin Anti-Lockout Enforcement
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Super Admin Anti-Lockout Guard ---');
    const superAdminRecord = superListData.users.find(u => u.role === 'SUPER_ADMIN');
    if (superAdminRecord) {
      const lockoutRes = await fetch(`${BASE_URL}/api/users/${superAdminRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': superCookie
        },
        body: JSON.stringify({
          is_active: false
        })
      });
      assert(lockoutRes.status === 400, 
        'Anti-Lockout blocks deactivating the last active Super Admin (400 Bad Request)', 
        `Got ${lockoutRes.status}`);

      const demoteRes = await fetch(`${BASE_URL}/api/users/${superAdminRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': superCookie
        },
        body: JSON.stringify({
          role: 'ADMIN'
        })
      });
      assert(demoteRes.status === 400, 
        'Anti-Lockout blocks demoting the last active Super Admin (400 Bad Request)', 
        `Got ${demoteRes.status}`);
    }

    // -------------------------------------------------------------
    // TEST 11: Departmental Module Boundary (Procurement -> Shop Floor)
    // -------------------------------------------------------------
    console.log('\n--- TEST 11: Departmental Module Boundary Enforcement ---');
    const procLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'procurement@energyoilfield.com',
        password: 'EotErp@2026!'
      })
    });
    const procCookie = extractCookie(procLoginRes);

    const procBoundaryRes = await fetch(`${BASE_URL}/shop-floor`, {
      headers: { 'Cookie': procCookie },
      redirect: 'manual'
    });
    assert(procBoundaryRes.status === 307 || procBoundaryRes.status === 308 || procBoundaryRes.status === 302, 
      'Edge Middleware intercepts cross-departmental access to /shop-floor for PROCUREMENT', 
      `Status: ${procBoundaryRes.status}`);
    const procRedirect = procBoundaryRes.headers.get('location') || '';
    assert(procRedirect.includes('unauthorized=shop-floor'), 
      'Middleware appends unauthorized notice query parameter', 
      `Redirect: ${procRedirect}`);

    // -------------------------------------------------------------
    // TEST 12: MD Executive Read-Only Enforcement (Mutations Blocked)
    // -------------------------------------------------------------
    console.log('\n--- TEST 12: MD Executive Read-Only Mutation Blocker ---');
    const mdLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'md@energyoilfield.com',
        password: 'EotErp@2026!'
      })
    });
    const mdCookie = extractCookie(mdLoginRes);

    // MD can read operational data
    const mdReadRes = await fetch(`${BASE_URL}/api/purchase-orders`, {
      headers: { 'Cookie': mdCookie }
    });
    assert(mdReadRes.status === 200, 'MD has full executive read visibility into /api/purchase-orders (200 OK)');

    // MD cannot perform mutations (Edge Middleware blocks POST/PUT/DELETE on operational APIs with 403)
    const mdMutateRes = await fetch(`${BASE_URL}/api/purchase-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': mdCookie
      },
      body: JSON.stringify({ po_number: 'PO-TEST-ILLEGAL' })
    });
    assert(mdMutateRes.status === 403, 
      'MD mutation attempt blocked with 403 Forbidden', 
      `Got ${mdMutateRes.status}`);

    // -------------------------------------------------------------
    // TEST 13: Forced Password Change Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- TEST 13: Forced Password Change on First Login ---');
    const resetUserEmail = `reset.user.${Date.now()}@energyoilfield.com`;
    const resetCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': superCookie
      },
      body: JSON.stringify({
        email: resetUserEmail,
        name: 'Reset Test User',
        role: 'PROCUREMENT',
        password: 'EotErp@2026!'
      })
    });
    assert(resetCreateRes.status === 201, 'User created with force_password_change: true by default');
    const resetUserData = await resetCreateRes.json();
    const resetUserId = resetUserData.user?.id;

    // Login with initial temp password
    const resetLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: resetUserEmail,
        password: 'EotErp@2026!'
      })
    });
    const resetCookie = extractCookie(resetLoginRes);
    const resetLoginData = await resetLoginRes.json();
    assert(resetLoginData.user?.force_password_change === true, 'Login response flags force_password_change');

    // Attempting to visit /procurement with force_password_change redirect to /change-password
    const forceRedirectRes = await fetch(`${BASE_URL}/procurement`, {
      headers: { 'Cookie': resetCookie },
      redirect: 'manual'
    });
    const forceRedirectLoc = forceRedirectRes.headers.get('location') || '';
    assert(forceRedirectLoc.includes('/change-password'), 
      'Edge Middleware forces redirect to /change-password when flag is active',
      `Got: ${forceRedirectLoc}`);

    // Call /api/auth/change-password
    const changePassRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': resetCookie
      },
      body: JSON.stringify({
        currentPassword: 'EotErp@2026!',
        newPassword: 'BrandNewSecure@2026!'
      })
    });
    assert(changePassRes.status === 200, 'Password updated successfully via /api/auth/change-password');
    const changePassData = await changePassRes.json();
    assert(changePassData.user?.force_password_change === false, 'force_password_change is now false');

    // Clean up reset user
    await fetch(`${BASE_URL}/api/users/${resetUserId}`, {
      method: 'DELETE',
      headers: { 'Cookie': superCookie }
    });

    // -------------------------------------------------------------
    // TEST 14: Multi-Role Assignment & Dual Department Access
    // -------------------------------------------------------------
    console.log('\n--- TEST 14: Multi-Role Assignment & Dual Department Access ---');
    const multiUserEmail = `multi.operator.${Date.now()}@energyoilfield.com`;
    const multiCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': superCookie
      },
      body: JSON.stringify({
        email: multiUserEmail,
        name: 'Multi Role Engineer',
        roles: ['QUALITY', 'INVENTORY'],
        role: 'QUALITY',
        department: 'QA & Receiving',
        password: 'EotErp@2026!'
      })
    });
    assert(multiCreateRes.status === 201, 'User created with multiple roles [QUALITY, INVENTORY]', `Got: ${multiCreateRes.status}`);
    const multiUserData = await multiCreateRes.json();
    const multiUserId = multiUserData.user?.id;
    assert(Array.isArray(multiUserData.user?.roles), 'Response user.roles is an array');
    assert(multiUserData.user?.roles.includes('QUALITY') && multiUserData.user?.roles.includes('INVENTORY'), 
      'User contains both QUALITY and INVENTORY roles');

    // Remove force_password_change so page navigation to modules is tested directly
    await fetch(`${BASE_URL}/api/users/${multiUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': superCookie
      },
      body: JSON.stringify({
        force_password_change: false
      })
    });

    // Login as multi-role user
    const multiLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: multiUserEmail,
        password: 'EotErp@2026!'
      })
    });
    assert(multiLoginRes.status === 200, 'Multi-role user logged in successfully');
    const multiCookie = extractCookie(multiLoginRes);
    const multiLoginPayload = await multiLoginRes.json();
    assert(multiLoginPayload.user?.roles.includes('QUALITY') && multiLoginPayload.user?.roles.includes('INVENTORY'),
      'Login session token decodes multiple assigned roles');

    // Verify access to QUALITY module (allowed)
    const qualityAccessRes = await fetch(`${BASE_URL}/quality`, {
      headers: { 'Cookie': multiCookie },
      redirect: 'manual'
    });
    assert(qualityAccessRes.status === 200, 'Multi-role user can access /quality', `Status: ${qualityAccessRes.status}`);

    // Verify access to INVENTORY module (/receiving) (allowed)
    const inventoryAccessRes = await fetch(`${BASE_URL}/receiving`, {
      headers: { 'Cookie': multiCookie },
      redirect: 'manual'
    });
    assert(inventoryAccessRes.status === 200, 'Multi-role user can access /receiving', `Status: ${inventoryAccessRes.status}`);

    // Verify access to PROCUREMENT module (forbidden -> redirected to /login)
    const procAccessRes = await fetch(`${BASE_URL}/procurement`, {
      headers: { 'Cookie': multiCookie },
      redirect: 'manual'
    });
    assert(procAccessRes.status === 307 || procAccessRes.status === 308 || procAccessRes.status === 302,
      'Multi-role user is blocked from unauthorized module /procurement',
      `Status: ${procAccessRes.status}`);

    // Update user profile to append MANUFACTURING role
    const updateRolesRes = await fetch(`${BASE_URL}/api/users/${multiUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': superCookie
      },
      body: JSON.stringify({
        name: 'Multi Role Senior Engineer',
        roles: ['QUALITY', 'INVENTORY', 'MANUFACTURING'],
        role: 'QUALITY'
      })
    });
    assert(updateRolesRes.status === 200, 'Updated user roles to [QUALITY, INVENTORY, MANUFACTURING]');
    const updateRolesData = await updateRolesRes.json();
    assert(updateRolesData.user?.roles.length === 3 && updateRolesData.user?.roles.includes('MANUFACTURING'),
      'User now possesses 3 distinct enterprise roles');

    // Clean up multi-role test user
    await fetch(`${BASE_URL}/api/users/${multiUserId}`, {
      method: 'DELETE',
      headers: { 'Cookie': superCookie }
    });
    console.log('Cleaned up multi-role test user.');

    // -------------------------------------------------------------
    // TEST 15: User Identity Editing (Name & Corporate Mail ID)
    // -------------------------------------------------------------
    console.log('\n--- TEST 15: User Identity Editing (Name & Mail ID) ---');
    const origEmail = `identity.test.${Date.now()}@energyoilfield.com`;
    const updatedEmail = `identity.updated.${Date.now()}@energyoilfield.com`;

    // 1. Create a user to test identity modification
    const createIdentRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': superCookie
      },
      body: JSON.stringify({
        email: origEmail,
        name: 'Original Name',
        role: 'QUALITY',
        password: 'EotErp@2026!'
      })
    });
    assert(createIdentRes.status === 201, 'User created for identity modification testing');
    const identData = await createIdentRes.json();
    const identUserId = identData.user?.id;

    // Remove force_password_change
    await fetch(`${BASE_URL}/api/users/${identUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': superCookie
      },
      body: JSON.stringify({ force_password_change: false })
    });

    // 2. Collision Test: Attempt to update email to an already existing user's email (admin@energyoilfield.com)
    const collisionRes = await fetch(`${BASE_URL}/api/users/${identUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': superCookie
      },
      body: JSON.stringify({
        email: 'admin@energyoilfield.com'
      })
    });
    assert(collisionRes.status === 400, 'Duplicate email update rejected with 400 Bad Request');
    const collisionData = await collisionRes.json();
    assert(collisionData.error?.includes('already registered'), 'Duplicate email error message verified');

    // 3. Super Admin updates User Identity: Name and Corporate Mail ID
    const updateIdentRes = await fetch(`${BASE_URL}/api/users/${identUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': superCookie
      },
      body: JSON.stringify({
        name: 'Vikram Joshi (Updated)',
        email: updatedEmail,
        department: 'Advanced Metrology'
      })
    });
    assert(updateIdentRes.status === 200, 'Super Admin successfully updated User Identity (Name & Mail ID)');
    const updateIdentData = await updateIdentRes.json();
    assert(updateIdentData.user?.name === 'Vikram Joshi (Updated)', 'Updated user name matches in response');
    assert(updateIdentData.user?.email === updatedEmail, 'Updated corporate email matches in response');

    // 4. Verify login using the NEW Corporate Mail ID
    const newEmailLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: updatedEmail,
        password: 'EotErp@2026!'
      })
    });
    assert(newEmailLoginRes.status === 200, 'User successfully logs in with updated Corporate Mail ID');
    const newEmailCookie = extractCookie(newEmailLoginRes);
    const newEmailUserData = await newEmailLoginRes.json();
    assert(newEmailUserData.user?.name === 'Vikram Joshi (Updated)', 'Session user name verified after identity update');

    // 5. Self-Edit: User updates their own name and mail ID via their own session
    const selfUpdatedEmail = `identity.self.${Date.now()}@energyoilfield.com`;
    const selfEditRes = await fetch(`${BASE_URL}/api/users/${identUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': newEmailCookie
      },
      body: JSON.stringify({
        name: 'Vikram Joshi (Self-Edited)',
        email: selfUpdatedEmail
      })
    });
    assert(selfEditRes.status === 200, 'User successfully self-edits their own Name and Mail ID');
    const selfEditCookie = extractCookie(selfEditRes);
    assert(!!selfEditCookie, 'Refreshed session cookie returned upon self-editing identity');

    // Clean up test user
    await fetch(`${BASE_URL}/api/users/${identUserId}`, {
      method: 'DELETE',
      headers: { 'Cookie': superCookie }
    });
    console.log('Cleaned up identity test user.');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`FINAL E2E VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal E2E test execution error:', err);
    process.exit(1);
  }
}

runTests();
