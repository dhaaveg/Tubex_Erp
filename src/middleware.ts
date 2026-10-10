import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'eot_session';
const AUTH_COOKIES_TO_PURGE = [
  SESSION_COOKIE_NAME,
  'token',
  'session_id',
  'refresh_token',
  'session',
  'auth_token',
];
const SESSION_SECRET = process.env.SESSION_SECRET || 'eot_couplings_super_secret_auth_encryption_key_2026_xyz';

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface DecryptedToken {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  roles?: string[];
  force_password_change?: boolean;
  exp: number;
}

async function decryptToken(
  token: string
): Promise<{ payload: DecryptedToken | null; isExpired: boolean }> {
  try {
    const [ivB64, cipherB64] = token.split('.');
    if (!ivB64 || !cipherB64) return { payload: null, isExpired: false };

    const ivBytes = base64UrlToUint8Array(ivB64);
    const cipherBytes = base64UrlToUint8Array(cipherB64);

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(SESSION_SECRET));
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes as any },
      key,
      cipherBytes as any
    );

    const decoder = new TextDecoder();
    const payload = JSON.parse(decoder.decode(decrypted)) as DecryptedToken;

    // Strict 2-hour session expiration check (support both unix seconds and milliseconds)
    const expMs = payload.exp < 100000000000 ? payload.exp * 1000 : payload.exp;
    const isExpired = Date.now() > expMs;
    return { payload: isExpired ? null : payload, isExpired };
  } catch {
    return { payload: null, isExpired: false };
  }
}

// -------------------------------------------------------------
// Edge Dynamic Permission Cache & Fallback Mapping
// -------------------------------------------------------------
let cachedMatrixByRole: Record<string, Record<string, { is_enabled: boolean; can_read: boolean; can_write: boolean }>> | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 5000; // 5 seconds in-memory TTL

const ALL_MODULES_ACTIVE_RW = {
  'overview': { is_enabled: true, can_read: true, can_write: true },
  'master-data': { is_enabled: true, can_read: true, can_write: true },
  'procurement': { is_enabled: true, can_read: true, can_write: true },
  'receiving': { is_enabled: true, can_read: true, can_write: true },
  'customer-orders': { is_enabled: true, can_read: true, can_write: true },
  'shop-floor': { is_enabled: true, can_read: true, can_write: true },
  'quality': { is_enabled: true, can_read: true, can_write: true },
  'traceability': { is_enabled: true, can_read: true, can_write: true },
  'admin-export': { is_enabled: true, can_read: true, can_write: true },
  'user-management': { is_enabled: true, can_read: true, can_write: true },
};

const ALL_MODULES_ACTIVE_RO = {
  'overview': { is_enabled: true, can_read: true, can_write: false },
  'master-data': { is_enabled: true, can_read: true, can_write: false },
  'procurement': { is_enabled: true, can_read: true, can_write: false },
  'receiving': { is_enabled: true, can_read: true, can_write: false },
  'customer-orders': { is_enabled: true, can_read: true, can_write: false },
  'shop-floor': { is_enabled: true, can_read: true, can_write: false },
  'quality': { is_enabled: true, can_read: true, can_write: false },
  'traceability': { is_enabled: true, can_read: true, can_write: false },
  'admin-export': { is_enabled: true, can_read: true, can_write: true },
  'user-management': { is_enabled: true, can_read: true, can_write: false },
};

const FALLBACK_DEFAULT_ROLES: Record<string, Record<string, { is_enabled: boolean; can_read: boolean; can_write: boolean }>> = {
  SUPER_ADMIN: { ...ALL_MODULES_ACTIVE_RW },
  ADMIN: { ...ALL_MODULES_ACTIVE_RW },
  MD: { ...ALL_MODULES_ACTIVE_RO },
  PROCUREMENT: { ...ALL_MODULES_ACTIVE_RW },
  MANUFACTURING: { ...ALL_MODULES_ACTIVE_RW },
  SALES: { ...ALL_MODULES_ACTIVE_RW },
  INVENTORY: { ...ALL_MODULES_ACTIVE_RW },
  QUALITY: { ...ALL_MODULES_ACTIVE_RW },
  OPERATOR: { ...ALL_MODULES_ACTIVE_RW },
};

