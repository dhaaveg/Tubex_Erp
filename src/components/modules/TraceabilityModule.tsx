'use client';

import React, { useState, useEffect } from 'react';
import { 
  GitFork, 
  Search, 
  Building2, 
  ShoppingCart, 
  Truck, 
  Barcode, 
  Wrench, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  ArrowDown, 
  Layers, 
  FileText, 
  Sparkles,
  AlertCircle,
  Printer,
  Award
} from 'lucide-react';
import TagPrintModal from '../TagPrintModal';
import MtcViewerModal from '../MtcViewerModal';
import { formatDate, formatDateTime } from '@/lib/formatters';

interface TraceabilityModuleProps {
  initialQuery?: string;
}

export default function TraceabilityModule({ initialQuery = 'TAG-HT84920-001' }: TraceabilityModuleProps) {
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activePrintPipe, setActivePrintPipe] = useState<any | null>(null);
  const [activeMtcSheet, setActiveMtcSheet] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (searchTarget?: string) => {
    const q = searchTarget || query;
    if (!q) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/traceability?q=${encodeURIComponent(q)}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Traceability record not found');
      setData(result);
    } catch (err: any) {
      setError(err.message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleSearch(initialQuery);
  }, []);

  // Extract entities from returned payload
  const tallyItem = data?.tallyItem || data?.primaryItem;
  const tallySheet = data?.tallySheet || tallyItem?.tally_sheet;
  const grnItem = tallySheet?.grn_item;
  const grn = grnItem?.grn;
  const po = grn?.purchase_order || data?.purchaseOrder;
  const supplier = po?.supplier;
  const product = grnItem?.product;
  const workOrder = data?.workOrder || (tallyItem?.work_orders && tallyItem.work_orders[0]);
  const postings = workOrder?.production_postings || [];
  const rejections = workOrder?.rejection_postings || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Forward & Backward Traceability Explorer
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Complete genealogy engine connecting mill origin, heat metallurgy, dimensional pipe cutting, shop job cards, routing logs, and scrap dispositions.
        </p>
      </div>

      {/* Search Bar & Preset Tags */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Heat No (HT-84920), Pipe Tag (TAG-HT84920-001), WO ID (WO-2026-001), PO No..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
          >
            {isLoading ? 'Traversing Graph...' : 'Trace Provenance'}
          </button>
        </div>

        {/* Preset Quick Clicks */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-slate-500 text-[11px]">Quick Samples:</span>
          <button
            onClick={() => {
              setQuery('HT-84920');
              handleSearch('HT-84920');
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 font-mono text-[11px] border border-slate-700"
          >
            Heat No: HT-84920
          </button>
          <button
            onClick={() => {
              setQuery('TAG-HT84920-001');
              handleSearch('TAG-HT84920-001');
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono text-[11px] border border-slate-700"
          >
            Pipe Tag: TAG-HT84920-001
          </button>
          <button
            onClick={() => {
              setQuery('WO-2026-001');
              handleSearch('WO-2026-001');
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono text-[11px] border border-slate-700"
          >
            Work Order: WO-2026-001
          </button>
          <button
            onClick={() => {
              setQuery('PO-2026-001');
              handleSearch('PO-2026-001');
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono text-[11px] border border-slate-700"
          >
            Purchase Order: PO-2026-001
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Traceability Graph Flow */}
      {data && (
        <div className="space-y-6">
          {/* Visual Step Tree */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Step 1: Supplier Master */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-mono">
                <span className="flex items-center space-x-1.5 text-blue-400 font-bold">
                  <Building2 className="w-4 h-4" />
                  <span>1. Mill Origin</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800">Master</span>
              </div>
              <div className="font-bold text-white text-sm">
                {supplier?.supplier_name || 'Tenaris Global Tubulars Ltd'}
              </div>
              <div className="text-xs text-slate-300 font-medium">
                Mill: {supplier?.mill_name || 'Dalmine Seamless Tube Mill'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                GST: {supplier?.gst_tax_id || 'LU-218492019'}
              </div>
            </div>

            {/* Step 2: PO & Gate Weighbridge */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-mono">
                <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                  <Truck className="w-4 h-4" />
                  <span>2. Gate & Weighbridge</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800">Inwarded</span>
              </div>
              <div className="font-mono font-bold text-white text-sm">
                GRN: {grn?.grn_id || 'GRN-2026-001'}
              </div>
              <div className="text-xs text-slate-300">
                PO: <span className="font-mono text-blue-400">{po?.po_no || 'PO-2026-001'}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex justify-between">
                <span>Weighbridge: {grn?.actual_weighbridge_weight_mt || 42.38} MT</span>
                <span className="text-amber-400">Δ {grn?.weight_difference_mt || -0.12} MT</span>
              </div>
            </div>

            {/* Step 3: Heat Metallurgy & Tally */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-mono">
                <span className="flex items-center space-x-1.5 text-amber-400 font-bold">
                  <Barcode className="w-4 h-4" />
                  <span>3. Heat / Pipe Tag</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800">Dimensional</span>
              </div>
              <div className="font-mono font-bold text-amber-400 text-sm">
                {tallyItem?.ti_id || 'TAG-HT84920-001'}
              </div>
              <div className="text-xs text-slate-300 font-mono">
                Heat: <span className="text-blue-300 font-bold">{tallySheet?.heat_no || 'HT-84920'}</span> • Lot:{' '}
                {tallySheet?.lot_no || 'LOT-2026-A1'}
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex justify-between items-center pt-1 border-t border-slate-800">
                <span>MTC: {tallySheet?.mill_test_certificate_no || 'MTC-TEN-84920'}</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setActivePrintPipe({ ...tallyItem, tally_sheet: tallySheet, product })}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-sans font-medium text-[10px] flex items-center space-x-1"
                    title="Print Tube Barcode Tag"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Tag</span>
                  </button>
                  <button
                    onClick={() => setActiveMtcSheet(tallySheet)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-sans font-medium text-[10px] flex items-center space-x-1"
                    title="View Mill Test Certificate"
                  >
                    <Award className="w-3 h-3" />
                    <span>MTC</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Step 4: Shop Floor Work Order */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-mono">
                <span className="flex items-center space-x-1.5 text-indigo-400 font-bold">
                  <Wrench className="w-4 h-4" />
                  <span>4. Job Card Execution</span>
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    workOrder?.wo_status === 'Completed' ? 'bg-emerald-950 text-emerald-300' : 'bg-blue-950 text-blue-300'
                  }`}
                >
                  {workOrder?.wo_status || 'In Progress'}
                </span>
              </div>
              <div className="font-mono font-bold text-white text-sm">
                {workOrder?.wo_id || 'WO-2026-001'}
              </div>
              <div className="text-xs text-slate-300 font-mono">
                Line: {workOrder?.machine_line_no || 'CNC-CELL-01'} • {workOrder?.shift || 'Shift A'}
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex justify-between">
                <span>Stages: {postings.length} / 8</span>
                <span className="text-rose-400 font-bold">{rejections.length} Defects</span>
              </div>
            </div>
          </div>

          {/* Full Detailed Provenance Audit Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono flex items-center space-x-2">
              <GitFork className="w-4 h-4 text-blue-400" />
              <span>Full Provenance Timeline & Routing Stages</span>
            </h3>

            {/* Dimensional Cutting Yield Performance for this specific pipe */}
            {tallyItem && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-200">Pipe Dimensional Verification & Cutting Math</span>
                  <span className="text-emerald-400 font-bold">
                    Yield: {((((tallyItem.rounded_qty * tallyItem.parting_length_mm) / tallyItem.tube_length_mm) * 100) || 98.8).toFixed(1)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-400">
                  <div>
                    <span className="text-[10px] text-slate-500 block">RAW TUBE LENGTH</span>
                    <span className="text-white font-bold">{tallyItem.tube_length_mm} mm</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">PARTING LENGTH</span>
                    <span className="text-white font-bold">{tallyItem.parting_length_mm} mm</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">PARTS YIELDED</span>
                    <span className="text-emerald-400 font-bold">{tallyItem.rounded_qty} pieces</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">END SCRAP MM</span>
                    <span className="text-amber-400 font-bold">{tallyItem.end_scrap_mm} mm</span>
                  </div>
                </div>
              </div>
            )}

            {/* 8 Routing Process Steps Table */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                Production Routing History ({postings.length} Logged Stages)
              </span>

              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                    <tr>
                      <th className="px-3 py-2.5">Seq</th>
                      <th className="px-3 py-2.5">Process Stage</th>
                      <th className="px-3 py-2.5">Operator & Station</th>
                      <th className="px-3 py-2.5">Input</th>
                      <th className="px-3 py-2.5">Accepted</th>
                      <th className="px-3 py-2.5">Rejected</th>
                      <th className="px-3 py-2.5">Rework</th>
                      <th className="px-3 py-2.5">Gate Balance Status</th>
                      <th className="px-3 py-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {postings.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-slate-500 font-sans">
                          No production postings executed for this job card yet.
                        </td>
                      </tr>
                    ) : (
                      postings.map((p: any) => {
                        const isBalanced = p.input_quantity === p.accepted_quantity + p.rejected_quantity + p.rework_quantity;
                        return (
                          <tr key={p.pp_id} className="hover:bg-slate-850/40">
                            <td className="px-3 py-2.5 text-blue-400 font-bold">OP {p.operation_seq_no}</td>
                            <td className="px-3 py-2.5 font-sans font-medium text-slate-200">{p.process_stage_name}</td>
                            <td className="px-3 py-2.5 text-slate-400">{p.operator_machine_id}</td>
                            <td className="px-3 py-2.5 text-slate-200 font-bold">{p.input_quantity}</td>
                            <td className="px-3 py-2.5 text-emerald-400 font-bold">{p.accepted_quantity}</td>
                            <td className="px-3 py-2.5 font-bold text-rose-400">
                              {p.rejected_quantity > 0 ? `${p.rejected_quantity} pcs` : '0'}
                            </td>
                            <td className="px-3 py-2.5 text-amber-400">{p.rework_quantity}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] ${
                                  isBalanced ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300'
                                }`}
                              >
                                {isBalanced ? '✔ Balanced' : 'Mismatch'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 text-[10px]">
                              {formatDateTime(p.stage_completion_timestamp)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rejection / Defect Logs Linked to this Pipe */}
            {rejections.length > 0 && (
              <div className="p-4 bg-rose-950/20 border border-rose-800/60 rounded-xl space-y-3 font-mono text-xs">
                <div className="flex items-center space-x-2 text-rose-400 font-bold uppercase">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Defect Categorization & Scrap Audit</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {rejections.map((r: any) => (
                    <div key={r.rp_id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{r.defect_category}</span>
                        <span className="px-2 py-0.5 rounded bg-rose-900/60 text-rose-200 text-[10px] font-bold">
                          Qty: {r.defect_quantity}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Disposition: <span className="text-amber-300 font-bold">{r.disposition_action}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Logged: {formatDateTime(r.logged_timestamp)}
                      </div>
                      <div className="text-[11px] text-slate-400 font-sans italic">
                        &quot;{r.inspector_remarks}&quot;
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tube Tag Print Preview Modal */}
      {activePrintPipe && (
        <TagPrintModal
          pipe={activePrintPipe}
          tallySheet={activePrintPipe.tally_sheet}
          product={activePrintPipe.product}
          onClose={() => setActivePrintPipe(null)}
        />
      )}

      {/* Mill Test Certificate Viewer Modal */}
      {activeMtcSheet && (
        <MtcViewerModal
          tallySheet={activeMtcSheet}
          product={product}
          supplier={supplier}
          onClose={() => setActiveMtcSheet(null)}
        />
      )}
    </div>
  );
}
