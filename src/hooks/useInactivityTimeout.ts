'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { SafeUser } from '@/lib/auth-types';

export const DEFAULT_INACTIVITY_TIMEOUT_MS = 120 * 60 * 1000; // 2 hours = 7,200,000 ms
export const DEFAULT_WARNING_THRESHOLD_MS = 115 * 60 * 1000; // 115 minutes (5 minutes warning)
export const BACKGROUND_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes background sliding window
export const ACTIVITY_THROTTLE_MS = 1000; // Throttle listener executions to at most once per 1000ms
export const STORAGE_KEY_LAST_ACTIVITY = 'eot_last_activity';
export const STORAGE_KEY_LOGOUT_EVENT = 'eot_logout_event';
export const BROADCAST_CHANNEL_NAME = 'eot_auth_inactivity_channel';

interface UseInactivityTimeoutOptions {
  user: SafeUser | null;
  onLogout?: () => Promise<void> | void;
}

export function useInactivityTimeout({ user, onLogout }: UseInactivityTimeoutOptions) {
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const lastActivityRef = useRef<number>(Date.now());
  const lastRefreshRef = useRef<number>(Date.now());
  const lastListenerTriggerRef = useRef<number>(0);
  const isWarningOpenRef = useRef<boolean>(false);
  isWarningOpenRef.current = isWarningOpen;

  // Resolve configurable timeout thresholds (allowing NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS simulation)
  const getThresholds = useCallback(() => {
    const envVal =
      typeof window !== 'undefined' && process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS
        ? parseInt(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS, 10)
        : NaN;

    const timeoutMs = !isNaN(envVal) && envVal > 0 ? envVal : DEFAULT_INACTIVITY_TIMEOUT_MS;
    const warningMs =
      timeoutMs > 10 * 60 * 1000
        ? timeoutMs - 5 * 60 * 1000
        : Math.max(0, Math.floor(timeoutMs * 0.8));

    return { timeoutMs, warningMs };
  }, []);

  // Broadcast event across browser tabs
  const broadcast = useCallback(
    (data: { type: 'ACTIVITY' | 'LOGOUT'; timestamp?: number; reason?: string }) => {
      if (typeof window === 'undefined') return;
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          bc.postMessage(data);
          bc.close();
        }
      } catch {}
    },
    []
  );

  // Graceful auto logout
  const triggerAutoLogout = useCallback(
    async (reason: 'expired' | 'manual' = 'expired') => {
      setIsWarningOpen(false);

      // Tab Synchronization: notify all other tabs immediately
      broadcast({ type: 'LOGOUT', reason });
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            STORAGE_KEY_LOGOUT_EVENT,
            JSON.stringify({ timestamp: Date.now(), reason })
          );
          localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
          sessionStorage.clear();
        } catch {}
      }

      // Server-side session invalidation & deterministic cookie purge
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {}

      if (onLogout) {
        try {
          await onLogout();
        } catch {}
      }

      // Hard Hydration Navigation to /login?expired=true:
      // Eliminates stale Next.js App Router RSC cache and forces clean hydration
      if (typeof window !== 'undefined') {
        window.location.href = reason === 'expired' ? '/login?expired=true' : '/login';
      }
    },
    [broadcast, onLogout]
  );

  // Extend session (refresh sliding window)
  const staySignedIn = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      if (res.ok) {
        const now = Date.now();
        lastActivityRef.current = now;
        lastRefreshRef.current = now;
        setIsWarningOpen(false);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, now.toString());
          } catch {}
        }
        broadcast({ type: 'ACTIVITY', timestamp: now });
      } else if (res.status === 401) {
        await triggerAutoLogout('expired');
      }
    } catch (err) {
      console.error('Failed to extend session:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [broadcast, triggerAutoLogout]);

  // Immediate manual logout
  const logOutNow = useCallback(async () => {
    await triggerAutoLogout('manual');
  }, [triggerAutoLogout]);

  // Set up global DOM activity listeners and cross-tab synchronization
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    // Initialize local timestamp from localStorage if available and newer
    const stored = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
    if (stored) {
      const storedTime = parseInt(stored, 10);
      if (!isNaN(storedTime) && storedTime > lastActivityRef.current) {
        lastActivityRef.current = storedTime;
      }
    } else {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, Date.now().toString());
    }

    const handleUserActivity = () => {
      const now = Date.now();

      // If warning modal is open, require clicking "Stay Signed In" to confirm active security intent
      if (isWarningOpenRef.current) return;

      // Throttle rapid event triggers
      if (now - lastListenerTriggerRef.current < ACTIVITY_THROTTLE_MS) return;
      lastListenerTriggerRef.current = now;
      lastActivityRef.current = now;

      // Sync across tabs via localStorage & BroadcastChannel
      try {
        localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, now.toString());
      } catch {}
      broadcast({ type: 'ACTIVITY', timestamp: now });

      // Background sliding refresh: extend token in database if active and > 15 mins since last refresh
      if (now - lastRefreshRef.current > BACKGROUND_REFRESH_INTERVAL_MS) {
        lastRefreshRef.current = now;
        fetch('/api/auth/refresh', { method: 'POST' }).catch(() => {});
      }
    };

    // Global DOM activity event listeners: mousemove, keydown, pointerdown, scroll, touchstart
    const monitoredEvents = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'];
    monitoredEvents.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

    // Tab Synchronization: Listen for cross-tab activity and logout events via storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_LAST_ACTIVITY && e.newValue) {
        const ts = parseInt(e.newValue, 10);
        if (!isNaN(ts) && ts > lastActivityRef.current) {
          lastActivityRef.current = ts;
          const { warningMs } = getThresholds();
          const idle = Date.now() - ts;
          if (idle < warningMs && isWarningOpenRef.current) {
            setIsWarningOpen(false);
          }
        }
      } else if (e.key === STORAGE_KEY_LOGOUT_EVENT && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          window.location.href = parsed.reason === 'expired' ? '/login?expired=true' : '/login';
        } catch {
          window.location.href = '/login?expired=true';
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Tab Synchronization: BroadcastChannel handler
    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.onmessage = (event) => {
          if (event.data?.type === 'ACTIVITY' && event.data.timestamp) {
            if (event.data.timestamp > lastActivityRef.current) {
              lastActivityRef.current = event.data.timestamp;
              const { warningMs } = getThresholds();
              const idle = Date.now() - event.data.timestamp;
              if (idle < warningMs && isWarningOpenRef.current) {
                setIsWarningOpen(false);
              }
            }
          } else if (event.data?.type === 'LOGOUT') {
            window.location.href =
              event.data.reason === 'expired' ? '/login?expired=true' : '/login';
          }
        };
      } catch {}
    }

    return () => {
      monitoredEvents.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      window.removeEventListener('storage', handleStorageChange);
      if (bc) {
        bc.close();
      }
    };
  }, [user, broadcast, getThresholds]);

  // Periodic heartbeat interval checking inactivity (every 1 second)
  useEffect(() => {
    if (!user || typeof window === 'undefined') {
      setIsWarningOpen(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const stored = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
      const storedTime = stored ? parseInt(stored, 10) : 0;
      const effectiveLastActive = Math.max(
        lastActivityRef.current,
        isNaN(storedTime) ? 0 : storedTime
      );
      const idleDuration = now - effectiveLastActive;

      const { timeoutMs, warningMs } = getThresholds();

      if (idleDuration >= timeoutMs) {
        clearInterval(interval);
        triggerAutoLogout('expired');
      } else if (idleDuration >= warningMs) {
        const remainingMs = timeoutMs - idleDuration;
        const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
        setSecondsRemaining(remainingSec);
        if (!isWarningOpenRef.current) {
          setIsWarningOpen(true);
        }
      } else {
        if (isWarningOpenRef.current) {
          setIsWarningOpen(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user, getThresholds, triggerAutoLogout]);

  return {
    isWarningOpen,
    secondsRemaining,
    isRefreshing,
    staySignedIn,
    logOutNow,
  };
}
