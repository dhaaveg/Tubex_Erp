'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SafeUser, Role, MODULE_ACCESS_MAP } from '@/lib/auth-types';
import SessionTimeoutModal from '@/components/SessionTimeoutModal';
import { apiUrl } from '@/lib/api';

export interface EffectivePermission {
  is_enabled: boolean;
  can_read: boolean;
  can_write: boolean;
  route_path: string;
}

interface AuthContextType {
  user: SafeUser | null;
  isLoading: boolean;
  logout: (expired?: boolean | any) => Promise<void>;
  refetchUser: () => Promise<void>;
  canAccess: (moduleName: string) => boolean;
  isReadOnly: (moduleName: string) => boolean;
  effectivePermissions: Record<string, EffectivePermission> | null;
  unauthorizedNotice: string | null;
  clearUnauthorizedNotice: () => void;
  setUnauthorizedNotice: (notice: string | null) => void;
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
  setUnauthorizedNotice: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<Record<string, EffectivePermission> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unauthorizedNotice, setUnauthorizedNotice] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleConcurrentLogout = useCallback(() => {
    setUser(null);
    setEffectivePermissions(null);
    if (typeof window !== 'undefined') {
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('eot_auth_inactivity_channel');
          bc.postMessage({ type: 'LOGOUT', reason: 'concurrent_session' });
          bc.close();
        }
        localStorage.setItem(
          'eot_logout_event',
          JSON.stringify({ timestamp: Date.now(), reason: 'concurrent_session' })
        );
        localStorage.removeItem('eot_last_activity');
        sessionStorage.clear();
      } catch {}
      window.location.href = '/login?reason=concurrent_session';
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/me'));
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
        if (data.effectivePermissions) {
          setEffectivePermissions(data.effectivePermissions);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (errorData?.code === 'SESSION_SUPERSEDED') {
          handleConcurrentLogout();
          return;
        }
        setUser(null);
        setEffectivePermissions(null);
      }
    } catch {
      setUser(null);
      setEffectivePermissions(null);
    } finally {
      setIsLoading(false);
    }
  }, [handleConcurrentLogout]);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Periodic heartbeat & window focus checks for concurrent session termination
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    let isChecking = false;
    const checkSessionStatus = async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        const res = await fetch(apiUrl('/api/auth/session-status'));
        if (res.status === 401) {
          const data = await res.json().catch(() => ({}));
          if (data?.code === 'SESSION_SUPERSEDED') {
            handleConcurrentLogout();
          }
        }
      } catch {
        // Network errors ignored to prevent false logouts
      } finally {
        isChecking = false;
      }
    };

    // Heartbeat every 10 seconds for idle tab detection
    const interval = setInterval(checkSessionStatus, 10000);

    // Fast check on tab switch or focus
    const handleFocus = () => {
      checkSessionStatus();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, handleConcurrentLogout]);

  // Check for unauthorized query parameter from middleware redirects
  useEffect(() => {
    const unauthMod = searchParams?.get('unauthorized');
    if (unauthMod) {
      if (unauthMod === 'overview') {
        setUnauthorizedNotice('You do not have permission to access the Executive Overview Dashboard.');
      } else {
        setUnauthorizedNotice(`Access Denied: Your role does not have authorization to view the "${unauthMod}" module.`);
      }
      // Clean URL after reading
      const url = new URL(window.location.href);
      url.searchParams.delete('unauthorized');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  const logout = async (expiredArg?: boolean | string | any) => {
    const isExpired = expiredArg === true || expiredArg === 'expired';
    const isConcurrent = expiredArg === 'concurrent_session';
    const reason = isConcurrent ? 'concurrent_session' : isExpired ? 'expired' : 'manual';
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST' });
    } finally {
      setUser(null);
      setEffectivePermissions(null);
      if (typeof window !== 'undefined') {
        try {
          if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('eot_auth_inactivity_channel');
            bc.postMessage({ type: 'LOGOUT', reason });
            bc.close();
          }
          localStorage.setItem(
            'eot_logout_event',
            JSON.stringify({ timestamp: Date.now(), reason })
          );
          localStorage.removeItem('eot_last_activity');
          sessionStorage.clear();
        } catch {}
        const param = isConcurrent
          ? '?reason=concurrent_session'
          : isExpired
          ? '?expired=true'
          : '';
        window.location.href = `/login${param}`;
      }
    }
  };

  const canAccess = (moduleName: string): boolean => {
    if (!user) return false;
    if (moduleName === 'home') return true;
    const userRoles = user.roles && user.roles.length > 0 ? user.roles : (user.role ? [user.role] : []);
    if (userRoles.includes('SUPER_ADMIN')) return true;

    if (effectivePermissions && effectivePermissions[moduleName]) {
      return (
        effectivePermissions[moduleName].is_enabled !== false &&
        effectivePermissions[moduleName].can_read !== false
      );
    }

    const rule = MODULE_ACCESS_MAP[moduleName];
    if (!rule) return true;
    return userRoles.some((r) => rule.allowedRoles.includes(r));
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
        setUnauthorizedNotice,
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
