'use client';

import React from 'react';
import { ShieldAlert, LogOut, RefreshCw, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';

export default function SessionTimeoutModal() {
  const { user } = useAuth();
  const {
    isWarningOpen,
    secondsRemaining,
    isRefreshing,
    staySignedIn,
    logOutNow,
  } = useInactivityTimeout({ user });

  if (!user || !isWarningOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform scale-100 transition-all">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-amber-50 dark:bg-gradient-to-r dark:from-amber-950/60 dark:to-slate-950 border-b border-amber-200 dark:border-amber-500/30 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide uppercase font-mono">
              Security Inactivity Warning
            </h3>
            <p className="text-[11px] text-amber-700 dark:text-amber-300/80">
              Corporate ERP Session Expiration Policy
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-center">
          <div className="space-y-2">
            <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">
              Your session will expire in{' '}
              <span className="inline-block px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-600/70 font-mono font-bold text-amber-800 dark:text-amber-300 text-base">
                {timeFormatted}
              </span>{' '}
              due to inactivity.
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              To safeguard proprietary casing, work order, and metallurgical data, idle sessions are automatically terminated after 2 hours.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            <span>Click &quot;Stay Signed In&quot; to extend your authenticated token for 2 hours.</span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={logOutNow}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Log Out Now</span>
            </button>

            <button
              type="button"
              disabled={isRefreshing}
              onClick={staySignedIn}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold transition shadow-md shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
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
