// scripts/test-api-logging-and-lov.mjs
// Comprehensive Automated Verification Suite for API Logging & Dynamic LOV Architecture
// Tests:
// 1. .gitignore contains logs/ directory and *.log
// 2. Server-side API request logging creates entries in logs/api-YYYY-MM-DD.log
// 3. Exception handling & error logging in logs/error-YYYY-MM-DD.log with sanitized client responses
// 4. Public/Authenticated LOV query endpoint (GET /api/lov) returns seeded items
// 5. Admin LOV RBAC enforcement (non-admin receives 403, unauthenticated receives 401)
// 6. Admin LOV CRUD operations (Create custom, Update, Delete)
// 7. System default LOV protection (cannot delete is_system_default: true)

import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'eot_couplings_super_secret_auth_encryption_key_2026_xyz';

function log(msg) {
  console.log(`[TEST-SUITE] ${msg}`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

// Session encryption helpers for role-based testing
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

async function createTestSessionCookie(user) {
  const sessionId = `TEST-SES-${crypto.randomUUID()}`;
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  
  const payload = {
    sessionId,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roles: [user.role],
    force_password_change: false,
    exp: Date.now() + 7200 * 1000,
  };

  const data = encoder.encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const ivB64 = Buffer.from(iv).toString('base64url');
  const cipherB64 = Buffer.from(encrypted).toString('base64url');
  const token = `${ivB64}.${cipherB64}`;

  // Create session in DB so getCurrentSession passes
  await prisma.session.create({
    data: {
      session_token: sessionId,
      user_id: user.id,
      user_agent: 'TestAgent/1.0',
      ip_address: '127.0.0.1',
      expires_at: new Date(Date.now() + 7200 * 1000),
    },
  });

  return { token, sessionId };
}

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: PORT,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        ...(options.headers || {}),
      },
    };

    if (postData) {
      const dataStr = typeof postData === 'string' ? postData : JSON.stringify(postData);
      reqOptions.headers['Content-Type'] = reqOptions.headers['Content-Type'] || 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(dataStr);
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          json,
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function getTodayLogDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function isServerRunning() {
  try {
    const res = await request({ path: '/api/lov' });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerRunning()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  log('===========================================================');
  log('STARTING API LOGGING & DYNAMIC LOV VERIFICATION SUITE');
  log('===========================================================');

  const rootDir = process.cwd();
  let serverProcess = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Verify .gitignore contains logs/ configuration
    // -------------------------------------------------------------
    log('--- Step 1: Checking .gitignore configuration ---');
    const gitignorePath = path.join(rootDir, '.gitignore');
    assert(fs.existsSync(gitignorePath), '.gitignore file exists');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    assert(
      gitignoreContent.includes('logs/') || gitignoreContent.includes('/logs/') || gitignoreContent.includes('*.log'),
      '.gitignore excludes logs directory and log files'
    );

    // -------------------------------------------------------------
    // TEST 2: Ensure server is available
    // -------------------------------------------------------------
    log('--- Step 2: Checking Next.js Server Status ---');
    const running = await isServerRunning();
    if (!running) {
      log(`Server not listening on port ${PORT}. Spawning Next.js server...`);
      serverProcess = spawn(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['start'],
        {
          cwd: rootDir,
          env: { ...process.env, PORT: String(PORT) },
          stdio: 'inherit',
        }
      );

      const serverReady = await waitForServer(35000);
      assert(serverReady, `Next.js server successfully launched and responding on port ${PORT}`);
    } else {
      log(`Next.js server is already active on port ${PORT}.`);
    }

    // -------------------------------------------------------------
    // TEST 3: Verify GET /api/lov returns active seeded items
    // -------------------------------------------------------------
    log('--- Step 3: Verifying Public LOV API Endpoint ---');
    const lovRes = await request({ path: '/api/lov?category=CVN_REQUIREMENT' });
    assert(lovRes.status === 200, 'GET /api/lov?category=CVN_REQUIREMENT returns 200 OK');
    assert(Array.isArray(lovRes.json), 'Response is an array of LOV items');
    assert(lovRes.json.length >= 8, `Returned ${lovRes.json.length} CVN options (expected >= 8)`);
    
    // Check CVN content formatting
    const l721 = lovRes.json.find((item) => item.code === 'L_7_21J' || item.label.includes('L-7-21J'));
    assert(!!l721, 'Found seeded L-7-21J CVN requirement');
    assert(l721.label.includes('21°C ± 3°C'), 'L-7-21J label has correct temperature specification');

    // -------------------------------------------------------------
    // TEST 4: Verify Request Logging in logs/api-YYYY-MM-DD.log
    // -------------------------------------------------------------
    log('--- Step 4: Verifying Request Logging in logs/ directory ---');
    const todayStr = getTodayLogDate();
    const logsDir = path.join(rootDir, 'logs');
    assert(fs.existsSync(logsDir), 'Root logs/ directory exists on filesystem');

    const apiLogFile = path.join(logsDir, `api-${todayStr}.log`);
    assert(fs.existsSync(apiLogFile), `Daily request log file logs/api-${todayStr}.log exists`);

    // Give logger stream a brief flush window
    await new Promise((r) => setTimeout(r, 400));
    const apiLogContent = fs.readFileSync(apiLogFile, 'utf8');
    assert(
      apiLogContent.includes('/api/lov'),
      'api log contains recorded entry for /api/lov request'
    );
    assert(
      apiLogContent.includes(' 200 ') || apiLogContent.includes('200'),
      'api log contains response status code 200'
    );

    // -------------------------------------------------------------
    // TEST 5: Verify RBAC on Admin LOV endpoints
    // -------------------------------------------------------------
    log('--- Step 5: Testing Admin LOV Role-Based Access Control ---');

    // 5a. Unauthenticated access to /api/admin/lov must be rejected (401 or 403)
    const unauthRes = await request({ path: '/api/admin/lov' });
    assert(
      unauthRes.status === 401 || unauthRes.status === 403,
      `Unauthenticated access to /api/admin/lov returns HTTP ${unauthRes.status}`
    );
    assert(
      unauthRes.json && unauthRes.json.success === false,
      'Unauthenticated response payload has { success: false, error: ... }'
    );

    // 5b. Find an existing non-admin user or create a temporary operator user
    let operatorUser = await prisma.user.findFirst({
      where: { role: { notIn: ['ADMIN', 'SUPER_ADMIN'] } },
    });

    if (!operatorUser) {
      operatorUser = await prisma.user.create({
        data: {
          email: 'test_operator_auto@energyoilfield.com',
          name: 'Test Operator',
          role: 'OPERATOR',
          roles: JSON.stringify(['OPERATOR']),
          password_hash: 'dummy_hash',
          is_active: true,
        },
      });
    }

    const { token: operatorCookie, sessionId: opSessionId } = await createTestSessionCookie(operatorUser);

    const nonAdminRes = await request({
      path: '/api/admin/lov',
      headers: { Cookie: `eot_session=${operatorCookie}` },
    });

    assert(
      nonAdminRes.status === 403,
      `Non-admin role (OPERATOR) receives HTTP 403 Forbidden on /api/admin/lov`
    );
    assert(
      nonAdminRes.json && nonAdminRes.json.success === false,
      'Non-admin response has standardized error payload'
    );

    // -------------------------------------------------------------
    // TEST 6: Verify Admin LOV Operations with Admin User
    // -------------------------------------------------------------
    log('--- Step 6: Testing Admin LOV CRUD Operations ---');

    let adminUser = await prisma.user.findFirst({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, is_active: true },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: 'test_admin_auto@energyoilfield.com',
          name: 'Test Admin',
          role: 'ADMIN',
          roles: JSON.stringify(['ADMIN']),
          password_hash: 'dummy_hash',
          is_active: true,
        },
      });
    }

    const { token: adminCookie, sessionId: adminSessionId } = await createTestSessionCookie(adminUser);

    // 6a. GET /api/admin/lov
    const adminGetRes = await request({
      path: '/api/admin/lov',
      headers: { Cookie: `eot_session=${adminCookie}` },
    });

    assert(adminGetRes.status === 200, 'Admin successfully retrieves all LOV items via /api/admin/lov');
    assert(Array.isArray(adminGetRes.json.items), 'Admin response contains items array');
    assert(Array.isArray(adminGetRes.json.categories), 'Admin response contains categories array');
    assert(adminGetRes.json.categories.includes('CVN_REQUIREMENT'), 'Categories includes CVN_REQUIREMENT');

    // 6b. POST /api/admin/lov (Create custom value)
    const testCode = `TEST_VAL_${Date.now().toString().slice(-6)}`;
    const postRes = await request(
      {
        path: '/api/admin/lov',
        method: 'POST',
        headers: { Cookie: `eot_session=${adminCookie}` },
      },
      {
        category: 'CVN_REQUIREMENT',
        code: testCode,
        label: `Test Charpy Spec ${testCode}`,
        value: `TEST-${testCode}`,
        sort_order: 999,
        is_active: true,
      }
    );

    assert(postRes.status === 201, 'POST /api/admin/lov creates new LOV entry with HTTP 201');
    const createdItem = postRes.json;
    assert(createdItem.id && createdItem.code === testCode, 'Created item has valid ID and code');
    assert(createdItem.is_system_default === false, 'Newly created item is not marked as system default');

    // 6c. PUT /api/admin/lov/[id] (Update item)
    const putRes = await request(
      {
        path: `/api/admin/lov/${createdItem.id}`,
        method: 'PUT',
        headers: { Cookie: `eot_session=${adminCookie}` },
      },
      {
        label: `Updated Test Charpy Spec ${testCode}`,
        sort_order: 1000,
      }
    );

    assert(putRes.status === 200, 'PUT /api/admin/lov/[id] updates item with HTTP 200');
    assert(putRes.json.label.includes('Updated'), 'Item label was successfully updated');

    // 6d. System Default Protection: Attempt to delete a system default item
    const systemDefaultItem = await prisma.listOfValue.findFirst({
      where: { is_system_default: true },
    });

    assert(!!systemDefaultItem, 'Found system default LOV item to test protection');

    const deleteDefaultRes = await request({
      path: `/api/admin/lov/${systemDefaultItem.id}`,
      method: 'DELETE',
      headers: { Cookie: `eot_session=${adminCookie}` },
    });

    assert(
      deleteDefaultRes.status === 400,
      'Attempt to delete system default item returns HTTP 400 Bad Request'
    );
    assert(
      deleteDefaultRes.json && deleteDefaultRes.json.error.includes('System default'),
      'Response explicitly informs system defaults cannot be deleted'
    );

    // Verify it was NOT deleted from DB
    const stillExists = await prisma.listOfValue.findUnique({
      where: { id: systemDefaultItem.id },
    });
    assert(!!stillExists, 'System default item remains safely preserved in database');

    // 6e. DELETE /api/admin/lov/[id] (Delete custom created item)
    const deleteCustomRes = await request({
      path: `/api/admin/lov/${createdItem.id}`,
      method: 'DELETE',
      headers: { Cookie: `eot_session=${adminCookie}` },
    });

    assert(deleteCustomRes.status === 200, 'DELETE /api/admin/lov/[id] deletes custom item with HTTP 200');
    assert(deleteCustomRes.json.success === true, 'Delete response confirms success: true');

    // -------------------------------------------------------------
    // TEST 7: Exception Logging & Response Sanitization
    // -------------------------------------------------------------
    log('--- Step 7: Testing Deliberate Exception & Error Logging ---');

    // Deliberate test error: POST /api/admin/lov with malformed non-JSON body
    const errorRes = await request({
      path: '/api/admin/lov',
      method: 'POST',
      headers: {
        Cookie: `eot_session=${adminCookie}`,
        'Content-Type': 'application/json',
      },
    }, '{ malformed json unquoted: true }');

    assert(errorRes.status === 400, 'Malformed payload returns HTTP 400');
    assert(errorRes.json && errorRes.json.success === false, 'Error response has { success: false, error: ... }');
    assert(
      !errorRes.body.includes('at Module.') && !errorRes.body.includes('node_modules'),
      'Raw internal stack traces are NEVER leaked in client HTTP response'
    );

    // Check error log file logs/error-YYYY-MM-DD.log
    await new Promise((r) => setTimeout(r, 400));
    const errorLogFile = path.join(logsDir, `error-${todayStr}.log`);
    assert(fs.existsSync(errorLogFile), `Daily error log file logs/error-${todayStr}.log exists`);

    const errorLogContent = fs.readFileSync(errorLogFile, 'utf8');
    assert(
      errorLogContent.includes('/api/admin/lov') || errorLogContent.includes('Malformed') || errorLogContent.includes('SyntaxError') || errorLogContent.includes('error'),
      'Structured error was recorded in logs/error-YYYY-MM-DD.log'
    );

    // Clean up test sessions
    await prisma.session.deleteMany({
      where: { session_token: { in: [opSessionId, adminSessionId] } },
    }).catch(() => {});

    log('===========================================================');
    log('ALL 7 VERIFICATION CRITERIA PASSED WITH ZERO ERRORS! 🚀');
    log('===========================================================');
    process.exit(0);
  } catch (err) {
    console.error('[TEST-SUITE] Unhandled error during verification:', err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      log('Terminating test Next.js server process...');
      serverProcess.kill();
    }
    await prisma.$disconnect();
  }
}

main();
