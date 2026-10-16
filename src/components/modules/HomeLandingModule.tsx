'use client';

import React from 'react';
import {
  Factory,
  Building2,
  ShoppingCart,
  Truck,
  Wrench,
  ShieldAlert,
  GitFork,
  LayoutDashboard,
  FileSpreadsheet,
  Database,
  Users,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Scale,
  QrCode,
  FileCheck,
  Activity,
  Calendar,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NavigationTab } from '@/lib/routes';

interface HomeLandingModuleProps {
  stats?: any;
  onNavigate: (tab: NavigationTab) => void;
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
  OPERATOR: 'bg-teal-500/20 text-teal-300 border-teal-600/40',
};

interface OperationalModuleCard {
  id: NavigationTab;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badge?: string | number;
  highlightKey?: string;
}

export default function HomeLandingModule({ stats, onNavigate }: HomeLandingModuleProps) {
  const { user, canAccess } = useAuth();

  const userRoles =
    user?.roles && user.roles.length > 0
      ? user.roles
      : user?.role
      ? [user.role]
      : ['OPERATOR'];

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Candidate operational modules for launchpad
  const candidateModules: OperationalModuleCard[] = [
    {
      id: 'overview',
      title: 'Executive Overview',
      description: 'Plant-wide KPIs, shift performance metrics, inventory totals, and manufacturing throughput.',
      icon: LayoutDashboard,
      accentColor: 'from-blue-600 to-indigo-600',
      badge: 'Executive',
    },
    {
      id: 'procurement',
      title: 'Procurement (RM PO)',
      description: 'Raw material purchase orders, mill supplier contracts, delivery tracking, and PO tolerance rules.',
      icon: ShoppingCart,
      accentColor: 'from-emerald-600 to-teal-600',
      badge: stats?.totalPOs ? `${stats.totalPOs} Active POs` : undefined,
    },
    {
      id: 'receiving',
      title: 'Receiving & Pipe Tally',
      description: 'Weighbridge gross vs tare reconciliation, mill heat tally inwarding, and pipe physical logging.',
      icon: Truck,
      accentColor: 'from-amber-600 to-yellow-600',
      badge: stats?.pipes?.available ? `${stats.pipes.available} Pipes In Stock` : undefined,
    },
    {
      id: 'shop-floor',
      title: 'Shop Floor & Routing',
      description: '8-stage manufacturing balance: Cutting, Roughing, Threading, Phosphating, and Inspection routing.',
      icon: Wrench,
      accentColor: 'from-violet-600 to-purple-600',
      badge: stats?.workOrders?.active ? `${stats.workOrders.active} Open WOs` : undefined,
    },
    {
      id: 'quality',
      title: 'Quality & Rejections',
      description: 'Non-destructive testing (MPI), defect classification, scrap quarantine, and disposition tracking.',
      icon: ShieldAlert,
      accentColor: 'from-rose-600 to-red-600',
      badge: stats?.quality?.totalDefectParts ? `${stats.quality.totalDefectParts} Defects` : undefined,
    },
    {
      id: 'traceability',
      title: 'Traceability Explorer',
      description: 'Serialized barcode/tag lookup with full heat-to-pipe provenance, chemical analysis, and MTC genealogy.',
      icon: GitFork,
      accentColor: 'from-cyan-600 to-blue-600',
      badge: 'Genealogy',
    },
    {
      id: 'customer-orders',
      title: "Customer's Orders",
      description: 'Customer purchase orders (CPO), casing/tubing specifications, and finished coupling fulfillment.',
      icon: FileSpreadsheet,
      accentColor: 'from-sky-600 to-indigo-600',
      badge: stats?.customerOrders?.active ? `${stats.customerOrders.active} Open CPOs` : undefined,
    },
    {
      id: 'master-data',
      title: 'Master Data Management',
      description: 'Approved suppliers, OCTG product catalog, coupling dimensions, and metallurgical steel grades.',
      icon: Building2,
      accentColor: 'from-slate-600 to-slate-700',
      badge: stats?.totalSuppliers ? `${stats.totalSuppliers} Suppliers` : undefined,
    },
    {
      id: 'admin-export',
      title: 'Data Export Center',
      description: 'Export structured operational records, heat tallies, and routing logs to Excel and CSV.',
      icon: Database,
      accentColor: 'from-teal-600 to-emerald-600',
      badge: 'Excel / CSV',
    },
    {
      id: 'user-management',
      title: 'User & Access Control',
      description: 'User provisioning, departmental role-based permissions matrix, and system security audit trail.',
      icon: Users,
      accentColor: 'from-indigo-600 to-pink-600',
      badge: 'RBAC',
    },
  ];

  // Dynamic Permitted Modules:
  // Render cards ONLY for the operational modules the logged-in user is authorized to access.
  // If a user has NO access to '/overview', hide the Overview dashboard card completely!
  const permittedModules = candidateModules.filter((mod) => canAccess(mod.id));

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* 1. PERSONALIZED HERO BANNER */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800/80 p-6 sm:p-8 shadow-2xl">
        {/* Ambient Gradient Highlights */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            {/* Status Pill & Date Header */}
            <div className="flex items-center flex-wrap gap-2 text-xs">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-950/80 border border-blue-700/50 text-blue-300 font-mono text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Shift A Active</span>
                <span className="text-slate-500">•</span>
                <span>Mill Synchronized</span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/70 border border-slate-700/60 text-slate-300 text-[11px] font-mono">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{currentDate}</span>
              </div>
            </div>

            {/* Personalized Welcome Header */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">{user?.name || 'Operator'}</span>!
            </h1>

            {/* Subheading with user badge: Role & Department */}
            <div className="flex items-center flex-wrap gap-2 pt-0.5">
              <span className="text-xs text-slate-400 font-medium">Active Credentials:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {userRoles.map((r) => (
                  <span
                    key={r}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase border shadow-sm ${
                      ROLE_BADGE_STYLES[r] || 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Role: {r}
                  </span>
                ))}
              </div>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800/80 text-slate-300 border border-slate-700">
                Department: {user?.department || 'Operations & Production'}
              </span>
            </div>
          </div>

          {/* Quick Context / Enterprise Pill */}
          <div className="lg:text-right shrink-0">
            <div className="inline-flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                <Factory className="w-4 h-4 text-blue-400" />
                <span className="font-semibold text-white tracking-wide">EOT Couplings ERP</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                OCTG API 5CT Manufacturing System
              </p>
              {user?.role === 'MD' && (
                <div className="flex items-center space-x-1.5 text-[10px] text-purple-300 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded mt-1">
                  <Eye className="w-3 h-3 text-purple-400" />
                  <span>Executive Read-Only Active</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. "WHAT THIS ERP IS ABOUT" OVERVIEW SECTION */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#4F46E5] dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
            What This ERP Is About
          </h2>
        </div>

        {/* Mission Statement Box */}
        <div className="relative rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm dark:shadow-md">
          <blockquote className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans border-l-2 border-[#4F46E5] pl-4">
            &ldquo;EOT Couplings ERP is a comprehensive manufacturing execution and traceability platform engineered specifically for OCTG (Oil Country Tubular Goods), API 5CT casing &amp; tubing processing, and precision coupling fabrication. The system governs raw pipe heat tally inwarding, weighbridge tolerance reconciliation, 8-stage shop floor routing balance, defect disposition logging, and complete metallurgical heat-to-pipe provenance.&rdquo;
          </blockquote>

          {/* Core Function Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800/80">
            {/* 1. Procurement & Receiving */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-[#4F46E5] dark:text-blue-400 mb-1.5">
                  <Truck className="w-4 h-4 shrink-0" />
                  <span className="font-semibold text-xs text-slate-900 dark:text-white">Procurement &amp; Receiving</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                  RM PO tracking, weighbridge gross verification, tally sheet logging.
                </p>
              </div>
            </div>

            {/* 2. Shop Floor Routing */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 mb-1.5">
                  <Wrench className="w-4 h-4 shrink-0" />
                  <span className="font-semibold text-xs text-slate-900 dark:text-white">Shop Floor Routing</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                  8-stage manufacturing balance (Cutting, Roughing, Threading, Phosphating, Inspection).
                </p>
              </div>
            </div>

            {/* 3. Quality & Compliance */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-cyan-600 dark:text-cyan-400 mb-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span className="font-semibold text-xs text-slate-900 dark:text-white">Quality &amp; Compliance</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                  Non-destructive testing (MPI), defect categorization, and scrap dispositioning.
                </p>
              </div>
            </div>

            {/* 4. End-to-End Traceability */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 mb-1.5">
                  <GitFork className="w-4 h-4 shrink-0" />
                  <span className="font-semibold text-xs text-slate-900 dark:text-white">End-to-End Traceability</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                  Serialized barcode/tag lookup with full heat and MTC genealogy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. DYNAMIC PERMITTED MODULES LAUNCHPAD */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Authorized Operational Workspaces
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded">
            {permittedModules.length} Modules Accessible
          </span>
        </div>

        {permittedModules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {permittedModules.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.id}
                  onClick={() => onNavigate(module.id)}
                  className="group relative rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-[#4F46E5]/60 dark:hover:border-blue-500/50 p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-blue-950/30 flex flex-col justify-between"
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigate(module.id);
                    }
                  }}
                  aria-label={`Open ${module.title}`}
                >
                  <div>
                    {/* Header Row: Icon & Badge */}
                    <div className="flex items-center justify-between mb-3.5">
                      <div
                        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${module.accentColor} flex items-center justify-center text-white shadow-md shadow-blue-500/10 group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>

                      {module.badge && (
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80">
                          {module.badge}
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#4F46E5] dark:group-hover:text-blue-400 transition-colors">
                      {module.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      {module.description}
                    </p>
                  </div>

                  {/* Launch Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-[#4F46E5] group-hover:text-[#4338CA] dark:text-blue-400 dark:group-hover:text-blue-300">
                    <span>Open Module</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <ShieldAlert className="w-8 h-8 text-amber-500 dark:text-amber-400 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pending Operational Assignment</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Your logged-in role has not yet been assigned active module read permissions. Please contact your system administrator to configure departmental access.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
