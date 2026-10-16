'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  ShoppingCart, 
  Truck, 
  Wrench, 
  ShieldAlert, 
  GitFork, 
  LayoutDashboard,
  Factory,
  FileSpreadsheet,
  Database,
  Users,
  LogOut,
  ShieldCheck,
  Eye,
  Home,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Sunset,
  Moon,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useCurrentShift } from '@/hooks/useCurrentShift';

export type NavigationTab = 
  | 'home'
  | 'overview'
  | 'master-data'
  | 'procurement'
  | 'receiving'
  | 'customer-orders'
  | 'shop-floor'
  | 'quality'
  | 'traceability'
  | 'admin-export'
  | 'user-management';

export const TAB_ROUTES: Record<NavigationTab, string> = {
  'home': '/',
  'overview': '/overview',
  'master-data': '/master-data',
  'procurement': '/procurement',
  'receiving': '/receiving',
  'customer-orders': '/customer-orders',
  'shop-floor': '/shop-floor',
  'quality': '/quality',
  'traceability': '/traceability',
  'admin-export': '/admin-export',
  'user-management': '/user-management',
};

export interface SidebarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  stats?: any;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-rose-50 dark:bg-rose-500/20 text-[#BE123C] dark:text-rose-300 border-rose-200 dark:border-rose-600/40',
  ADMIN: 'bg-indigo-50 dark:bg-indigo-500/20 text-[#4338CA] dark:text-indigo-300 border-indigo-200 dark:border-indigo-600/40',
  MD: 'bg-purple-50 dark:bg-purple-500/20 text-[#6D28D9] dark:text-purple-300 border-purple-200 dark:border-purple-600/40',
  PROCUREMENT: 'bg-blue-50 dark:bg-blue-500/20 text-[#1D4ED8] dark:text-blue-300 border-blue-200 dark:border-blue-600/40',
  MANUFACTURING: 'bg-amber-50 dark:bg-amber-500/20 text-[#B45309] dark:text-amber-300 border-amber-200 dark:border-amber-600/40',
  SALES: 'bg-orange-50 dark:bg-orange-500/20 text-[#C2410C] dark:text-orange-300 border-orange-200 dark:border-orange-600/40',
  INVENTORY: 'bg-emerald-50 dark:bg-emerald-500/20 text-[#047857] dark:text-emerald-300 border-emerald-200 dark:border-emerald-600/40',
  QUALITY: 'bg-cyan-50 dark:bg-cyan-500/20 text-[#0E7490] dark:text-cyan-300 border-cyan-200 dark:border-cyan-600/40',
};

