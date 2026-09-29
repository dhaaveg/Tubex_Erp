'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogOut, RefreshCw, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// 2 Hours = 120 minutes = 7,200,000 ms
const TOTAL_IDLE_TIMEOUT_MS = 120 * 60 * 1000;
// Warning at 115 minutes (5 minutes / 300,000 ms remaining)
const WARNING_THRESHOLD_MS = 115 * 60 * 1000;
// Background refresh interval when actively typing/clicking (every 15 minutes)
const BACKGROUND_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
// Throttle listener executions to at most once every 1,000 ms
const ACTIVITY_THROTTLE_MS = 1000;

export default function SessionTimeoutModal() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const lastActivityRef = useRef<number>(Date.now());
  const lastRefreshRef = useRef<number>(Date.now());
  const lastListenerTriggerRef = useRef<number>(0);
  const isWarningOpenRef = useRef<boolean>(false);
  isWarningOpenRef.current = isWarningOpen;

  // Refresh server session sliding window
  const refreshServerSession = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      if (res.ok) {
        lastActivityRef.current = Date.now();
        lastRefreshRef.current = Date.now();
        setIsWarningOpen(false);
      } else if (res.status === 401) {
        // Server rejected as expired
        await logout();
        router.push('/login?reason=timeout');
      }
    } catch (err) {
      console.error('Failed to extend session:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [logout, router]);

  // Handle immediate manual logout
  const handleLogOutNow = useCallback(async () => {
    setIsWarningOpen(false);
    await logout();
    router.push('/login');
  }, [logout, router]);

  // Automatic logout on complete 2-hour inactivity
  const handleAutoLogout = useCallback(async () => {
    setIsWarningOpen(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    await logout();
    router.push('/login?reason=timeout');
  }, [logout, router]);

  // Event handler for activity listeners
  useEffect(() => {
    if (!user) return;

    const handleUserActivity = () => {
      const now = Date.now();

      // If warning modal is already open, do not reset automatically on ambient mouse moves
      // User must explicitly click "Stay Signed In" to confirm security intent
      if (isWarningOpenRef.current) return;

      // Throttle rapid events
      if (now - lastListenerTriggerRef.current < ACTIVITY_THROTTLE_MS) return;
      lastListenerTriggerRef.current = now;
      lastActivityRef.current = now;

      // Background sliding refresh: If user is interacting and > 15 minutes have passed since last server refresh
      if (now - lastRefreshRef.current > BACKGROUND_REFRESH_INTERVAL_MS) {
        lastRefreshRef.current = now;
        fetch('/api/auth/refresh', { method: 'POST' }).catch(() => {});
      }
    };

    const monitoredEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    monitoredEvents.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

    return () => {
      monitoredEvents.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
    };
  }, [user]);

  // Timer interval checking idle state every 1 second
  useEffect(() => {
    if (!user) {
      setIsWarningOpen(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const idleDuration = now - lastActivityRef.current;

      if (idleDuration >= TOTAL_IDLE_TIMEOUT_MS) {
        clearInterval(interval);
        handleAutoLogout();
      } else if (idleDuration >= WARNING_THRESHOLD_MS) {
        const remainingMs = TOTAL_IDLE_TIMEOUT_MS - idleDuration;
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
  }, [user, handleAutoLogout]);

  if (!user || !isWarningOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-md shadow-2xl shadow-amber-950/60 overflow-hidden transform scale-100 transition-all">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-950/60 to-slate-950 border-b border-amber-500/30 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
              Security Inactivity Warning
            </h3>
            <p className="text-[11px] text-amber-300/80">
              Corporate ERP Session Expiration Policy
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-center">
          <div className="space-y-2">
            <p className="text-sm text-slate-200 font-medium">
              Your session will expire in{' '}
              <span className="inline-block px-2 py-0.5 rounded bg-amber-950 border border-amber-600/70 font-mono font-bold text-amber-300 text-base">
                {timeFormatted}
              </span>{' '}
              due to inactivity.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              To safeguard proprietary casing, work order, and metallurgical data, idle sessions are automatically terminated after 2 hours.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Click &quot;Stay Signed In&quot; to extend your authenticated token for 2 hours.</span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleLogOutNow}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span>Log Out Now</span>
            </button>

            <button
              type="button"
              disabled={isRefreshing}
              onClick={refreshServerSession}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Extending...' : 'Stay Signed In'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
