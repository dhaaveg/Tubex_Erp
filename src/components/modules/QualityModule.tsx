'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  BarChart2, 
  Clock, 
  Wrench, 
  Trash2, 
  RefreshCw,
  Download
} from 'lucide-react';
import { DEFECT_CATEGORIES, DISPOSITION_ACTIONS } from '@/lib/types';
import { exportToCsv } from '@/lib/export';
import { formatDateTime } from '@/lib/formatters';
import { apiUrl } from '@/lib/api';

export default function QualityModule() {
  const [rejections, setRejections] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({ byCategory: {}, byDisposition: {}, totalDefects: 0 });
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDisposition, setSelectedDisposition] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchRejections = async () => {
    setIsLoading(true);
    try {
      let url = '/api/rejections?';
      if (selectedCategory) url += `category=${encodeURIComponent(selectedCategory)}&`;
      if (selectedDisposition) url += `disposition=${encodeURIComponent(selectedDisposition)}&`;

      const res = await fetch(apiUrl(url));
      const data = await res.json();
      if (data.rejections) setRejections(data.rejections);
      if (data.analytics) setAnalytics(data.analytics);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRejections();
  }, [selectedCategory, selectedDisposition]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Quality Assurance & Rejection Analytics</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Real-time defect logging, scrap disposition breakdown, and shop floor root-cause tracking across 14 defect categories.
          </p>
        </div>

        <button
          onClick={fetchRejections}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs flex items-center space-x-1.5 self-start sm:self-auto transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-500 dark:text-blue-400' : ''}`} />
          <span>Refresh Defect Data</span>
        </button>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold tracking-wider">Total Defect Parts</div>
          <div className="mt-1 text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {analytics.totalDefects} pcs
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Across all shop floor routing stages</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold tracking-wider">Permanent Scrap</div>
          <div className="mt-1 text-2xl font-bold font-mono text-rose-700 dark:text-rose-500">
            {analytics.byDisposition['Scrap'] || 0} pcs
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Irrecoverable material faults</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold tracking-wider">Thread / Shop Rework</div>
          <div className="mt-1 text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {analytics.byDisposition['Rework Thread'] || 0} pcs
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Sent to corrective machining bench</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold tracking-wider">Recut Short / Down-grade</div>
          <div className="mt-1 text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
            {(analytics.byDisposition['Recut Short'] || 0) + (analytics.byDisposition['Down-grade'] || 0)} pcs
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Re-purposed or salvaged parts</div>
        </div>
      </div>

      {/* Defect Category Breakdown */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Defect Frequency by Category</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 text-xs">
          {DEFECT_CATEGORIES.map((cat) => {
            const count = analytics.byCategory[cat] || 0;
            const isSelected = selectedCategory === cat;
            return (
              <div
                key={cat}
                onClick={() => setSelectedCategory(isSelected ? '' : cat)}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-950/60 dark:border-rose-600 dark:text-white font-semibold ring-1 ring-rose-500'
                    : count > 0
                    ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-slate-800 dark:text-slate-300 font-medium'
                    : 'bg-white dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span className="truncate pr-2">{cat}</span>
                <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] border ${
                  isSelected
                    ? 'bg-rose-100 dark:bg-slate-900 border-rose-300 dark:border-slate-800 text-rose-800 dark:text-white'
                    : count > 0
                    ? 'bg-slate-200/80 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                    : 'bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500'
                }`}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter & Rejections Log Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-lg space-y-3 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Rejection Postings Log</h3>
          </div>

          {/* Filters & Export */}
          <div className="flex items-center space-x-2">
            <select
              value={selectedDisposition}
              onChange={(e) => setSelectedDisposition(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Dispositions</option>
              {DISPOSITION_ACTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                exportToCsv(
                  'Quality_Rejections_Defect_Log',
                  rejections.map((r) => ({
                    Rejection_ID: r.rp_id,
                    Work_Order_ID: r.wo_id,
                    Stage_Name: r.production_posting?.process_stage_name,
                    Defect_Category: r.defect_category,
                    Defect_Quantity: r.defect_quantity,
                    Disposition_Action: r.disposition_action,
                    Inspector_Remarks: r.inspector_remarks,
                    Timestamp: r.logged_timestamp,
                  }))
                )
              }
              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center space-x-1 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[11px] uppercase font-semibold">
              <tr>
                <th className="px-3 py-2.5">Rejection ID</th>
                <th className="px-3 py-2.5">Work Order</th>
                <th className="px-3 py-2.5">Process Stage</th>
                <th className="px-3 py-2.5">Defect Category</th>
                <th className="px-3 py-2.5">Defect Qty</th>
                <th className="px-3 py-2.5">Disposition</th>
                <th className="px-3 py-2.5">Inspector Remarks</th>
                <th className="px-3 py-2.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {rejections.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No rejection events found.
                  </td>
                </tr>
              ) : (
                rejections.map((r) => (
                  <tr key={r.rp_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors duration-150">
                    <td className="px-3 py-2.5 text-rose-600 dark:text-rose-400 font-bold">{r.rp_id}</td>
                    <td className="px-3 py-2.5 text-blue-600 dark:text-blue-400 font-bold">{r.wo_id}</td>
                    <td className="px-3 py-2.5 font-sans font-medium text-slate-700 dark:text-slate-300">
                      {r.production_posting?.process_stage_name}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">{r.defect_category}</td>
                    <td className="px-3 py-2.5 text-rose-600 dark:text-rose-400 font-bold">{r.defect_quantity} pcs</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                          r.disposition_action === 'Scrap'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {r.disposition_action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-sans text-slate-600 dark:text-slate-400 text-[11px] max-w-xs truncate">
                      {r.inspector_remarks || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 text-[10px]">
                      {formatDateTime(r.logged_timestamp)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
