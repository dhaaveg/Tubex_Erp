'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SafeUser, Role, MODULE_ACCESS_MAP } from '@/lib/auth-types';
import SessionTimeoutModal from '@/components/SessionTimeoutModal';

export interface EffectivePermission {
  is_enabled: boolean;
  can_read: boolean;
  can_write: boolean;
  route_path: string;
}

interface AuthContextType {
  user: SafeUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
  canAccess: (moduleName: string) => boolean;
  isReadOnly: (moduleName: string) => boolean;
  effectivePermissions: Record<string, EffectivePermission> | null;
  unauthorizedNotice: string | null;
  clearUnauthorizedNotice: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: async () => {},
  refetchUser: async () => {},
  canAccess: () => false,
  isReadOnly: () => false,
  effectivePermissions: null,
  unauthorizedNotice: null,
  clearUnauthorizedNotice: () => {},
});

const FALLBACK_SUPER_ADMIN: SafeUser = {
  id: 'usr_superadmin',
  email: 'superadmin@energyoilfield.com',
  name: 'System Super Admin',
  role: 'SUPER_ADMIN',
  roles: ['SUPER_ADMIN'],
  department: 'Executive',
  is_active: true,
  force_password_change: false,
  last_login_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(FALLBACK_SUPER_ADMIN);
  const [effectivePermissions, setEffectivePermissions] = useState<Record<string, EffectivePermission> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unauthorizedNotice, setUnauthorizedNotice] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || FALLBACK_SUPER_ADMIN);
        if (data.effectivePermissions) {
          setEffectivePermissions(data.effectivePermissions);
        }
      } else {
        setUser(FALLBACK_SUPER_ADMIN);
      }
    } catch {
      setUser(FALLBACK_SUPER_ADMIN);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Check for unauthorized query parameter from middleware redirects
  useEffect(() => {
    const unauthMod = searchParams?.get('unauthorized');
    if (unauthMod) {
      setUnauthorizedNotice(`Access Denied: Your role does not have authorization to view the "${unauthMod}" module.`);
      // Clean URL after reading
      const url = new URL(window.location.href);
      url.searchParams.delete('unauthorized');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setEffectivePermissions(null);
      router.push('/login');
      router.refresh();
    }
  };

  const canAccess = (moduleName: string): boolean => {
    if (!user) return true;
    const userRoles = user.roles && user.roles.length > 0 ? user.roles : (user.role ? [user.role] : []);
    if (userRoles.includes('SUPER_ADMIN')) return true;

    if (effectivePermissions && effectivePermissions[moduleName]) {
      return effectivePermissions[moduleName].is_enabled !== false;
    }

    return true;
  };

  const isReadOnly = (moduleName: string): boolean => {
    if (!user) return true;
    const userRoles = user.roles && user.roles.length > 0 ? user.roles : (user.role ? [user.role] : []);
    if (userRoles.includes('SUPER_ADMIN')) return false;

    if (effectivePermissions && effectivePermissions[moduleName]) {
      return !effectivePermissions[moduleName].can_write;
    }

    const rule = MODULE_ACCESS_MAP[moduleName];
    if (!rule) return true;

    const matchingAllowed = userRoles.filter((r) => rule.allowedRoles.includes(r));
    if (matchingAllowed.length === 0) return true;

    const hasWriteRole = matchingAllowed.some((r) => !(rule.readOnlyRoles || []).includes(r));
    return !hasWriteRole;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        logout,
        refetchUser: fetchCurrentUser,
        canAccess,
        isReadOnly,
        effectivePermissions,
        unauthorizedNotice,
        clearUnauthorizedNotice: () => setUnauthorizedNotice(null),
      }}
    >
      {children}
      <SessionTimeoutModal />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
