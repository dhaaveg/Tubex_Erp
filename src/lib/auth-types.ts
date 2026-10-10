// src/lib/auth-types.ts
// Shared Authentication & RBAC Types and Access Rules (Client & Server Safe)

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MD'
  | 'PROCUREMENT'
  | 'MANUFACTURING'
  | 'SALES'
  | 'INVENTORY'
  | 'QUALITY';

export const ALL_ROLES: Role[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'MD',
  'PROCUREMENT',
  'MANUFACTURING',
  'SALES',
  'INVENTORY',
  'QUALITY',
];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'System Admin',
  MD: 'Managing Director',
  PROCUREMENT: 'Procurement',
  MANUFACTURING: 'Manufacturing',
  SALES: 'Sales',
  INVENTORY: 'Inventory',
  QUALITY: 'Quality QA',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: 'Platform Owner / Root IT with unrestricted privilege across all modules and user management.',
  ADMIN: 'System & user administration, password resets, and operational configuration (cannot assign Super Admin).',
  MD: 'Executive enterprise-wide read-only visibility across all operations, financial summaries, and logs.',
  PROCUREMENT: 'Vendor management, raw material purchasing contracts, RM purchase orders, and supplier stipulations.',
  MANUFACTURING: 'Shop floor routing, machine assignments, cut-part yields, and work order operations.',
  SALES: 'Customer purchase orders (CPO), customer master catalog, and dispatch allocations.',
  INVENTORY: 'Raw pipe receiving, weighbridge tickets, heat lot inwarding, pipe logs, and tally verification.',
  QUALITY: 'Metallurgical QA inspections, NDT test records, rejection analysis, and mill test traceability.',
};

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role; // Primary role for backwards compatibility
  roles: Role[]; // Array of assigned departmental roles
  department: string | null;
  is_active: boolean;
  force_password_change: boolean;
  last_login_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SessionPayload {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: Role; // Primary role
  roles: Role[]; // All assigned roles
  force_password_change?: boolean;
  exp: number;
}

export const SESSION_COOKIE_NAME = 'eot_session';

export const AUTH_COOKIES_TO_PURGE = [
  SESSION_COOKIE_NAME,
  'token',
  'session_id',
  'refresh_token',
  'session',
  'auth_token',
] as const;

/**
 * Safely parse multi-role list from database user record.
 * Supports JSON string, comma-separated string, or fallback to single role.
 */
export function parseRoles(user: { role?: string | null; roles?: string | null }): Role[] {
  if (user.roles) {
    try {
      const parsed = JSON.parse(user.roles);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((r) => ALL_ROLES.includes(r as Role)) as Role[];
      }
    } catch {
      if (typeof user.roles === 'string' && user.roles.trim()) {
        return user.roles
          .split(',')
          .map((r) => r.trim() as Role)
          .filter((r) => ALL_ROLES.includes(r));
      }
    }
  }
  if (user.role && ALL_ROLES.includes(user.role as Role)) {
    return [user.role as Role];
  }
  return ['PROCUREMENT'];
}

// -------------------------------------------------------------
// Module-Level Access Control Rules & Canonical Modules
// -------------------------------------------------------------
export interface ERPModuleMeta {
  key: string;
  label: string;
  route_path: string;
  description: string;
}

export const CANONICAL_MODULES: ERPModuleMeta[] = [
  {
    key: 'overview',
    label: 'Dashboard Overview',
    route_path: '/',
    description: 'High-level operational overview, plant KPIs, and shift status.',
  },
  {
    key: 'master-data',
    label: 'Master Data',
    route_path: '/master-data',
    description: 'Suppliers, product catalog, pipe dimensions, and grade specifications.',
  },
  {
    key: 'procurement',
    label: 'Procurement (RM PO)',
    route_path: '/procurement',
    description: 'Raw material purchase orders (RM PO), vendor agreements, and delivery schedules.',
  },
  {
    key: 'receiving',
    label: 'Receiving & Tally',
    route_path: '/receiving',
    description: 'Goods Receipt Notes (GRN), weighbridge logs, and tally validation.',
  },
  {
    key: 'customer-orders',
    label: "Customer's Orders",
    route_path: '/customer-orders',
    description: 'Customer purchase orders, specifications, and sales fulfillment.',
  },
  {
    key: 'shop-floor',
    label: 'Shop Floor & Routing',
    route_path: '/shop-floor',
    description: 'Work order tracking, cutting yields, and 8-stage manufacturing routing.',
  },
  {
    key: 'quality',
    label: 'Quality & Rejections',
    route_path: '/quality',
    description: 'Metallurgical QA inspections, NDT defect logs, and scrap dispositions.',
  },
  {
    key: 'traceability',
    label: 'Traceability Explorer',
    route_path: '/traceability',
    description: 'Genealogical pipe lifecycle tracking from raw heat to final dispatch.',
  },
  {
    key: 'admin-export',
    label: 'Data Export Center',
    route_path: '/admin-export',
    description: 'CSV and Excel data extraction across operational records.',
  },
  {
    key: 'user-management',
    label: 'User & Access Control',
    route_path: '/user-management',
    description: 'Account provisioning, departmental role assignment, and audit logs.',
  },
];