function resolveModuleKey(pathname: string): string | null {
  if (pathname === '/' || pathname === '/overview' || pathname === '/dashboard' || pathname === '/home') return 'overview';
  if (
    pathname === '/master-data' ||
    pathname === '/master' ||
    pathname === '/suppliers' ||
    pathname === '/products' ||
    pathname.startsWith('/api/suppliers') ||
    pathname.startsWith('/api/products')
  ) {
    return 'master-data';
  }
  if (
    pathname === '/procurement' ||
    pathname === '/po' ||
    pathname === '/pos' ||
    pathname === '/purchase-orders' ||
    pathname === '/purchasing' ||
    pathname === '/purchases' ||
    pathname.startsWith('/api/purchase-orders')
  ) {
    return 'procurement';
  }
  if (
    pathname === '/receiving' ||
    pathname === '/tally' ||
    pathname === '/grn' ||
    pathname === '/inwarding' ||
    pathname === '/inward' ||
    pathname.startsWith('/api/grn') ||
    pathname.startsWith('/api/tally')
  ) {
    return 'receiving';
  }
  if (
    pathname === '/customer-orders' ||
    pathname === '/cpo' ||
    pathname === '/orders' ||
    pathname === '/customers' ||
    pathname === '/sales' ||
    pathname.startsWith('/api/customer-orders')
  ) {
    return 'customer-orders';
  }
  if (
    pathname === '/shop-floor' ||
    pathname === '/wo' ||
    pathname === '/wos' ||
    pathname === '/work-orders' ||
    pathname === '/shopfloor' ||
    pathname === '/production' ||
    pathname === '/manufacturing' ||
    pathname.startsWith('/api/work-orders') ||
    pathname.startsWith('/api/production-postings')
  ) {
    return 'shop-floor';
  }
  if (
    pathname === '/quality' ||
    pathname === '/qa' ||
    pathname === '/qc' ||
    pathname === '/inspection' ||
    pathname === '/rejections' ||
    pathname.startsWith('/api/rejections')
  ) {
    return 'quality';
  }
  if (pathname === '/traceability' || pathname === '/trace' || pathname.startsWith('/api/traceability')) {
    return 'traceability';
  }
  if (pathname === '/admin-export' || pathname === '/export' || pathname === '/reports' || pathname.startsWith('/api/export')) {
    return 'admin-export';
  }
  if (
    pathname === '/user-management' ||
    pathname === '/users' ||
    pathname === '/admin' ||
    pathname === '/roles' ||
    pathname.startsWith('/api/users') ||
    pathname.startsWith('/api/admin/')
  ) {
    return 'user-management';
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const rawPathname = request.nextUrl.pathname;
  // Detect subpath prefix (e.g. /dhaaveg)
  const isDhaavegPrefix = rawPathname === '/dhaaveg' || rawPathname.startsWith('/dhaaveg/');
  const prefix = isDhaavegPrefix ? '/dhaaveg' : '';
  const pathname = isDhaavegPrefix
    ? (rawPathname.slice('/dhaaveg'.length) || '/')
    : rawPathname;
  const method = request.method.toUpperCase();

  // 1. Unconditionally allow static assets, favicon, Next internals, and public images
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.png' ||
    pathname === '/app-icon.png' ||
    pathname.match(/\.(png|jpg|jpeg|svg|webp|ico)$/i)
  ) {
    if (isDhaavegPrefix) {
      return NextResponse.rewrite(new URL(pathname + request.nextUrl.search, request.url));
    }
    return NextResponse.next();
  }

  // 2. Cache Invalidation and Direct Cache Endpoint Bypass
  if (pathname === '/api/admin/role-permissions/cache') {
    if (request.nextUrl.searchParams.get('clear') === '1') {
      cachedMatrixByRole = null;
      lastCacheFetchTime = 0;
    }
    if (isDhaavegPrefix) {
      return NextResponse.rewrite(new URL(pathname + request.nextUrl.search, request.url));
    }
    return NextResponse.next();
  }

  // 3. Public Auth Routes & Dedicated LOV RBAC Endpoints
  // Note: GET /api/lov is public for standard dropdown reads across operational modules.
  // All mutations to /api/lov and all calls to /api/admin/lov are passed through
  // directly to their respective API route handlers where verifyLovMutationAuth executes strict
  // SUPER_ADMIN / ADMIN authorization, logs security warnings to logs/error-YYYY-MM-DD.log,
  // records unauthorized attempts in the AuditLog database table, and returns HTTP 403 Forbidden.
  const isAuthOrLovApiRoute =
    pathname === '/login' ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/lov' ||
    pathname.startsWith('/api/admin/lov');

  if (isAuthOrLovApiRoute) {
    if (isDhaavegPrefix) {
      return NextResponse.rewrite(new URL(pathname + request.nextUrl.search, request.url));
    }
    return NextResponse.next();
  }

  // 4. Extract and Verify Session Cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let payload: DecryptedToken | null = null;
  let isExpired = false;

  if (sessionCookie) {
    const decryptResult = await decryptToken(sessionCookie);
    payload = decryptResult.payload;
    isExpired = decryptResult.isExpired;
  }

  // If token is expired due to 2-hour inactivity:
  if (isExpired) {
    const proto = (request.headers.get('x-forwarded-proto') || '').toLowerCase();
    const isSecure = proto === 'https' || request.url.startsWith('https:');

    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json(
        { success: false, error: 'Session expired due to 2 hours of inactivity.', code: 'SESSION_TIMEOUT' },
        { status: 401 }
      );
      for (const cookieName of AUTH_COOKIES_TO_PURGE) {
        response.cookies.set({
          name: cookieName,
          value: '',
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
          expires: new Date(0),
        });
      }
      return response;
    }

    const loginUrl = new URL(`${prefix}/login`, request.url);
    loginUrl.searchParams.set('expired', 'true');
    loginUrl.searchParams.set('reason', 'timeout');
    if (pathname !== '/' && pathname !== '/login') {
      loginUrl.searchParams.set('from', rawPathname);
    }
    const response = NextResponse.redirect(loginUrl);
    for (const cookieName of AUTH_COOKIES_TO_PURGE) {
      response.cookies.set({
        name: cookieName,
        value: '',
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
    }
    return response;
  }

  // If no valid session token exists:
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid session required.' },
        { status: 401 }
      );
    }
    const loginUrl = new URL(`${prefix}/login`, request.url);
    if (pathname !== '/' && pathname !== '/login') {
      loginUrl.searchParams.set('from', rawPathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 5. Force Password Change Enforcement
  if (payload.force_password_change) {
    const isChangePasswordRoute =
      pathname === '/change-password' ||
      pathname === '/api/auth/change-password' ||
      pathname === '/api/auth/me';

    if (!isChangePasswordRoute) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Password reset required on initial login before proceeding.',
            force_password_change: true,
          },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL(`${prefix}/change-password`, request.url));
    }
  }

  // Extract all user roles (support multi-role assignment)
  const roles: string[] =
    payload.roles && payload.roles.length > 0
      ? payload.roles
      : payload.role
      ? [payload.role]
      : ['PROCUREMENT'];

  // 6. Super Admin has unrestricted core root privilege across all routes
  if (roles.includes('SUPER_ADMIN') || payload.role === 'SUPER_ADMIN') {
    if (isDhaavegPrefix) {
      return NextResponse.rewrite(new URL(pathname + request.nextUrl.search, request.url));
    }
    return NextResponse.next();
  }

  // 6b. Direct LOV Page Protection: strictly restrict LOV configuration views to Super Admin or Admin
  if (pathname === '/admin/lov' || pathname === '/lov') {
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
    if (!isAdmin) {
      const homeUrl = new URL(`${prefix}/`, request.url);
      homeUrl.searchParams.set('unauthorized', 'lov');
      return NextResponse.redirect(homeUrl);
    }
  }

  // 7. Allow self-profile updates
  if (method === 'PUT' && pathname === `/api/users/${payload.userId}`) {
    if (isDhaavegPrefix) {
      return NextResponse.rewrite(new URL(pathname + request.nextUrl.search, request.url));
    }
    return NextResponse.next();
  }

  // 8. Fetch or Sync Dynamic Permission Matrix
  const now = Date.now();
  if (!cachedMatrixByRole || now - lastCacheFetchTime > CACHE_TTL_MS) {
    try {
      const cacheUrl = new URL('/api/admin/role-permissions/cache', request.url);
      const res = await fetch(cacheUrl.toString(), {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.matrixByRole) {
          cachedMatrixByRole = data.matrixByRole;
          lastCacheFetchTime = now;
        }
      }
    } catch {
      // Fallback silently if internal fetch is unavailable
    }
  }

  const matrix = cachedMatrixByRole || FALLBACK_DEFAULT_ROLES;

  // 9. Resolve target module
  const moduleKey = resolveModuleKey(pathname);
  const targetModule = moduleKey || 'overview';

  // 10. Multi-Role Union Evaluation: Is module enabled for ANY assigned role?
  const isEnabled = roles.length === 0 || roles.includes('SUPER_ADMIN') || roles.some((r) => {
    const roleMatrix = matrix[r] || ALL_MODULES_ACTIVE_RW;
    return roleMatrix[targetModule]?.is_enabled !== false;
  });

  if (!isEnabled) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden: Assigned roles (${roles.join(', ')}) do not permit access to module "${targetModule}".`,
        },
        { status: 403 }
      );
    }
    // Prevent infinite redirect loops: never redirect to root if already at root or if unauthorized query is present
    if (pathname === '/' || pathname === '/overview' || request.nextUrl.searchParams.has('unauthorized')) {
      if (isDhaavegPrefix) {
        return NextResponse.rewrite(new URL(pathname + request.nextUrl.search, request.url));
      }
      return NextResponse.next();
    }
    const homeUrl = new URL(`${prefix}/`, request.url);
    homeUrl.searchParams.set('unauthorized', targetModule);
    return NextResponse.redirect(homeUrl);
  }

  // 11. Mutation & Write Permission Check: Can any assigned role write to this module?
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  if (isMutation) {
    const canWrite = roles.some((r) => {
      const roleMatrix = matrix[r] || ALL_MODULES_ACTIVE_RW;
      return roleMatrix[targetModule]?.can_write !== false;
    });
    if (!canWrite) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden: Assigned roles (${roles.join(', ')}) have read-only access for module "${targetModule}". Mutations not permitted.`,
        },
        { status: 403 }
      );
    }
  }

  if (isDhaavegPrefix) {
    return NextResponse.rewrite(new URL(pathname + request.nextUrl.search, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - logo.png / images
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png|app-icon.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)',
  ],
};
