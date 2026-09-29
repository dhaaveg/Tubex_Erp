// src/lib/auth.ts
// Server-Only Authentication & Session Management Library

import { cookies } from 'next/headers';
import prisma from './prisma';
import { argon2id, argon2Verify } from 'hash-wasm';
import {
  Role,
  SafeUser,
  SessionPayload,
  SESSION_COOKIE_NAME,
  MODULE_ACCESS_MAP,
  canAccessModule,
  getUserQueryFilter,
  maskAuthorIdentity,
  parseRoles,
} from './auth-types';

export * from './auth-types';

const SESSION_SECRET = process.env.SESSION_SECRET || 'eot_couplings_super_secret_auth_encryption_key_2026_xyz';

// -------------------------------------------------------------
// 1. WebCrypto AES-GCM Encryption / Decryption for Session Cookie
// -------------------------------------------------------------
async function getCryptoKey(): Promise<CryptoKey> {
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

export async function encryptSessionToken(payload: SessionPayload): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as any }, key, data);

  const ivB64 = Buffer.from(iv).toString('base64url');
  const cipherB64 = Buffer.from(encrypted).toString('base64url');
  return `${ivB64}.${cipherB64}`;
}

export async function decryptSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const [ivB64, cipherB64] = token.split('.');
    if (!ivB64 || !cipherB64) return null;

    const iv = Buffer.from(ivB64, 'base64url');
    const ciphertext = Buffer.from(cipherB64, 'base64url');
    const key = await getCryptoKey();

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as any }, key, ciphertext as any);
    const decoder = new TextDecoder();
    const parsed = JSON.parse(decoder.decode(decrypted)) as SessionPayload;

    if (Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// 2. Password Hashing (Argon2id via hash-wasm)
// -------------------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return await argon2id({
    password,
    salt,
    iterations: 2,
    memorySize: 19456,
    parallelism: 1,
    hashLength: 32,
    outputType: 'encoded',
  });
}

export async function verifyPassword(hashString: string, password: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash: hashString });
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// 3. User & Session Sanitation
// -------------------------------------------------------------
export function sanitizeUser(user: any): SafeUser {
  const roles = parseRoles(user);
  const primaryRole = roles[0] || (user.role as Role) || 'PROCUREMENT';
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: primaryRole,
    roles: roles,
    department: user.department || null,
    is_active: user.is_active,
    force_password_change: user.force_password_change,
    last_login_at: user.last_login_at,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

// -------------------------------------------------------------
// 4. Server-Side Guard Helpers
// -------------------------------------------------------------

/**
 * Retrieves and validates the current active session and user from database.
 * Returns null if unauthenticated, expired, or user is deactivated.
 */
export async function getCurrentSession(): Promise<{ user: SafeUser; session: any } | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await decryptSessionToken(token);
  if (!payload) return null;

  const dbSession = await prisma.session.findUnique({
    where: { session_token: payload.sessionId },
    include: { user: true },
  });

  if (!dbSession) return null;
  if (new Date() > dbSession.expires_at) {
    await prisma.session.delete({ where: { id: dbSession.id } }).catch(() => {});
    return null;
  }

  if (!dbSession.user || !dbSession.user.is_active) {
    // If user is deactivated, immediately purge session
    await prisma.session.delete({ where: { id: dbSession.id } }).catch(() => {});
    return null;
  }

  return {
    user: sanitizeUser(dbSession.user),
    session: dbSession,
  };
}

/**
 * Requires an active user session. Throws error with HTTP 401 code if missing.
 */
export async function requireAuth(): Promise<{ user: SafeUser; session: any }> {
  const current = await getCurrentSession();
  if (!current) {
    const err: any = new Error('Unauthorized: Authentication required');
    err.status = 401;
    throw err;
  }
  return current;
}

/**
 * Requires an active user session with at least one of the allowed roles.
 * Throws error with HTTP 403 code if not authorized.
 */
export async function requireRole(allowedRoles: Role[]): Promise<{ user: SafeUser; session: any }> {
  const current = await requireAuth();
  const userRoles = current.user.roles && current.user.roles.length > 0 ? current.user.roles : [current.user.role];
  const hasAccess = userRoles.some((r) => allowedRoles.includes(r));
  if (!hasAccess) {
    const err: any = new Error(`Forbidden: Insufficient privileges for roles [${userRoles.join(', ')}]`);
    err.status = 403;
    throw err;
  }
  return current;
}
