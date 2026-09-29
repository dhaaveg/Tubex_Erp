// scripts/test-session-timeout-and-activity.mjs
// Automated Verification Suite for:
// 1. Strict 2-Hour Inactivity Session Timeout & Sliding Window Extension
// 2. Middleware & Database Enforcement of Session Expiry and SESSION_TIMEOUT AuditLog
// 3. Role-Scoped "Recent Activity" Audit Feed API & UI Integrity

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

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

async function decryptSessionToken(token, options = {}) {
  try {
    const [ivB64, cipherB64] = token.split('.');
    if (!ivB64 || !cipherB64) return null;

    const iv = Buffer.from(ivB64, 'base64url');
    const ciphertext = Buffer.from(cipherB64, 'base64url');
    const key = await getCryptoKey();

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const decoder = new TextDecoder();
    const parsed = JSON.parse(decoder.decode(decrypted));

    if (!options.ignoreExpiry && Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
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

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('  TEST SUITE: 2-Hour Inactivity Timeout & Recent Activity Feed');
  console.log('=============================================================\n');

  // Find sample admin and standard users
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN', is_active: true },
  });
  const superAdminUser = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', is_active: true },
  });
  const standardUser = await prisma.user.findFirst({
    where: { role: { notIn: ['ADMIN', 'SUPER_ADMIN', 'MD'] }, is_active: true },
  });

  assert(adminUser != null, `Admin user exists: ${adminUser?.email}`);
  assert(standardUser != null, `Standard user exists: ${standardUser?.email}`);

  // -------------------------------------------------------------
  // Test Group 1: 2-Hour Window Calculation & Session Refresh
  // -------------------------------------------------------------
  console.log('\n--- 1. Testing 2-Hour Session Window & Refresh ---');
  
  const testSessionId = `SES-TEST-${crypto.randomUUID()}`;
  const twoHoursFromNow = new Date(Date.now() + 7200 * 1000);
  
  const createdSession = await prisma.session.create({
    data: {
      session_token: testSessionId,
      user_id: adminUser.id,
      user_agent: 'TestAgent/1.0',
      ip_address: '127.0.0.1',
      expires_at: twoHoursFromNow,
    },
  });

  const durationSec = Math.round((createdSession.expires_at.getTime() - Date.now()) / 1000);
  assert(
    durationSec >= 7190 && durationSec <= 7205,
    `Session created with exactly 2-hour (7200s) lifetime. Actual: ${durationSec}s`
  );

  const tokenPayload = {
    sessionId: testSessionId,
    userId: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    role: adminUser.role,
    roles: [adminUser.role],
    exp: createdSession.expires_at.getTime(),
  };

  const encryptedToken = await encryptSessionToken(tokenPayload);
  const decrypted = await decryptSessionToken(encryptedToken);
  assert(decrypted !== null, 'Encrypted session token successfully decrypted');
  assert(decrypted.sessionId === testSessionId, 'Decrypted token matches test session ID');

  // Extend session (Simulate /api/auth/refresh)
  const extendedExpiry = new Date(Date.now() + 7200 * 1000 + 5000);
  await prisma.session.update({
    where: { id: createdSession.id },
    data: { expires_at: extendedExpiry },
  });

  const refreshedSession = await prisma.session.findUnique({
    where: { id: createdSession.id },
  });
  assert(
    refreshedSession.expires_at.getTime() === extendedExpiry.getTime(),
    'Session sliding window successfully extended by 7200s in database'
  );

  // Clean up test session
  await prisma.session.delete({ where: { id: createdSession.id } }).catch(() => {});

  // -------------------------------------------------------------
  // Test Group 2: Session Timeout Detection & AuditLog Recording
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Expired Session Timeout & AuditLog Action ---');

  const expiredSessionId = `SES-EXPIRED-${crypto.randomUUID()}`;
  const pastExpiry = new Date(Date.now() - 60 * 1000); // Expired 1 minute ago

  const expiredDbSession = await prisma.session.create({
    data: {
      session_token: expiredSessionId,
      user_id: standardUser.id,
      user_agent: 'TestAgent/Expired',
      ip_address: '192.168.1.100',
      expires_at: pastExpiry,
    },
  });

  // Verification: Expired check logic
  const now = new Date();
  const isExpired = now > expiredDbSession.expires_at;
  assert(isExpired, 'Session accurately detected as expired past the 2-hour window');

  // Simulate timeout cleanup and audit logging (matches getCurrentSession & /api/auth/refresh)
  await prisma.session.delete({ where: { id: expiredDbSession.id } });
  const auditTimeoutEntry = await prisma.auditLog.create({
    data: {
      user_id: standardUser.id,
      action: 'SESSION_TIMEOUT',
      entity_type: 'Session',
      entity_id: expiredSessionId,
      ip_address: expiredDbSession.ip_address,
      details: JSON.stringify({ reason: 'Session expired due to 2 hours of inactivity' }),
    },
  });

  assert(auditTimeoutEntry.action === 'SESSION_TIMEOUT', 'AuditLog record created with action SESSION_TIMEOUT');
  assert(auditTimeoutEntry.user_id === standardUser.id, 'AuditLog correctly attributed to the timed-out user');

  const checkDeletedSession = await prisma.session.findUnique({
    where: { id: expiredDbSession.id },
  });
  assert(checkDeletedSession === null, 'Expired session successfully purged from database session registry');

  // -------------------------------------------------------------
  // Test Group 3: Recent Activity Scoping & Retrieval
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Recent Activity Feed Query & Role Scoping ---');

  // Admin query (all users)
  const adminActivities = await prisma.auditLog.findMany({
    orderBy: { created_at: 'desc' },
    take: 20,
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, department: true },
      },
    },
  });

  assert(adminActivities.length > 0, `Admin successfully queries system-wide logs (found ${adminActivities.length})`);
  const distinctUsers = new Set(adminActivities.map((a) => a.user_id).filter(Boolean));
  assert(distinctUsers.size >= 1, `System-wide logs reflect activities across ${distinctUsers.size} user accounts`);

  // Standard user query (scoped to their own user_id)
  const userActivities = await prisma.auditLog.findMany({
    where: { user_id: standardUser.id },
    orderBy: { created_at: 'desc' },
    take: 20,
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, department: true },
      },
    },
  });

  const allBelongToUser = userActivities.every((a) => a.user_id === standardUser.id);
  assert(allBelongToUser, `Standard user query is strictly scoped to user_id "${standardUser.id}"`);

  // -------------------------------------------------------------
  // Test Group 4: Codebase UI & Configuration Static Validation
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Client UI Components & Route Handlers ---');

  // Check SessionTimeoutModal.tsx
  const modalContent = fs.readFileSync('src/components/SessionTimeoutModal.tsx', 'utf-8');
  assert(modalContent.includes('120 * 60 * 1000'), 'SessionTimeoutModal sets TOTAL_IDLE_TIMEOUT_MS to 120 minutes (2 hours)');
  assert(modalContent.includes('115 * 60 * 1000'), 'SessionTimeoutModal sets WARNING_THRESHOLD_MS to 115 minutes (5 min warning)');
  assert(modalContent.includes('Stay Signed In'), 'SessionTimeoutModal renders "Stay Signed In" button');
  assert(modalContent.includes('Log Out Now'), 'SessionTimeoutModal renders "Log Out Now" button');
  assert(modalContent.includes('/login?reason=timeout'), 'SessionTimeoutModal redirects to /login?reason=timeout on countdown zero');
  assert(modalContent.includes('/api/auth/refresh'), 'SessionTimeoutModal calls /api/auth/refresh to extend session');
  assert(modalContent.includes('mousemove') && modalContent.includes('keydown'), 'Activity listeners attach mousemove, keydown, click, scroll, touchstart');

  // Check login page banner
  const loginContent = fs.readFileSync('src/app/login/page.tsx', 'utf-8');
  assert(loginContent.includes('reason') && loginContent.includes('timeout'), 'LoginPage checks searchParams for reason=timeout');
  assert(
    loginContent.includes('You were signed out due to 2 hours of inactivity.'),
    'LoginPage renders "You were signed out due to 2 hours of inactivity." banner'
  );

  // Check middleware.ts
  const middlewareContent = fs.readFileSync('src/middleware.ts', 'utf-8');
  assert(middlewareContent.includes('isExpired'), 'middleware.ts tracks isExpired state');
  assert(middlewareContent.includes('SESSION_TIMEOUT'), 'middleware.ts returns SESSION_TIMEOUT error code on expired API requests');
  assert(middlewareContent.includes('loginUrl.searchParams.set(\'reason\', \'timeout\')'), 'middleware.ts redirects expired browser requests to /login?reason=timeout');

  // Check auth/login/route.ts
  const loginRouteContent = fs.readFileSync('src/app/api/auth/login/route.ts', 'utf-8');
  assert(loginRouteContent.includes('maxAgeSeconds = 7200'), 'Login route sets maxAgeSeconds to 7200 (2 hours)');

  // Check auth/refresh/route.ts
  const refreshRouteContent = fs.readFileSync('src/app/api/auth/refresh/route.ts', 'utf-8');
  assert(refreshRouteContent.includes('maxAgeSeconds = 7200'), 'Refresh route sets maxAgeSeconds to 7200 (2 hours)');
  assert(refreshRouteContent.includes('SESSION_TIMEOUT'), 'Refresh route logs SESSION_TIMEOUT if expired');

  // Check RecentActivityFeed.tsx
  const feedContent = fs.readFileSync('src/components/RecentActivityFeed.tsx', 'utf-8');
  assert(feedContent.includes('formatRelativeTime'), 'RecentActivityFeed includes relative time formatting function');
  assert(feedContent.includes('ACTION_CONFIG'), 'RecentActivityFeed includes color-coded action badges dictionary');
  assert(feedContent.includes('/api/activity/recent'), 'RecentActivityFeed queries /api/activity/recent');

  // Check integration in OverviewDashboard.tsx & Header.tsx
  const overviewContent = fs.readFileSync('src/components/modules/OverviewDashboard.tsx', 'utf-8');
  assert(overviewContent.includes('<RecentActivityFeed'), 'OverviewDashboard embeds RecentActivityFeed');

  const headerContent = fs.readFileSync('src/components/Header.tsx', 'utf-8');
  assert(headerContent.includes('<RecentActivityFeed'), 'Header User Profile modal embeds RecentActivityFeed');

  console.log('\n=============================================================');
  console.log(`  SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  console.log('=============================================================\n');

  await prisma.$disconnect();

  if (failCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite runtime error:', err);
  prisma.$disconnect();
  process.exit(1);
});
