'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  timestamp: number;
  duration?: number;
}

interface ToastContextType {
  showToast: (opts: { message: string; type?: ToastType; duration?: number }) => void;
  error: (message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DEDUP_WINDOW_MS = 3000;
const DEFAULT_DURATION_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const recentToastsRef = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, type = 'error', duration = DEFAULT_DURATION_MS }: { message: string; type?: ToastType; duration?: number }) => {
      if (!message || typeof message !== 'string') return;
      const cleanMsg = message.trim();
      if (!cleanMsg) return;

      const now = Date.now();
      const dedupKey = `${type}:${cleanMsg}`;
      const lastTime = recentToastsRef.current.get(dedupKey);

      // Prevent spamming identical popups within short window
      if (lastTime && now - lastTime < DEDUP_WINDOW_MS) {
        return;
      }
      recentToastsRef.current.set(dedupKey, now);

      // Clean old dedup keys
      if (recentToastsRef.current.size > 50) {
        recentToastsRef.current.forEach((time, key) => {
          if (now - time > 10000) recentToastsRef.current.delete(key);
        });
      }

      const id = `${now}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastItem = {
        id,
        message: cleanMsg,
        type,
        timestamp: now,
        duration,
      };

      setToasts((prev) => [...prev.slice(-4), newToast]);

      // Auto-hide after duration
      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const error = useCallback((msg: string, d?: number) => showToast({ message: msg, type: 'error', duration: d }), [showToast]);
  const success = useCallback((msg: string, d?: number) => showToast({ message: msg, type: 'success', duration: d }), [showToast]);
  const info = useCallback((msg: string, d?: number) => showToast({ message: msg, type: 'info', duration: d }), [showToast]);
  const warning = useCallback((msg: string, d?: number) => showToast({ message: msg, type: 'warning', duration: d }), [showToast]);

  // Global window.fetch interceptor for automated API error detection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      try {
        const response = await originalFetch.apply(this, args);

        if (!response.ok) {
          // Do not trigger toast for 401 session expiration when checking session in background
          const urlStr = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : '';
          const isSilentCheck = urlStr.includes('/api/auth/me') || urlStr.includes('/api/auth/refresh');

          if (!(isSilentCheck && response.status === 401)) {
            try {
              const clone = response.clone();
              const contentType = clone.headers.get('content-type') || '';
              if (contentType.includes('application/json')) {
                const data = await clone.json();
                const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
                error(errorMsg);
              } else {
                error(`Request failed (${response.status} ${response.statusText || 'Error'})`);
              }
            } catch {
              error(`Request failed (${response.status})`);
            }
          }
        }

        return response;
      } catch (err: any) {
        // Network or fetch connection failure
        const errorMsg = err?.message || 'Network connection error. Please verify your connection.';
        error(errorMsg);
        throw err;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [error]);

  return (
    <ToastContext.Provider value={{ showToast, error, success, info, warning, removeToast }}>
      {children}

      {/* Modern High-Contrast Floating Toast Container */}
      <div
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full px-4 sm:px-0 pointer-events-none select-none"
        aria-live="assertive"
      >
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';
          const isWarning = toast.type === 'warning';

          const borderColor = isError
            ? 'border-red-500/60 shadow-red-950/40'
            : isSuccess
            ? 'border-emerald-500/60 shadow-emerald-950/40'
            : isWarning
            ? 'border-amber-500/60 shadow-amber-950/40'
            : 'border-blue-500/60 shadow-blue-950/40';

          const iconColor = isError
            ? 'text-red-400 bg-red-950/60 border-red-800/50'
            : isSuccess
            ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50'
            : isWarning
            ? 'text-amber-400 bg-amber-950/60 border-amber-800/50'
            : 'text-blue-400 bg-blue-950/60 border-blue-800/50';

          const title = isError
            ? 'System Alert'
            : isSuccess
            ? 'Operation Success'
            : isWarning
            ? 'Notice'
            : 'Information';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto bg-slate-900/95 border backdrop-blur-md rounded-xl p-3.5 shadow-2xl flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${borderColor}`}
            >
              <div className={`p-1.5 rounded-lg border flex-shrink-0 ${iconColor}`}>
                {isError && <AlertCircle className="w-5 h-5" />}
                {isSuccess && <CheckCircle className="w-5 h-5" />}
                {isWarning && <AlertTriangle className="w-5 h-5" />}
                {!isError && !isSuccess && !isWarning && <Info className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  {title}
                </div>
                <div className="text-xs font-medium text-slate-200 leading-snug break-words">
                  {toast.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800/80 transition-colors flex-shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
