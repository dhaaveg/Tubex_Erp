'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { COMPANY_NAME } from '@/lib/companyLogo';
import PasswordInput from '@/components/PasswordInput';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const isTimeout =
    searchParams?.get('expired') === 'true' ||
    searchParams?.get('reason') === 'timeout';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Clean State Reset: clear any stale activity, logout events, or session storage flags
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('eot_last_activity');
        localStorage.removeItem('eot_logout_event');
        sessionStorage.clear();
      } catch {}
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      // Initialize fresh activity timestamp for the new session
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('eot_last_activity', Date.now().toString());
        } catch {}
      }

      // Resolve destination URL
      const from = searchParams?.get('from');
      const targetUrl =
        from && from.startsWith('/') && !from.startsWith('/login')
          ? from
          : '/overview';

      // Hard Hydration Navigation:
      // Completely bypasses Next.js client App Router RSC cache to eliminate stale 401 states.
      // Forces clean server hydration with the fresh authentication cookie on the very first attempt.
      window.location.href = targetUrl;
    } catch (err: any) {
      setError(err.message || 'Authentication error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-blue-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-0.5 shadow-xl shadow-blue-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center overflow-hidden relative">
              <Image
                src="/logo.png"
                alt="Dhaaveg ERP Logo"
                width={56}
                height={56}
                priority
                className="w-full h-full object-contain rounded-[14px]"
              />
            </div>
          </div>
        </div>

        <h2 className="text-center text-2xl font-black text-white tracking-tight uppercase">
          {COMPANY_NAME}
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400 font-medium">
          Tubular & Casing Manufacturing ERP • Enterprise Access
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/90 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 backdrop-blur-xl">
          <form className="space-y-5" onSubmit={handleLogin}>
            {isTimeout && (
              <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-600/70 text-amber-200 text-xs flex items-center space-x-2.5 shadow-lg shadow-amber-950/40">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold leading-relaxed">
                  Your session has expired due to 2 hours of inactivity. Please sign in again.
                </span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700/60 text-rose-200 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Corporate Email Address
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@energyoilfield.com"
                  className="block w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <PasswordInput
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                leftIcon={<Lock className="h-4 w-4" />}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-lg shadow-blue-600/30 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? (
                <span>Authenticating with Argon2...</span>
              ) : (
                <>
                  <span>Sign In to System</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-500 font-medium tracking-wide flex items-center justify-center">
            <span>Powered By Dhaaveg</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginForm />
    </Suspense>
  );
}