export interface ModuleAccessRule {
  allowedRoles: Role[];
  readOnlyRoles?: Role[];
}

export interface RolePermissionItem {
  id?: string;
  role: Role;
  module_key: string;
  route_path: string;
  can_read: boolean;
  can_write: boolean;
  is_enabled: boolean;
}

export const MODULE_ACCESS_MAP: Record<string, ModuleAccessRule> = {
  // Operational modules - all activated across all roles
  'procurement': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: ['MD'],
  },
  'receiving': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: ['MD'],
  },
  'shop-floor': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: ['MD'],
  },
  'quality': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: ['MD'],
  },
  'customer-orders': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: ['MD'],
  },
  'traceability': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: ['MD'],
  },
  'master-data': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: ['MD'],
  },
  'overview': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: ['MD'],
  },
  'admin-export': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: [],
  },
  'user-management': {
    allowedRoles: ALL_ROLES,
    readOnlyRoles: [],
  },
};

/**
 * Returns default permission values for a role and module
 */
export function getDefaultPermission(
  role: Role,
  moduleKey: string
): {
  route_path: string;
  is_enabled: boolean;
  can_read: boolean;
  can_write: boolean;
} {
  const mod = CANONICAL_MODULES.find((m) => m.key === moduleKey);
  const route_path = mod ? mod.route_path : `/${moduleKey}`;

  if (role === 'SUPER_ADMIN') {
    return { route_path, is_enabled: true, can_read: true, can_write: true };
  }

  const rule = MODULE_ACCESS_MAP[moduleKey];
  if (!rule) {
    return { route_path, is_enabled: false, can_read: false, can_write: false };
  }

  const isAllowed = rule.allowedRoles.includes(role);
  if (!isAllowed) {
    return { route_path, is_enabled: false, can_read: false, can_write: false };
  }

  const isReadOnly = (rule.readOnlyRoles || []).includes(role);
  return {
    route_path,
    is_enabled: true,
    can_read: true,
    can_write: !isReadOnly,
  };
}

/**
 * Check if a user can access a module and whether they have mutation rights.
 * Evaluates all roles assigned to the user.
 */
export function canAccessModule(
  user: SafeUser,
  moduleName: string,
  method: string = 'GET'
): { allowed: boolean; readOnly: boolean; reason?: string } {
  const userRoles: Role[] =
    user.roles && user.roles.length > 0 ? user.roles : user.role ? [user.role] : ['PROCUREMENT'];

  // Super Admin has unrestricted access everywhere
  if (userRoles.includes('SUPER_ADMIN') || user.role === 'SUPER_ADMIN') {
    return { allowed: true, readOnly: false };
  }

  const rule = MODULE_ACCESS_MAP[moduleName];
  if (!rule) {
    return { allowed: false, readOnly: false, reason: `Unknown module ${moduleName}` };
  }

  // Find all user roles that match this module
  const matchingAllowed = userRoles.filter((r) => rule.allowedRoles.includes(r));

  if (matchingAllowed.length === 0) {
    return {
      allowed: false,
      readOnly: false,
      reason: `Assigned roles (${userRoles.join(', ')}) do not permit access to ${moduleName}`,
    };
  }

  // Check mutation rights:
  // If user has ANY matching role that is NOT in readOnlyRoles, they have write privilege
  const hasWriteRole = matchingAllowed.some((r) => !(rule.readOnlyRoles || []).includes(r));
  const isReadOnly = !hasWriteRole;

  if (isReadOnly && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
    return {
      allowed: false,
      readOnly: true,
      reason: 'Role has executive read-only access and cannot perform mutations.',
    };
  }

  return { allowed: true, readOnly: isReadOnly };
}

/**
 * Filter users query to ensure SUPER_ADMIN is completely invisible to non-super-admins.
 */
