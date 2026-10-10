'use client';

import React, { useEffect } from 'react';
import ErpShell from '@/components/ErpShell';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      const prefix = typeof window !== 'undefined' && window.location.pathname.startsWith('/dhaaveg') ? '/dhaaveg' : '';
      window.location.href = `${prefix}/login`;
    }
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 font-sans">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          Authenticating TUBEX ERP...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 font-sans">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          Redirecting to Login...
        </p>
      </div>
    );
  }

  return <ErpShell initialTab="overview" />;
}
