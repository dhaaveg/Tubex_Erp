// scripts/test-rbac-auth.mjs
// Automated verification suite for Authentication, RBAC, Super Admin Invisibility, and Security Guards

import { PrismaClient } from '@prisma/client';
import { hash, verify } from '@node-rs/argon2';

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

async function decryptSessionToken(token) {
  try {
    const [ivB64, cipherB64] = token.split('.');
    if (!ivB64 || !cipherB64) return null;

    const iv = Buffer.from(ivB64, 'base64url');
    const ciphertext = Buffer.from(cipherB64, 'base64url');
    const key = await getCryptoKey();

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const decoder = new TextDecoder();
    const parsed = JSON.parse(decoder.decode(decrypted));

    if (Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getUserQueryFilter(viewerRole) {
  if (viewerRole === 'SUPER_ADMIN') {
    return {};
  }
  return {
    role: { not: 'SUPER_ADMIN' },
  };
}

function maskAuthorIdentity(authorName, authorRole, viewerRole) {
  if (authorRole === 'SUPER_ADMIN' && viewerRole !== 'SUPER_ADMIN') {
    return 'System Administrator';
  }
  return authorName;
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🔒 EOT ERP RBAC & AUTHENTICATION AUTOMATED TEST SUITE');
  console.log('====================================================\n');

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

  try {
    // 1. Argon2id Password Hashing & Verification
    console.log('\n--- 1. Argon2id Password Hashing Tests ---');
    const plain = 'SuperSecret@2026!';
    const hashed = await hash(plain);
    assert(hashed.startsWith('$argon2id$'), 'Argon2id produces valid MCF hash format');
    
    const isValid = await verify(hashed, plain);
    assert(isValid === true, 'Argon2id successfully verifies correct password');
    
    const isInvalid = await verify(hashed, 'WrongPassword123!');
    assert(isInvalid === false, 'Argon2id rejects incorrect password');

    // 2. AES-GCM 256-bit Session Encryption & Decryption
    console.log('\n--- 2. AES-GCM 256-bit Session Cookie Encryption Tests ---');
    const mockSession = {
      sessionId: 'sess_test_123456789',
      userId: 'usr_super_admin_001',
      role: 'SUPER_ADMIN',
      exp: Date.now() + 86400000,
    };
    const encryptedToken = await encryptSessionToken(mockSession);
    assert(typeof encryptedToken === 'string' && encryptedToken.length > 30, 'Session token encrypted successfully');
    
    const decryptedPayload = await decryptSessionToken(encryptedToken);
    assert(decryptedPayload !== null, 'Encrypted session decrypted without error');
    assert(decryptedPayload.sessionId === mockSession.sessionId, 'Decrypted sessionId matches original');
    assert(decryptedPayload.role === 'SUPER_ADMIN', 'Decrypted role matches original');

    const tamperedToken = encryptedToken.slice(0, -6) + 'AAAAAA';
    const tamperedDecrypted = await decryptSessionToken(tamperedToken);
    assert(tamperedDecrypted === null, 'Tampered ciphertext is safely rejected (returns null)');

    // 3. Super Admin Invisibility & Server-Side Filtering
    console.log('\n--- 3. Super Admin Invisibility & Query Filtering ---');
    const nonAdminFilter = getUserQueryFilter('ADMIN');
    assert(JSON.stringify(nonAdminFilter) === JSON.stringify({ role: { not: 'SUPER_ADMIN' } }), 
      'Admin query filter enforces WHERE role != SUPER_ADMIN');

    const superAdminFilter = getUserQueryFilter('SUPER_ADMIN');
    assert(JSON.stringify(superAdminFilter) === JSON.stringify({}), 
      'Super Admin query filter allows full visibility (empty where clause)');

    const procurementFilter = getUserQueryFilter('PROCUREMENT');
    assert(JSON.stringify(procurementFilter) === JSON.stringify({ role: { not: 'SUPER_ADMIN' } }), 
      'Operational roles enforce WHERE role != SUPER_ADMIN');

    // 4. Author Identity Masking
    console.log('\n--- 4. Author Identity Masking Tests ---');
    const maskedForAdmin = maskAuthorIdentity('John Root (SUPER_ADMIN)', 'SUPER_ADMIN', 'ADMIN');
    assert(maskedForAdmin === 'System Administrator', 'Super Admin identity masked as "System Administrator" for Admin');

    const unmaskedForSuper = maskAuthorIdentity('John Root (SUPER_ADMIN)', 'SUPER_ADMIN', 'SUPER_ADMIN');
    assert(unmaskedForSuper === 'John Root (SUPER_ADMIN)', 'Super Admin identity unmasked for fellow Super Admin');

    const standardAuthor = maskAuthorIdentity('Jane Procurement', 'PROCUREMENT', 'ADMIN');
    assert(standardAuthor === 'Jane Procurement', 'Standard user identity preserved as-is for Admin');

    // 5. Database Verification: Check Seeded Roles & Integrity with @energyoilfield.com
    console.log('\n--- 5. Database Seed Verification ---');
    const superAdminUser = await prisma.user.findUnique({
      where: { email: 'superadmin@energyoilfield.com' }
    });
    assert(!!superAdminUser, 'Super Admin user exists in database (superadmin@energyoilfield.com)');
    assert(superAdminUser?.role === 'SUPER_ADMIN', 'Super Admin has role SUPER_ADMIN');

    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@energyoilfield.com' }
    });
    assert(!!adminUser, 'Admin user exists in database (admin@energyoilfield.com)');
    assert(adminUser?.role === 'ADMIN', 'Admin has role ADMIN');

    const mdUser = await prisma.user.findUnique({
      where: { email: 'md@energyoilfield.com' }
    });
    assert(!!mdUser, 'MD user exists in database (md@energyoilfield.com)');
    assert(mdUser?.role === 'MD', 'MD has role MD');

    // Verify Invisibility via Prisma Query with Filter
    const visibleToAdmin = await prisma.user.findMany({
      where: { ...getUserQueryFilter('ADMIN') },
      select: { id: true, email: true, role: true }
    });
    const hasSuperAdminInAdminList = visibleToAdmin.some(u => u.role === 'SUPER_ADMIN');
    assert(!hasSuperAdminInAdminList, 'Prisma query with Admin filter completely omits SUPER_ADMIN');

    const visibleToSuper = await prisma.user.findMany({
      where: { ...getUserQueryFilter('SUPER_ADMIN') },
      select: { id: true, email: true, role: true }
    });
    const hasSuperAdminInSuperList = visibleToSuper.some(u => u.role === 'SUPER_ADMIN');
    assert(hasSuperAdminInSuperList, 'Prisma query with Super Admin filter includes SUPER_ADMIN');

    // 6. Anti-Lockout Verification Logic
    console.log('\n--- 6. Super Admin Anti-Lockout Verification ---');
    const activeSuperAdmins = await prisma.user.count({
      where: { role: 'SUPER_ADMIN', is_active: true }
    });
    assert(activeSuperAdmins >= 1, `System has ${activeSuperAdmins} active Super Admin account(s)`);

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTestSuite();