export default function Sidebar({
  currentTab,
  onTabChange,
  stats,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { user, logout, canAccess } = useAuth();
  const {
    currentShift,
    productionDate,
    timeRemaining,
    timeElapsedPercent,
    isTransitioning,
    isMounted,
  } = useCurrentShift();

  const getShiftIcon = (iconName: string, className = 'w-3.5 h-3.5') => {
    switch (iconName) {
      case 'Sun':
        return <Sun className={`${className} text-amber-500`} />;
      case 'Sunset':
        return <Sunset className={`${className} text-orange-500`} />;
      case 'Moon':
        return <Moon className={`${className} text-purple-400`} />;
      default:
        return <Clock className={`${className} text-emerald-500`} />;
    }
  };

  // Internal state fallback for standalone / uncontrolled usage
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('tubex_sidebar_collapsed') === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  const isCollapsed =
    controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = useCallback(() => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('tubex_sidebar_collapsed', String(next));
          } catch {
            // ignore
          }
        }
        return next;
      });
    }
  }, [onToggleCollapse]);

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggle]);

  const allNavItems: {
    id: NavigationTab;
    label: string;
    href: string;
    icon: any;
    badge?: string | number;
    shortcut?: string;
  }[] = [
    { id: 'home', label: 'Home Landing Hub', href: '/', icon: Home, shortcut: '1' },
    { id: 'overview', label: 'Dashboard Overview', href: '/overview', icon: LayoutDashboard, shortcut: '2' },
    { id: 'master-data', label: 'Master Data', href: '/master-data', icon: Building2, badge: (stats?.totalSuppliers || 0) + (stats?.totalProducts || 0), shortcut: '3' },
    { id: 'procurement', label: 'Procurement (RM PO)', href: '/procurement', icon: ShoppingCart, badge: stats?.totalPOs, shortcut: '4' },
    { id: 'receiving', label: 'Receiving & Tally', href: '/receiving', icon: Truck, badge: stats?.pipes?.available ? `${stats.pipes.available} Avail` : undefined, shortcut: '5' },
    { id: 'customer-orders', label: "Customer's Orders", href: '/customer-orders', icon: FileSpreadsheet, badge: stats?.customerOrders?.active ? `${stats.customerOrders.active} Open` : undefined, shortcut: '6' },
    { id: 'shop-floor', label: 'Shop Floor & Routing', href: '/shop-floor', icon: Wrench, badge: stats?.workOrders?.active ? `${stats.workOrders.active} Open` : undefined, shortcut: '7' },
    { id: 'quality', label: 'Quality & Rejections', href: '/quality', icon: ShieldAlert, badge: stats?.quality?.totalDefectParts ? `${stats.quality.totalDefectParts} Def` : undefined, shortcut: '8' },
    { id: 'traceability', label: 'Traceability Explorer', href: '/traceability', icon: GitFork, shortcut: '9' },
    { id: 'admin-export', label: 'Data Export Center', href: '/admin-export', icon: Database, badge: 'Excel/CSV', shortcut: 'E' },
    { id: 'user-management', label: 'User & Access Control', href: '/user-management', icon: Users, badge: 'RBAC', shortcut: 'U' },
  ];

  // Filter navigation items by dynamic role authorization
  const visibleNavItems = allNavItems.filter((item) => canAccess(item.id));

  return (
    <aside
      className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 select-none transition-all duration-200 ease-in-out relative z-20 ${
        isCollapsed ? 'w-20 min-w-[5rem]' : 'w-64 min-w-[16rem]'
      }`}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          {!isCollapsed ? (
            <>
              <Link href="/" className="flex items-center space-x-3 overflow-hidden min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4F46E5] to-[#4338CA] flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                  <Factory className="w-5 h-5 text-white" />
                </div>
                <div className="overflow-hidden min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white tracking-wide uppercase font-mono truncate">
                    EOT ERP
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Couplings & Mill System
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={handleToggle}
                aria-label="Collapse sidebar"
                title="Collapse sidebar (Ctrl+B)"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={handleToggle}
                aria-label="Expand sidebar"
                title="Expand sidebar (Ctrl+B)"
                className="group relative w-10 h-10 rounded-lg bg-gradient-to-br from-[#4F46E5] to-[#4338CA] flex items-center justify-center shadow-md shadow-indigo-500/20 hover:scale-105 transition-all cursor-pointer"
              >
                <Factory className="w-5 h-5 text-white group-hover:hidden transition-transform" />
                <ChevronRight className="w-5 h-5 text-white hidden group-hover:block transition-transform" />
              </button>
            </div>
          )}
        </div>

        {/* Real-Time Operational Shift Indicator */}
        {!isCollapsed ? (
          <div className="mx-3 mt-3 space-y-2 animate-fade-in">
            {/* Prominent Active Shift Status Rail */}
            <div
              className={`p-2.5 rounded-xl border transition-all shadow-sm ${
                isTransitioning
                  ? 'bg-amber-50/90 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-400/40'
                  : 'bg-slate-100/90 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="relative flex h-2.5 w-2.5 shrink-0">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isTransitioning ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        isTransitioning ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center space-x-1.5 min-w-0">
                    {getShiftIcon(currentShift.theme.iconName, 'w-3.5 h-3.5 shrink-0')}
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {isMounted ? currentShift.displayName : 'Shift Syncing...'}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 shrink-0 shadow-2xs">
                  {isMounted
                    ? `${currentShift.startTime.slice(0, 5)} - ${currentShift.endTime.slice(0, 5)}`
                    : '--:--'}
                </span>
              </div>

              {/* Countdown & Production Date */}
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-700/50 text-[10px]">
                {isTransitioning ? (
                  <span className="text-amber-700 dark:text-amber-300 font-bold flex items-center space-x-1 font-mono">
                    <AlertTriangle className="w-3 h-3 text-amber-500 animate-bounce shrink-0" />
                    <span>Handoff in {timeRemaining.formatted}</span>
                  </span>
                ) : (
                  <span className="text-slate-600 dark:text-slate-400 font-mono">
                    Remaining: <strong className="text-slate-800 dark:text-slate-200">{timeRemaining.formatted}</strong>
                  </span>
                )}
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                  {productionDate}
                </span>
              </div>
            </div>

            {/* Departmental User Roles Badges */}
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">
                Assigned Role
              </span>
              <div className="flex items-center gap-1 flex-wrap justify-end max-w-[130px]">
                {(user?.roles && user.roles.length > 0 ? user.roles : user?.role ? [user.role] : ['GUEST']).map((r) => (
                  <span
                    key={r}
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                      ROLE_BADGE_STYLES[r] || 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Collapsed Tooltip Mode */
          <div className="flex justify-center my-3 relative group">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-help transition-all shadow-sm ${
                isTransitioning
                  ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700/80'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700'
              }`}
              title={`${currentShift.displayName} (${currentShift.startTime.slice(0, 5)} - ${currentShift.endTime.slice(0, 5)})`}
            >
              <div className="relative flex items-center justify-center">
                {getShiftIcon(currentShift.theme.iconName, 'w-4 h-4')}
                <span
                  className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                    isTransitioning ? 'bg-amber-500 animate-bounce' : 'bg-emerald-500 animate-pulse'
                  }`}
                />
              </div>
            </div>

            {/* Rich Collapsed Popover Tooltip */}
            <div className="absolute left-full ml-3 px-3 py-2.5 bg-slate-900 dark:bg-slate-850 text-white text-xs rounded-xl shadow-2xl border border-slate-700 whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 transform scale-95 group-hover:scale-100 space-y-1">
              <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-700/80">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-slate-100">{currentShift.displayName}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({currentShift.startTime.slice(0, 5)} - {currentShift.endTime.slice(0, 5)})
                </span>
              </div>
              <div className="text-[10px] text-slate-300 font-mono flex items-center justify-between gap-4">
                <span>Remaining: <strong className="text-emerald-400">{timeRemaining.formatted}</strong></span>
                <span className="text-slate-400">{productionDate}</span>
              </div>
              {isTransitioning && (
                <div className="text-[9px] text-amber-400 font-semibold flex items-center space-x-1 pt-0.5">
                  <AlertTriangle className="w-3 h-3 inline" />
                  <span>Shift handover imminent</span>
                </div>
              )}
              <div className="text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-800">
                User: {user?.name} ({user?.roles?.join(', ') || user?.role || 'Guest'})
              </div>
            </div>
          </div>
        )}

        {/* MD Executive Read-Only Notice */}
        {user?.role === 'MD' && !isCollapsed && (
          <div className="mx-3 mt-2 px-2.5 py-1.5 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-[#6D28D9] dark:text-purple-200 text-[10px] flex items-center space-x-1.5 animate-fade-in">
            <Eye className="w-3.5 h-3.5 text-[#6D28D9] dark:text-purple-400 shrink-0" />
            <span>Executive Read-Only Active</span>
          </div>
        )}

        {/* Navigation Items */}
        <nav className={`space-y-1 ${isCollapsed ? 'p-2' : 'p-3'}`}>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => onTabChange(item.id)}
                className={`relative group w-full flex items-center rounded-lg transition-all duration-150 ${
                  isCollapsed
                    ? 'justify-center p-2.5'
                    : 'justify-between px-3 py-2 text-xs font-medium'
                } ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#4F46E5] dark:bg-[#4F46E5] dark:text-white font-semibold border border-[#C7D2FE]/70 dark:border-transparent shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#4338CA] dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center relative' : 'space-x-2.5 truncate mr-2'}`}>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#4F46E5] dark:text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-[#4338CA] dark:group-hover:text-slate-200'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                  {isCollapsed && item.badge !== undefined && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#4F46E5] ring-2 ring-white dark:ring-slate-900" />
                  )}
                </div>

                {!isCollapsed && item.badge !== undefined && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 whitespace-nowrap ${
                      isActive
                        ? 'bg-[#4F46E5]/10 text-[#4F46E5] dark:bg-white/20 dark:text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Collapsed Mode Popover Tooltip */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-xs rounded-xl shadow-2xl border border-slate-700 whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 transform scale-95 group-hover:scale-100 flex items-center space-x-2">
                    <span className="font-semibold text-slate-100">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-[#4F46E5] text-white font-bold">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Session, Logout Footer & "Powered by @Dhaaveg" Watermark */}
      <div className={`border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 transition-all ${
        isCollapsed ? 'p-2' : 'p-3'
      }`}>
        {!isCollapsed ? (
          <>
            {/* Watermark directly above user's name */}
            <div className="mb-2 px-1 flex items-center justify-between">
              <a
                href="https://github.com/dhaaveg"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] sm:text-[11px] font-mono tracking-wider text-slate-400 dark:text-slate-500 hover:text-[#4F46E5] dark:hover:text-indigo-400 transition-colors flex items-center space-x-1"
                title="Designed & Developed by Dhaaveg for OCTG Tubex ERP"
              >
                <span>Powered by</span>
                <span className="font-semibold text-slate-600 dark:text-slate-400 hover:text-[#4F46E5] dark:hover:text-indigo-400">@Dhaaveg</span>
              </a>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="System Operational" />
            </div>

            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-slate-800 dark:text-slate-200 text-xs shrink-0 shadow-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate font-mono">
                      {user.email}
                    </span>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition shrink-0 ml-1 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="w-full py-1.5 px-3 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold text-center block transition-colors"
              >
                Sign In
              </Link>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            {/* Collapsed Watermark mark */}
            <div className="relative group">
              <a
                href="https://github.com/dhaaveg"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono font-bold tracking-tight px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-500 hover:text-[#4F46E5] dark:hover:text-indigo-400 transition-colors block text-center"
              >
                @Dh
              </a>
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-mono rounded-lg shadow-xl border border-slate-700 whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                Powered by @Dhaaveg
              </div>
            </div>

            {user ? (
              <div className="relative group flex flex-col items-center">
                <div
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-slate-800 dark:text-slate-200 text-xs shrink-0 shadow-sm cursor-pointer"
                  title={`${user.name} (${user.email})`}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={logout}
                  className="mt-2 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
                <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-xs rounded-xl shadow-xl border border-slate-700 whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="p-2 rounded-lg bg-[#4F46E5] text-white hover:bg-[#4338CA] transition-colors"
                title="Sign In"
              >
                <LogOut className="w-4 h-4 rotate-180" />
              </Link>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
