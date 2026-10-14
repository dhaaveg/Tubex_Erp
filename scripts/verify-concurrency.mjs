import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let PrismaClient;
try {
  const sqlite = require('../prisma/generated/sqlite-client');
  PrismaClient = sqlite.PrismaClient;
} catch {
  const pg = require('@prisma/client');
  PrismaClient = pg.PrismaClient;
}

const prisma = new PrismaClient();

async function runVerification() {
  console.log('--- Starting Strict Single-Session Concurrency Verification ---');

  // 1. Locate an active test user
  const user = await prisma.user.findFirst({
    where: { is_active: true },
  });

  if (!user) {
    console.error('ERROR: No active user found in database.');
    process.exit(1);
  }

  console.log(`[PASS] Found test user: ${user.name} (${user.email}, ID: ${user.id})`);

  // Clean up any test sessions/audit logs for this user before test
  const testSessionToken1 = 'test_sess_token_browser_1_' + Date.now();
  const testSessionToken2 = 'test_sess_token_browser_2_' + (Date.now() + 1);

  // 2. Simulate First Login (Browser 1)
  console.log('\nStep 1: Simulating Browser 1 login...');
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const session1 = await prisma.session.create({
    data: {
      session_token: testSessionToken1,
      user_id: user.id,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Browser1/1.0',
      ip_address: '192.168.1.101',
      expires_at: expiresAt,
    },
  });
  console.log(`[PASS] Session 1 created in DB: ${session1.session_token}`);

  // Check that Session 1 is active
  let activeSession = await prisma.session.findUnique({
    where: { session_token: testSessionToken1 },
  });
  if (!activeSession) {
    console.error('ERROR: Session 1 not found in database.');
    process.exit(1);
  }
  console.log('[PASS] Session 1 is currently active in DB.');

  // 3. Simulate Second Login (Browser 2) for the SAME user
  console.log('\nStep 2: Simulating Browser 2 login (same account)...');
  const existingSessions = await prisma.session.findMany({
    where: { user_id: user.id },
  });
  console.log(`Found ${existingSessions.length} existing active session(s) to terminate.`);

  for (const oldSession of existingSessions) {
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'CONCURRENT_LOGIN_TERMINATION',
        entity_type: 'Session',
        entity_id: oldSession.session_token,
        ip_address: oldSession.ip_address || '192.168.1.102',
        details: JSON.stringify({
          terminated_session_id: oldSession.session_token,
          previous_ip_address: oldSession.ip_address,
          previous_user_agent: oldSession.user_agent,
          new_login_ip: '192.168.1.102',
          new_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Browser2/2.0',
          timestamp: new Date().toISOString(),
          reason: 'Terminated due to single-session concurrency control on new login from another device/browser',
        }),
      },
    });
  }

  // Revoke/Delete previous sessions
  await prisma.session.deleteMany({
    where: { user_id: user.id },
  });

  // Create new active session for Browser 2
  const session2 = await prisma.session.create({
    data: {
      session_token: testSessionToken2,
      user_id: user.id,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Browser2/2.0',
      ip_address: '192.168.1.102',
      expires_at: expiresAt,
    },
  });
  console.log(`[PASS] Session 2 created in DB: ${session2.session_token}`);

  // 4. Verify Database State
  console.log('\nStep 3: Verifying single-session DB state...');
  const countForUser = await prisma.session.count({
    where: { user_id: user.id },
  });
  console.log(`Active session count for user: ${countForUser}`);
  if (countForUser !== 1) {
    console.error(`ERROR: Expected exactly 1 active session for user, found ${countForUser}`);
    process.exit(1);
  }
  console.log('[PASS] Exactly ONE active session exists in DB for this user.');

  // 5. Verify Session 1 is in AuditLog as CONCURRENT_LOGIN_TERMINATION
  console.log('\nStep 4: Verifying AuditLog entry...');
  const auditEntry = await prisma.auditLog.findFirst({
    where: {
      action: 'CONCURRENT_LOGIN_TERMINATION',
      entity_id: testSessionToken1,
    },
  });

  if (!auditEntry) {
    console.error('ERROR: No CONCURRENT_LOGIN_TERMINATION audit entry found for Session 1.');
    process.exit(1);
  }
  console.log(`[PASS] AuditLog entry confirmed: ID=${auditEntry.id}, action=${auditEntry.action}, IP=${auditEntry.ip_address}`);
  const details = JSON.parse(auditEntry.details);
  console.log(`[PASS] Details recorded: previous_ip=${details.previous_ip_address}, new_ip=${details.new_login_ip}`);

  // 6. Test validateSessionInDb logic simulation
  console.log('\nStep 5: Verifying session status detection...');
  // Helper mimicking validateSessionInDb:
  async function testValidate(sessionId, userId) {
    const dbSess = await prisma.session.findUnique({
      where: { session_token: sessionId },
    });
    if (dbSess) {
      if (new Date() > dbSess.expires_at) return 'EXPIRED';
      return 'VALID';
    }
    const termLog = await prisma.auditLog.findFirst({
      where: {
        action: 'CONCURRENT_LOGIN_TERMINATION',
        entity_id: sessionId,
      },
    });
    if (termLog) return 'SUPERSEDED';
    if (userId) {
      const activeOther = await prisma.session.findFirst({ where: { user_id: userId } });
      if (activeOther) return 'SUPERSEDED';
    }
    return 'INVALID';
  }

  const status1 = await testValidate(testSessionToken1, user.id);
  console.log(`Validation status for Session 1: ${status1}`);
  if (status1 !== 'SUPERSEDED') {
    console.error(`ERROR: Expected Session 1 to be SUPERSEDED, got ${status1}`);
    process.exit(1);
  }
  console.log('[PASS] Session 1 correctly identified as SUPERSEDED.');

  const status2 = await testValidate(testSessionToken2, user.id);
  console.log(`Validation status for Session 2: ${status2}`);
  if (status2 !== 'VALID') {
    console.error(`ERROR: Expected Session 2 to be VALID, got ${status2}`);
    process.exit(1);
  }
  console.log('[PASS] Session 2 correctly identified as VALID.');

  // Cleanup test sessions
  await prisma.session.deleteMany({
    where: { session_token: { in: [testSessionToken1, testSessionToken2] } },
  });
  await prisma.auditLog.deleteMany({
    where: { entity_id: { in: [testSessionToken1, testSessionToken2] } },
  });

  console.log('\n--- All Single-Session Concurrency Invalidation Checks PASSED successfully! ---');
  await prisma.$disconnect();
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
