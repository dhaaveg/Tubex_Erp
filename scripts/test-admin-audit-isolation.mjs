// scripts/test-admin-audit-isolation.mjs
// Verification Suite for Strict Hierarchical Audit Log Partitioning & RBAC Isolation
// Verifies:
// 1. Actions taken by SUPER_ADMIN never leak into response when authenticated as ADMIN
// 2. Sensitive governance actions (ROLE_PERMISSIONS_UPDATED, USER_ROLE_CHANGED, etc.) are strictly excluded for ADMIN
// 3. Plant operational actions (WO_RELEASED, GRN_RECORDED, etc.) taken by standard users remain visible to ADMIN
// 4. Parameter tampering / IDOR bypass attempts are completely neutralized
// 5. Contextual feed badges (Plant Operations Feed vs System & Security Audit Feed) are correctly populated

import { PrismaClient } from '@prisma/client';
import http from 'http';

const prisma = new PrismaClient();
const SESSION_SECRET = process.env.SESSION_SECRET || 'eot_couplings_super_secret_auth_encryption_key_2026_xyz';

async function getCryptoKey() {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(SESSION_SECRET));
  return await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptSessionToken(payload) {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  const ivB64 = Buffer.from(iv).toString('base64url');
  const cipherB64 = Buffer.from(encrypted).toString('base64url');
  return `${ivB64}.${cipherB64}`;
}