export function getUserQueryFilter(viewerRole: Role | undefined, viewerRoles?: Role[]): any {
  const isViewerSuper = viewerRole === 'SUPER_ADMIN' || viewerRoles?.includes('SUPER_ADMIN');
  if (isViewerSuper) {
    return {};
  }
  return {
    AND: [
      { role: { not: 'SUPER_ADMIN' } },
      {
        OR: [
          { roles: null },
          { roles: { not: { contains: 'SUPER_ADMIN' } } },
        ],
      },
    ],
  };
}

/**
 * Masks creator / author identity if author is a SUPER_ADMIN and viewer is not.
 */
export function maskAuthorIdentity(
  authorName: string,
  authorRole?: string | null,
  viewerRole?: Role,
  authorRoles?: Role[],
  viewerRoles?: Role[]
): string {
  const isAuthorSuper = authorRole === 'SUPER_ADMIN' || authorRoles?.includes('SUPER_ADMIN');
  const isViewerSuper = viewerRole === 'SUPER_ADMIN' || viewerRoles?.includes('SUPER_ADMIN');
  if (isAuthorSuper && !isViewerSuper) {
    return 'System Administrator';
  }
  return authorName;
}

// -------------------------------------------------------------
// Audit Log Action Categorization & RBAC Classification
// -------------------------------------------------------------

/**
 * Operational Actions: Visible to ADMIN & SUPER_ADMIN.
 * Encompasses standard manufacturing, procurement, inventory, quality, sales, and user session events.
 */
export const OPERATIONAL_ACTIONS = [
  'PO_CREATED',
  'PO_APPROVED',
  'GRN_RECORDED',
  'WO_RELEASED',
  'ROUTING_STAGE_COMPLETED',
  'QUALITY_INSPECTION',
  'DEFECT_LOGGED',
  'HEAT_TAGGED',
  'CUSTOMER_ORDER_PLACED',
  'DISPATCH_RECORDED',
  'LOGIN',
  'LOGOUT',
  'SESSION_TIMEOUT',
] as const;

export type OperationalAction = (typeof OPERATIONAL_ACTIONS)[number];

/**
 * Sensitive Governance Actions: Exclusive to SUPER_ADMIN.
 * Strictly filtered out from ADMIN and non-super-admin audit views.
 */
export const SENSITIVE_GOVERNANCE_ACTIONS = [
  'USER_ROLE_CHANGED',
  'ROLE_PERMISSIONS_UPDATED',
  'USER_DEACTIVATED',
  'USER_DELETED',
  'PASSWORD_RESET_OVERRIDE',
  'ADMIN_PASSWORD_RESET',
  'SYSTEM_CONFIG_CHANGED',
  'AUDIT_LOG_EXPORT',
  'DATABASE_MIGRATION',
  'SUPER_ADMIN_INITIALIZED',
] as const;

export type SensitiveGovernanceAction = (typeof SENSITIVE_GOVERNANCE_ACTIONS)[number];

/**
 * Check whether an action is classified as a sensitive governance action.
 */
export function isSensitiveGovernanceAction(action: string): boolean {
  return (SENSITIVE_GOVERNANCE_ACTIONS as readonly string[]).includes(action);
}

/**
 * Check whether an action is classified as an operational action.
 */
export function isOperationalAction(action: string): boolean {
  return (OPERATIONAL_ACTIONS as readonly string[]).includes(action);
}

export type AuditFeedScope = 'SYSTEM_AUDIT' | 'PLANT_OPERATIONS' | 'USER_ACTIVITY';

export interface AuditFeedScopeMeta {
  scope: AuditFeedScope;
  label: string;
  badge: string;
  description: string;
}

export function getAuditFeedScopeMeta(userRole?: Role, userRoles?: Role[]): AuditFeedScopeMeta {
  const roles = userRoles && userRoles.length > 0 ? userRoles : userRole ? [userRole] : [];
  if (roles.includes('SUPER_ADMIN')) {
    return {
      scope: 'SYSTEM_AUDIT',
      label: 'System & Security Audit Feed',
      badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      description: 'System-wide governance, operational events & security audit trail',
    };
  }
  if (roles.includes('ADMIN') || roles.includes('MD')) {
    return {
      scope: 'PLANT_OPERATIONS',
      label: 'Plant Operations Feed',
      badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      description: 'Plant-wide operational events across manufacturing, procurement, and inventory',
    };
  }
  return {
    scope: 'USER_ACTIVITY',
    label: 'My Activity Feed',
    badge: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    description: 'Personal operational activities & session events',
  };
}
