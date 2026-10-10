'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, X, Eye } from 'lucide-react';
import Sidebar, { NavigationTab } from '@/components/Sidebar';
import Header from '@/components/Header';
import OverviewDashboard from '@/components/modules/OverviewDashboard';
import MasterDataModule from '@/components/modules/MasterDataModule';
import ProcurementModule from '@/components/modules/ProcurementModule';
import ReceivingModule from '@/components/modules/ReceivingModule';
import CustomerOrdersModule from '@/components/modules/CustomerOrdersModule';
import ShopFloorModule from '@/components/modules/ShopFloorModule';
import QualityModule from '@/components/modules/QualityModule';
import TraceabilityModule from '@/components/modules/TraceabilityModule';
import DataExportModule from '@/components/modules/DataExportModule';
import UserManagementModule from '@/components/modules/UserManagementModule';
import { useAuth } from '@/context/AuthContext';
import { VALID_MODULES } from '@/lib/routes';

interface ErpShellProps {
  initialTab?: NavigationTab;
}

function ErpShellContent({ initialTab = 'overview' }: { initialTab?: NavigationTab }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading, unauthorizedNotice, clearUnauthorizedNotice } = useAuth();

  // Client-Side Authentication Guard:
  // Immediately redirect unauthenticated visitors without rendering ERP modules
  useEffect(() => {
    if (!authLoading && !user) {
      const prefix = typeof window !== 'undefined' && window.location.pathname.startsWith('/dhaaveg') ? '/dhaaveg' : '';
      window.location.href = `${prefix}/login`;
    }
  }, [authLoading, user]);

  // Determine active tab from URL pathname or query params
  const getTabFromUrl = (): NavigationTab => {
    // 1. Check query param: ?tab=... or ?module=...
    const tabParam = searchParams.get('tab') || searchParams.get('module');
    if (tabParam && VALID_MODULES[tabParam.toLowerCase()]) {
      return VALID_MODULES[tabParam.toLowerCase()];
    }

    // 2. Check path segment: /procurement, /shop-floor, etc.
    const segment = (pathname || '').replace(/^\//, '').split('/')[0].toLowerCase();
    if (segment && VALID_MODULES[segment]) {
      return VALID_MODULES[segment];
    }

    return initialTab;
  };

  const [currentTab, setCurrentTab] = useState<NavigationTab>(getTabFromUrl);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState<string>(() => {
    return searchParams.get('search') || searchParams.get('q') || 'TAG-HT84920-001';
  });

  // Keep state in sync with URL changes (browser back/forward or Link clicks)
  useEffect(() => {
    const activeTab = getTabFromUrl();
    setCurrentTab(activeTab);
    const searchParam = searchParams.get('search') || searchParams.get('q');
    if (searchParam) {
      setQuickSearchQuery(searchParam);
    }
  }, [pathname, searchParams]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Error loading ERP stats:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [currentTab]);

  const handleTabChange = (tab: NavigationTab) => {
    setCurrentTab(tab);
    const targetUrl = tab === 'overview' ? '/' : `/${tab}`;
    if (pathname !== targetUrl) {
      router.push(targetUrl);
    }
  };

  const handleQuickSearch = (query: string) => {
    if (query.trim()) {
      setQuickSearchQuery(query.trim());
      setCurrentTab('traceability');
      router.push(`/traceability?search=${encodeURIComponent(query.trim())}`);
    }
  };

  if (authLoading) {
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

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden select-none">
      {/* Sidebar Navigation with Active Links */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        stats={stats}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onQuickSearch={handleQuickSearch}
          onRefresh={fetchStats}
          onExportClick={() => handleTabChange('admin-export')}
          isLoading={isLoading}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-slate-950/80">
          <div className="max-w-7xl mx-auto">
            {/* Unauthorized Notice Toast / Banner */}
            {unauthorizedNotice && (
              <div className="mb-4 p-4 rounded-xl bg-rose-950/80 border border-rose-600/50 flex items-start justify-between text-rose-200 text-xs shadow-lg animate-fade-in">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <span className="font-bold">Access Restricted: </span>
                    <span>{unauthorizedNotice}</span>
                  </div>
                </div>
                <button
                  onClick={clearUnauthorizedNotice}
                  className="p-1 hover:bg-rose-900/50 rounded text-rose-400 hover:text-rose-200 transition-colors ml-4"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* MD Executive Mode Banner */}
            {user?.role === 'MD' && (
              <div className="mb-4 px-4 py-2.5 rounded-lg bg-purple-950/30 border border-purple-800/40 flex items-center justify-between text-purple-200 text-xs">
                <div className="flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    <strong className="font-semibold text-purple-300">Executive Read-Only Active:</strong> As Managing Director, you have full enterprise-wide visibility across all operational modules. Action buttons (Create, Edit, Delete, Issue, Inward) are restricted to prevent inadvertent mutations.
                  </span>
                </div>
              </div>
            )}

            {/* Active Module View */}
            {currentTab === 'overview' && (
              <OverviewDashboard
                stats={stats}
                onNavigate={handleTabChange}
              />
            )}
            {currentTab === 'master-data' && <MasterDataModule />}
            {currentTab === 'procurement' && <ProcurementModule />}
            {currentTab === 'receiving' && <ReceivingModule />}
            {currentTab === 'customer-orders' && <CustomerOrdersModule />}
            {currentTab === 'shop-floor' && <ShopFloorModule />}
            {currentTab === 'quality' && <QualityModule />}
            {currentTab === 'traceability' && (
              <TraceabilityModule initialQuery={quickSearchQuery} />
            )}
            {currentTab === 'admin-export' && <DataExportModule />}
            {currentTab === 'user-management' && <UserManagementModule />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ErpShell(props: ErpShellProps) {
  return (
    <Suspense fallback={<div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono text-xs">Loading TUBEX ERP...</div>}>
      <ErpShellContent initialTab={props.initialTab} />
    </Suspense>
  );
}