function makeGetRequest(path, cookie) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: {
        Cookie: `eot_session=${cookie}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${message}`);
    passCount++;
  } else {
    console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${message}`);
    failCount++;
  }
}

async function run() {
  console.log('\n========================================================================');
  console.log('   HIERARCHICAL AUDIT LOG PARTITIONING & RBAC VERIFICATION SUITE');
  console.log('========================================================================\n');

  // 1. Identify users
  const superAdmin = await prisma.user.findUnique({
    where: { email: 'superadmin@energyoilfield.com' },
  });
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@energyoilfield.com' },
  });
  const procurement = await prisma.user.findUnique({
    where: { email: 'procurement@energyoilfield.com' },
  });

  assert(superAdmin && admin && procurement, 'Verified required test users exist in database');

  const testBatchTag = `TEST-ISO-${Date.now()}`;
  const createdTestLogIds = [];

  try {
    // 2. Insert controlled audit logs for the test batch
    console.log('\n--- 1. Seeding Controlled Test Audit Log Records ---');

    // (A) Operational action by standard staff (Procurement)
    const log1 = await prisma.auditLog.create({
      data: {
        user_id: procurement.id,
        action: 'WO_RELEASED',
        entity_type: 'WorkOrder',
        entity_id: `${testBatchTag}-WO-01`,
        details: JSON.stringify({ wo_id: `${testBatchTag}-WO-01`, grade: 'J55', planned_parts: 40 }),
        ip_address: '10.0.0.5',
      },
    });
    createdTestLogIds.push(log1.id);

    // (B) Operational GRN action by standard staff (Procurement)
    const log2 = await prisma.auditLog.create({
      data: {
        user_id: procurement.id,
        action: 'GRN_RECORDED',
        entity_type: 'GRN',
        entity_id: `${testBatchTag}-GRN-01`,
        details: JSON.stringify({ grn_no: `${testBatchTag}-GRN-01`, heat_no: 'HT-9921', pipes_received: 20 }),
        ip_address: '10.0.0.5',
      },
    });
    createdTestLogIds.push(log2.id);

    // (C) Operational action taken by SUPER_ADMIN (must be hidden from Admin)
    const log3 = await prisma.auditLog.create({
      data: {
        user_id: superAdmin.id,
        action: 'PO_CREATED',
        entity_type: 'PurchaseOrder',
        entity_id: `${testBatchTag}-PO-SA`,
        details: JSON.stringify({ po_no: `${testBatchTag}-PO-SA`, supplier: 'Vallourec', total_value: 500000 }),
        ip_address: '127.0.0.1',
      },
    });
    createdTestLogIds.push(log3.id);

    // (D) Login by SUPER_ADMIN (must be hidden from Admin)
    const log4 = await prisma.auditLog.create({
      data: {
        user_id: superAdmin.id,
        action: 'LOGIN',
        entity_type: 'Session',
        entity_id: `${testBatchTag}-SES-SA`,
        details: JSON.stringify({ email: superAdmin.email, role: 'SUPER_ADMIN' }),
        ip_address: '127.0.0.1',
      },
    });
    createdTestLogIds.push(log4.id);

    // (E) Sensitive governance action by SUPER_ADMIN (ROLE_PERMISSIONS_UPDATED)
    const log5 = await prisma.auditLog.create({
      data: {
        user_id: superAdmin.id,
        action: 'ROLE_PERMISSIONS_UPDATED',
        entity_type: 'RolePermission',
        entity_id: 'PROCUREMENT',
        details: JSON.stringify({ role: 'PROCUREMENT', module: 'procurement', can_write: true }),
        ip_address: '127.0.0.1',
      },
    });
    createdTestLogIds.push(log5.id);

    // (F) Sensitive governance action by ADMIN (USER_DEACTIVATED)
    const log6 = await prisma.auditLog.create({
      data: {
        user_id: admin.id,
        action: 'USER_DEACTIVATED',
        entity_type: 'User',
        entity_id: procurement.id,
        details: JSON.stringify({ target_name: 'Procurement User', target_email: procurement.email }),
        ip_address: '127.0.0.1',
      },
    });
    createdTestLogIds.push(log6.id);

    // (G) Sensitive action targeting SUPER_ADMIN account
    const log7 = await prisma.auditLog.create({
      data: {
        user_id: admin.id,
        action: 'PASSWORD_RESET_OVERRIDE',
        entity_type: 'User',
        entity_id: superAdmin.id,
        details: JSON.stringify({ target_email: superAdmin.email, target_role: 'SUPER_ADMIN' }),
        ip_address: '127.0.0.1',
      },
    });
    createdTestLogIds.push(log7.id);

    console.log(`  Seeded ${createdTestLogIds.length} test audit records for isolation verification.`);

    // 3. Create active session tokens
    const now = Date.now();
    const superAdminToken = await encryptSessionToken({
      sessionId: `SES-TEST-SA-${now}`,
      userId: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      role: 'SUPER_ADMIN',
      roles: ['SUPER_ADMIN'],
      exp: now + 7200 * 1000,
    });
    await prisma.session.create({
      data: {
        session_token: `SES-TEST-SA-${now}`,
        user_id: superAdmin.id,
        expires_at: new Date(now + 7200 * 1000),
      },
    });

    const adminToken = await encryptSessionToken({
      sessionId: `SES-TEST-ADM-${now}`,
      userId: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'ADMIN',
      roles: ['ADMIN'],
      exp: now + 7200 * 1000,
    });
    await prisma.session.create({
      data: {
        session_token: `SES-TEST-ADM-${now}`,
        user_id: admin.id,
        expires_at: new Date(now + 7200 * 1000),
      },
    });

    const procurementToken = await encryptSessionToken({
      sessionId: `SES-TEST-PROC-${now}`,
      userId: procurement.id,
      email: procurement.email,
      name: procurement.name,
      role: 'PROCUREMENT',
      roles: ['PROCUREMENT'],
      exp: now + 7200 * 1000,
    });
    await prisma.session.create({
      data: {
        session_token: `SES-TEST-PROC-${now}`,
        user_id: procurement.id,
        expires_at: new Date(now + 7200 * 1000),
      },
    });

    // 4. Test SUPER_ADMIN query
    console.log('\n--- 2. Verifying SUPER_ADMIN Full Audit Visibility ---');
    const saRes = await makeGetRequest('/api/activity/recent?limit=50', superAdminToken);
    assert(saRes.status === 200, 'SUPER_ADMIN receives HTTP 200 from /api/activity/recent');
    assert(saRes.body.feedScope === 'SYSTEM_AUDIT', 'SUPER_ADMIN feedScope is "SYSTEM_AUDIT"');
    assert(saRes.body.feedLabel === 'System & Security Audit Feed', 'SUPER_ADMIN feedLabel is "System & Security Audit Feed"');

    const saLogIds = saRes.body.activities.map((a) => a.id);
    assert(saLogIds.includes(log1.id), 'SUPER_ADMIN sees operational WO_RELEASED log');
    assert(saLogIds.includes(log2.id), 'SUPER_ADMIN sees operational GRN_RECORDED log');
    assert(saLogIds.includes(log3.id), 'SUPER_ADMIN sees their own PO_CREATED log');
    assert(saLogIds.includes(log4.id), 'SUPER_ADMIN sees their own LOGIN log');
    assert(saLogIds.includes(log5.id), 'SUPER_ADMIN sees sensitive ROLE_PERMISSIONS_UPDATED log');
    assert(saLogIds.includes(log6.id), 'SUPER_ADMIN sees sensitive USER_DEACTIVATED log');
    assert(saLogIds.includes(log7.id), 'SUPER_ADMIN sees sensitive PASSWORD_RESET_OVERRIDE log');

    // 5. Test ADMIN query & strict isolation
    console.log('\n--- 3. Verifying ADMIN Role-Scoped Operational Isolation ---');
    const adminRes = await makeGetRequest('/api/activity/recent?limit=50', adminToken);
    assert(adminRes.status === 200, 'ADMIN receives HTTP 200 from /api/activity/recent');
    assert(adminRes.body.feedScope === 'PLANT_OPERATIONS', 'ADMIN feedScope is "PLANT_OPERATIONS"');
    assert(adminRes.body.feedLabel === 'Plant Operations Feed', 'ADMIN feedLabel is "Plant Operations Feed"');

    const adminLogIds = adminRes.body.activities.map((a) => a.id);

    // Requirement: Plant operational actions taken by standard users remain visible to ADMIN
    assert(adminLogIds.includes(log1.id), 'ADMIN sees operational WO_RELEASED taken by standard user');
    assert(adminLogIds.includes(log2.id), 'ADMIN sees operational GRN_RECORDED taken by standard user');

    // Requirement: Actions taken by SUPER_ADMIN never leak into response when authenticated as ADMIN
    assert(!adminLogIds.includes(log3.id), 'ADMIN CANNOT see PO_CREATED taken by SUPER_ADMIN (actor isolation)');
    assert(!adminLogIds.includes(log4.id), 'ADMIN CANNOT see LOGIN event of SUPER_ADMIN (actor isolation)');

    // Requirement: Sensitive governance actions are strictly excluded from ADMIN
    assert(!adminLogIds.includes(log5.id), 'ADMIN CANNOT see ROLE_PERMISSIONS_UPDATED (sensitive governance exclusion)');
    assert(!adminLogIds.includes(log6.id), 'ADMIN CANNOT see USER_DEACTIVATED (sensitive governance exclusion)');
    assert(!adminLogIds.includes(log7.id), 'ADMIN CANNOT see action targeting SUPER_ADMIN account');

    // Verify no activity has superadmin role visible in user object
    const anySuperAdminActor = adminRes.body.activities.some((a) => a.user && a.user.role === 'SUPER_ADMIN');
    assert(!anySuperAdminActor, 'Zero activities returned to ADMIN have actor role "SUPER_ADMIN"');

    // 6. Test Parameter Tampering / IDOR Prevention for ADMIN
    console.log('\n--- 4. Verifying IDOR & Parameter Tampering Prevention for ADMIN ---');
    // Attempt to explicitly query sensitive governance action
    const tamperRes = await makeGetRequest('/api/activity/recent?action=ROLE_PERMISSIONS_UPDATED', adminToken);
    assert(tamperRes.status === 200, 'Tampered query returns HTTP 200 without crashing');
    const tamperLogs = tamperRes.body.activities || [];
    assert(tamperLogs.length === 0, 'Tampered action query returns exactly 0 records (sensitive action blocked)');

    const tamperRes2 = await makeGetRequest('/api/activity/recent?action=USER_DEACTIVATED', adminToken);
    assert(tamperRes2.body.activities.length === 0, 'Tampered USER_DEACTIVATED query returns exactly 0 records');

    // 7. Test Standard User Isolation
    console.log('\n--- 5. Verifying Standard Staff Personal Activity Feed ---');
    const procRes = await makeGetRequest('/api/activity/recent?limit=50', procurementToken);
    assert(procRes.status === 200, 'Standard staff receives HTTP 200');
    assert(procRes.body.feedScope === 'USER_ACTIVITY', 'Standard staff feedScope is "USER_ACTIVITY"');
    assert(procRes.body.feedLabel === 'My Activity Feed', 'Standard staff feedLabel is "My Activity Feed"');

    const procLogs = procRes.body.activities;
    const allBelongToProcurement = procLogs.every((a) => a.user.id === procurement.id);
    assert(allBelongToProcurement, 'All activity records returned to standard staff belong strictly to their user ID');

    // 8. Clean up created sessions
    await prisma.session.deleteMany({
      where: {
        session_token: {
          in: [`SES-TEST-SA-${now}`, `SES-TEST-ADM-${now}`, `SES-TEST-PROC-${now}`],
        },
      },
    });
  } finally {
    // Clean up test audit logs
    if (createdTestLogIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { id: { in: createdTestLogIds } },
      });
      console.log(`\n  Cleaned up ${createdTestLogIds.length} test audit logs from database.`);
    }
    await prisma.$disconnect();
  }

  console.log('\n========================================================================');
  console.log(`   TEST RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
  console.log('========================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
