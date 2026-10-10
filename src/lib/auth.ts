// src/lib/auth.ts
// Server-Only Authentication & Session Management Library

import { cookies, headers } from 'next/headers';
import prisma from './prisma';
import { argon2id, argon2Verify } from 'hash-wasm';
import {
  Role,
  SafeUser,
  SessionPayload,
  SESSION_COOKIE_NAME,
  AUTH_COOKIES_TO_PURGE,
  MODULE_ACCESS_MAP,
  canAccessModule,
  getUserQueryFilter,
  maskAuthorIdentity,
  parseRoles,
  SENSITIVE_GOVERNANCE_ACTIONS,
  isSensitiveGovernanceAction,
  OPERATIONAL_ACTIONS,
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

export async function decryptSessionToken(
  token: string,
  options?: { ignoreExpiry?: boolean }
): Promise<SessionPayload | null> {
  try {
    const [ivB64, cipherB64] = token.split('.');
    if (!ivB64 || !cipherB64) return null;

    const iv = Buffer.from(ivB64, 'base64url');
    const ciphertext = Buffer.from(cipherB64, 'base64url');
    const key = await getCryptoKey();

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as any }, key, ciphertext as any);
    const decoder = new TextDecoder();
    const parsed = JSON.parse(decoder.decode(decrypted)) as SessionPayload;

    const expMs = parsed.exp < 100000000000 ? parsed.exp * 1000 : parsed.exp;
    if (!options?.ignoreExpiry && Date.now() > expMs) {
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

  const payload = await decryptSessionToken(token, { ignoreExpiry: true });
  if (!payload) return null;

  const expMs = payload.exp < 100000000000 ? payload.exp * 1000 : payload.exp;
  const isTokenExpired = Date.now() > expMs;

  const dbSession = await prisma.session.findUnique({
    where: { session_token: payload.sessionId },
    include: { user: true },
  });

  if (!dbSession) return null;

  const isSessionExpired = isTokenExpired || new Date() > dbSession.expires_at;

  if (isSessionExpired) {
    // Delete session from DB
    await prisma.session.delete({ where: { id: dbSession.id } }).catch(() => {});
    // Record AuditLog entry for SESSION_TIMEOUT
    await prisma.auditLog.create({
      data: {
        user_id: dbSession.user_id,
        action: 'SESSION_TIMEOUT',
        entity_type: 'Session',
        entity_id: dbSession.session_token,
        ip_address: dbSession.ip_address || null,
        details: JSON.stringify({ reason: 'Session expired due to 2 hours of inactivity' }),
      },
    }).catch(() => {});

    try {
      let isSecure = false;
      try {
        const headerStore = headers();
        const proto = (headerStore.get('x-forwarded-proto') || '').toLowerCase();
        isSecure = proto === 'https';
      } catch {}
      for (const cookieName of AUTH_COOKIES_TO_PURGE) {
        cookieStore.set({
          name: cookieName,
          value: '',
          maxAge: 0,
          expires: new Date(0),
          path: '/',
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
        });
      }
    } catch {
      // In Server Components cookie mutation may be restricted; handled by middleware/client
    }

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

/**
 * Constructs the secure database query filter for audit logs.
 * Enforces strict hierarchical partitioning and prevents IDOR / privilege escalation:
 * - SUPER_ADMIN: Unrestricted visibility across all operations, user management, and governance logs.
 * - ADMIN & MD: Full operational visibility across all departments (Procurement, Shop Floor, Inventory, QA, Sales).
 *   Strict Exclusion:
 *     1. Automatically filters out any actions taken by a SUPER_ADMIN actor.
 *     2. Automatically filters out all sensitive governance actions (USER_ROLE_CHANGED, ROLE_PERMISSIONS_UPDATED, USER_DEACTIVATED, USER_DELETED, etc.).
 *     3. Automatically filters out any actions targeting a SUPER_ADMIN account.
 *     4. Rejects or neutralizes client parameter tampering (e.g. attempting to filter on sensitive actions).
 * - Standard Staff: Restricted strictly to their own individual activity entries (user_id === user.id).
 */
export async function getAuditLogQueryWhere(
  user: { id: string; role: Role; roles?: Role[] },
  options?: { actionFilter?: string | null }
): Promise<any> {
  const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
  const isAdminOrMD = userRoles.includes('ADMIN') || userRoles.includes('MD');

  const where: any = {};

  if (isSuperAdmin) {
    if (options?.actionFilter) {
      where.action = options.actionFilter;
    }
    return where;
  }

  // Retrieve all SUPER_ADMIN IDs to prevent any actions targeting them from leaking
  const superAdminUsers = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'SUPER_ADMIN' },
        { roles: { contains: 'SUPER_ADMIN' } },
      ],
    },
    select: { id: true },
  });
  const superAdminIds = superAdminUsers.map((u) => u.id);

  if (isAdminOrMD) {
    where.AND = [
      // 1. Exclude events where actor is a SUPER_ADMIN (allow system automation where user_id is null)
      {
        OR: [
          { user_id: null },
          {
            user: {
              AND: [
                { role: { not: 'SUPER_ADMIN' } },
                {
                  OR: [
                    { roles: null },
                    { roles: { not: { contains: 'SUPER_ADMIN' } } },
                  ],
                },
              ],
            },
          },
        ],
      },
      // 2. Exclude sensitive governance actions
      {
        action: {
          notIn: Array.from(SENSITIVE_GOVERNANCE_ACTIONS),
        },
      },
    ];

    // 3. Exclude any action targeting a SUPER_ADMIN account
    if (superAdminIds.length > 0) {
      where.NOT = [
        {
          entity_type: 'User',
          entity_id: { in: superAdminIds },
        },
      ];
    }

    // 4. Parameter tampering guard: if client requested an action filter, ensure it's not a sensitive action
    if (options?.actionFilter) {
      if (isSensitiveGovernanceAction(options.actionFilter)) {
        where.action = '__FORBIDDEN_SENSITIVE_ACTION__'; // Guarantees zero records leak
      } else {
        where.action = options.actionFilter;
      }
    }

    return where;
  }

  // Standard Departmental Users
  where.user_id = user.id;
  where.action = {
    notIn: Array.from(SENSITIVE_GOVERNANCE_ACTIONS),
  };

  if (options?.actionFilter) {
    if (isSensitiveGovernanceAction(options.actionFilter)) {
      where.action = '__FORBIDDEN_SENSITIVE_ACTION__';
    } else {
      where.action = options.actionFilter;
    }
  }

  return where;
}
