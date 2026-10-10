// src/lib/lov-auth.ts
// Strict RBAC Verification, Security Logging, and Audit Trails for List of Values (LOV)

import { NextResponse } from 'next/server';
import prisma from './prisma';
import { getCurrentSession } from './auth';
import { logger } from './logger';

export const LOV_FORBIDDEN_MESSAGE =
  'Access denied. Only Super Admin or Admin can create, modify, or delete List of Values (LOV).';

export interface LovAuthResult {
  isAuthorized: boolean;
  userId: string | null;
  role: string | null;
  clientIp: string;
  user: any | null;
}

/**
 * Extracts session and verifies if the user has SUPER_ADMIN or ADMIN role.
 * Non-admin roles (PROCUREMENT, MANUFACTURING, SALES, INVENTORY, MD, QA, or unauthenticated) are flagged as unauthorized.
 */
export async function verifyLovMutationAuth(request: Request): Promise<LovAuthResult> {
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  let userId: string | null = null;
  let role: string | null = null;
  let isAuthorized = false;
  let user: any = null;

  try {
    const sessionContext = await getCurrentSession();
    if (sessionContext?.user) {
      user = sessionContext.user;
      userId = user.id || null;
      role = user.role || null;
      const roles: string[] = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : (role ? [role] : []);
      isAuthorized = roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
    }
  } catch {
    isAuthorized = false;
  }

  return { isAuthorized, userId, role, clientIp, user };
}

/**
 * Rejects unauthorized LOV mutation attempts with HTTP 403 Forbidden,
 * logs a security warning in logs/error-YYYY-MM-DD.log,
 * and records an entry in the AuditLog table.
 */
export async function handleUnauthorizedLovMutation(
  request: Request,
  authResult: LovAuthResult,
  targetId?: string | null,
  category?: string | null
): Promise<NextResponse> {
  const method = request.method.toUpperCase();
  const url = new URL(request.url).pathname;

  // 1. Record security warning in logs/error-YYYY-MM-DD.log
  logger.logError({
    method,
    url,
    statusCode: 403,
    userId: authResult.userId,
    role: authResult.role,
    clientIp: authResult.clientIp,
    error: new Error(
      `[SECURITY WARNING] Unauthorized attempt to mutate List of Values (LOV) [${method} ${url}] by user ${
        authResult.userId || 'anonymous'
      } with role ${authResult.role || 'unauthenticated'}`
    ),
    meta: {
      action: 'LOV_UNAUTHORIZED_MUTATION_ATTEMPT',
      targetId: targetId || null,
      category: category || null,
      error: LOV_FORBIDDEN_MESSAGE,
    },
  });

  // 2. Record security warning in database AuditLog table
  await prisma.auditLog.create({
    data: {
      user_id: authResult.userId || null,
      action: 'LOV_UNAUTHORIZED_MUTATION_ATTEMPT',
      entity_type: 'ListOfValue',
      entity_id: targetId || null,
      ip_address: authResult.clientIp,
      details: JSON.stringify({
        method,
        url,
        userId: authResult.userId || null,
        role: authResult.role || 'unauthenticated',
        targetId: targetId || null,
        category: category || null,
        error: LOV_FORBIDDEN_MESSAGE,
      }),
    },
  }).catch(() => {});

  // 3. Reject with HTTP 403 Forbidden payload
  return NextResponse.json(
    {
      success: false,
      error: LOV_FORBIDDEN_MESSAGE,
    },
    { status: 403 }
  );
}

/**
 * Records successful LOV creations, updates, deletions, and reorders in the AuditLog table.
 */
export async function logLovSuccessAudit(
  action: 'LOV_CREATED' | 'LOV_UPDATED' | 'LOV_DELETED' | 'LOV_REORDERED',
  authResult: LovAuthResult,
  entityId: string | null,
  details: Record<string, any>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      user_id: authResult.userId || null,
      action,
      entity_type: 'ListOfValue',
      entity_id: entityId,
      ip_address: authResult.clientIp,
      details: JSON.stringify({
        userId: authResult.userId,
        role: authResult.role,
        timestamp: new Date().toISOString(),
        ...details,
      }),
    },
  }).catch(() => {});
}
