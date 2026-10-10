'use client';

import React from 'react';
import { 
  Factory, 
  Package, 
  AlertTriangle, 
  Scissors, 
  ArrowUpRight, 
  Plus, 
  ShoppingCart, 
  Truck, 
  Wrench, 
  GitFork,
  Scale,
  FileSpreadsheet,
} from 'lucide-react';
import { NavigationTab } from '../Sidebar';
import RecentActivityFeed from '../RecentActivityFeed';

interface OverviewDashboardProps {
  stats: any;
  onNavigate: (tab: NavigationTab) => void;
}

export default function OverviewDashboard({ stats, onNavigate }: OverviewDashboardProps) {
  const cards = [
    {
      title: 'Active Suppliers',
      value: stats?.totalSuppliers ?? 0,
      subtext: 'Dalmine, Vallourec, JFE Mills',
      icon: Factory,
      color: 'blue',
      tab: 'master-data' as NavigationTab,
    },
    {
      title: 'OCTG Products',
      value: stats?.totalProducts ?? 0,
      subtext: 'API 5CT J55, L80, P110',
      icon: Package,
      color: 'indigo',
      tab: 'master-data' as NavigationTab,
    },
    {
      title: 'Raw Material Purchase Orders (RM PO)',
      value: stats?.totalPOs ?? 0,
      subtext: 'Active Raw Material Contracts',
      icon: ShoppingCart,
      color: 'emerald',
      tab: 'procurement' as NavigationTab,
    },
    {
      title: 'Pipes In Inventory',
      value: stats?.pipes?.total ?? 0,
      subtext: `${stats?.pipes?.available ?? 0} Available for WO`,
      icon: Truck,
      color: 'amber',
      tab: 'receiving' as NavigationTab,
    },
    {
      title: 'Average Cutting Yield',
      value: `${stats?.cuttingYield?.averageCuttingYieldPct ?? 0}%`,
      subtext: `${stats?.cuttingYield?.totalPlannedParts ?? 0} Planned Parts to Yield`,
      icon: Scissors,
      color: 'emerald',
      tab: 'receiving' as NavigationTab,
    },
    {
      title: 'Customer Orders',
      value: stats?.customerOrders?.active ?? stats?.customerOrders?.total ?? 0,
      subtext: `${stats?.customerOrders?.total ?? 0} Total Contracts`,
      icon: FileSpreadsheet,
      color: 'purple',
      tab: 'customer-orders' as NavigationTab,
    },
    {
      title: 'Active Work Orders',
      value: stats?.workOrders?.active ?? 0,
      subtext: `${stats?.workOrders?.total ?? 0} Total Work Orders`,
      icon: Wrench,
      color: 'blue',
      tab: 'shop-floor' as NavigationTab,
    },
    {
      title: 'Defects & Rejections',
      value: stats?.quality?.totalDefectParts ?? 0,
      subtext: `${stats?.quality?.totalRejectionEvents ?? 0} Logged Events`,
      icon: AlertTriangle,
      color: 'rose',
      tab: 'quality' as NavigationTab,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950/80 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-blue-900/40 border border-blue-700/50 text-blue-300 text-xs font-mono mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>API 5CT Tubular Processing Operations</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Manufacturing & Pipe Processing ERP Hub
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Strict 11-table relational architecture with automated cutting yield math, production balance gates, and forward/backward heat-to-scrap traceability.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate('procurement')}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New RM PO</span>
            </button>
            <button
              onClick={() => onNavigate('receiving')}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all"
            >
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span>GRN / Tally</span>
            </button>
            <button
              onClick={() => onNavigate('shop-floor')}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all"
            >
              <Wrench className="w-3.5 h-3.5 text-blue-400" />
              <span>Release WO</span>
            </button>
            <button
              onClick={() => onNavigate('traceability')}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 border border-indigo-700/60 text-xs font-medium transition-all"
            >
              <GitFork className="w-3.5 h-3.5 text-indigo-400" />
              <span>Traceability</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={() => onNavigate(card.tab)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 cursor-pointer transition-all hover:translate-y-[-2px] group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:text-white transition-colors`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-white">
                {card.value}
              </div>
              <div className="mt-1 text-xs text-slate-400 flex items-center justify-between">
                <span>{card.subtext}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Industrial Business Logic Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cutting Yield Architecture */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Scissors className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Cutting Yield Engine</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800/80 text-emerald-300">
              Live Active
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Automatically calculates expected yield, rounded piece count, and end scrap mm when entering individual pipe lengths against master parting dimensions.
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
            <div className="text-blue-400">Rounded_Qty = floor(Length / Parting)</div>
            <div className="text-amber-400">End_Scrap_mm = Length - (Qty * Parting)</div>
            <div className="text-emerald-400">Average Current Yield: {stats?.cuttingYield?.averageCuttingYieldPct ?? 98.7}%</div>
          </div>
        </div>

        {/* Production Balance Gate */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Scale className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Production Balance Gate</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 border border-blue-800/80 text-blue-300">
              Enforced
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Strict validation across all 8 routing stages preventing ghost parts or unrecorded scrap. Input quantity must strictly equal outputs.
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
            <div className="text-emerald-400">Input ≡ Accepted + Rejected + Rework</div>
            <div className="text-rose-400">If Rejected &gt; 0, defect log required</div>
            <div className="text-indigo-400">Total Defect Parts: {stats?.quality?.totalDefectParts ?? 0} pcs</div>
          </div>
        </div>
      </div>

      {/* Real-Time Operational Recent Activity Feed */}
      <RecentActivityFeed
        limit={15}
        title="Recent Operational Activity"
        onViewAll={() => onNavigate('admin-export')}
      />
    </div>
  );
}
