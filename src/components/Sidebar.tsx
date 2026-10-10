'use client';

import React from 'react';
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
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export type NavigationTab = 
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
  'overview': '/',
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

interface SidebarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  stats?: any;
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-rose-500/20 text-rose-300 border-rose-600/40',
  ADMIN: 'bg-indigo-500/20 text-indigo-300 border-indigo-600/40',
  MD: 'bg-purple-500/20 text-purple-300 border-purple-600/40',
  PROCUREMENT: 'bg-blue-500/20 text-blue-300 border-blue-600/40',
  MANUFACTURING: 'bg-amber-500/20 text-amber-300 border-amber-600/40',
  SALES: 'bg-orange-500/20 text-orange-300 border-orange-600/40',
  INVENTORY: 'bg-emerald-500/20 text-emerald-300 border-emerald-600/40',
  QUALITY: 'bg-cyan-500/20 text-cyan-300 border-cyan-600/40',
};

export default function Sidebar({ currentTab, onTabChange, stats }: SidebarProps) {
  const { user, logout, canAccess } = useAuth();

  const allNavItems: { id: NavigationTab; label: string; href: string; icon: any; badge?: string | number }[] = [
    { id: 'overview', label: 'Dashboard Overview', href: '/', icon: LayoutDashboard },
    { id: 'master-data', label: 'Master Data', href: '/master-data', icon: Building2, badge: (stats?.totalSuppliers || 0) + (stats?.totalProducts || 0) },
    { id: 'procurement', label: 'Procurement (RM PO)', href: '/procurement', icon: ShoppingCart, badge: stats?.totalPOs },
    { id: 'receiving', label: 'Receiving & Tally', href: '/receiving', icon: Truck, badge: stats?.pipes?.available ? `${stats.pipes.available} Avail` : undefined },
    { id: 'customer-orders', label: "Customer's Orders", href: '/customer-orders', icon: FileSpreadsheet, badge: stats?.customerOrders?.active ? `${stats.customerOrders.active} Open` : undefined },
    { id: 'shop-floor', label: 'Shop Floor & Routing', href: '/shop-floor', icon: Wrench, badge: stats?.workOrders?.active ? `${stats.workOrders.active} Open` : undefined },
    { id: 'quality', label: 'Quality & Rejections', href: '/quality', icon: ShieldAlert, badge: stats?.quality?.totalDefectParts ? `${stats.quality.totalDefectParts} Def` : undefined },
    { id: 'traceability', label: 'Traceability Explorer', href: '/traceability', icon: GitFork },
    { id: 'admin-export', label: 'Data Export Center', href: '/admin-export', icon: Database, badge: 'Excel/CSV' },
    { id: 'user-management', label: 'User & Access Control', href: '/user-management', icon: Users, badge: 'RBAC' },
  ];

  // Filter navigation items by dynamic role authorization
  const visibleNavItems = allNavItems.filter((item) => canAccess(item.id));

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div className="flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-800 bg-slate-950/60">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Factory className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-wide uppercase font-mono">EOT ERP</div>
              <div className="text-[10px] text-slate-400">Couplings & Mill System</div>
            </div>
          </Link>
        </div>

        {/* User Role & Operational Context Banner */}
        <div className="px-3.5 py-2.5 mx-3 mt-3 rounded-lg bg-slate-800/70 border border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-medium text-slate-300">
              {user?.roles?.includes('MD') || user?.role === 'MD' ? 'Executive Mode' : 'Shift A Active'}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-wrap justify-end max-w-[130px]">
            {(user?.roles && user.roles.length > 0 ? user.roles : user?.role ? [user.role] : ['GUEST']).map((r) => (
              <span
                key={r}
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                  ROLE_BADGE_STYLES[r] || 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        {/* MD Executive Read-Only Notice */}
        {user?.role === 'MD' && (
          <div className="mx-3 mt-2 px-2.5 py-1.5 rounded bg-purple-950/40 border border-purple-800/60 text-purple-200 text-[10px] flex items-center space-x-1.5">
            <Eye className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Executive Read-Only Active</span>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? 'bg-blue-700/80 text-blue-100'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Session & Logout Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-xs shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block truncate">
                  {user.name}
                </span>
                <span className="text-[10px] text-slate-400 block truncate font-mono">
                  {user.email}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition shrink-0 ml-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full py-1.5 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold text-center block"
          >
            Sign In
          </Link>
        )}
      </div>
    </aside>
  );
}
