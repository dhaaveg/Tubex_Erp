'use client';

import React from 'react';
import { X, Printer, Barcode, CheckCircle2, ShieldCheck, Factory } from 'lucide-react';

interface TagPrintModalProps {
  pipe: any;
  tallySheet?: any;
  product?: any;
  onClose: () => void;
}

export default function TagPrintModal({ pipe, tallySheet, product, onClose }: TagPrintModalProps) {
  if (!pipe) return null;

  const handlePrint = () => {
    window.print();
  };

  const grade = product?.grade || 'L80';
  const thread = product?.thread_type || 'BTC';
  const sizeOd = product?.size_od || 177.8;
  const wt = product?.wall_thickness || 10.36;
  const heatNo = pipe.heat_no || tallySheet?.heat_no || 'HT-84920';
  const lotNo = pipe.lot_no || tallySheet?.lot_no || 'LOT-2026-A1';
  const mtc = pipe.mill_test_certificate_no || tallySheet?.mill_test_certificate_no || 'MTC-TEN-84920-REV2';
  const tubeCount = pipe.tube_count || 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header Actions */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
            <Barcode className="w-4 h-4 text-amber-400" />
            <span>Industrial Lot Barcode Tag Preview (API 5CT)</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Tag</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Physical Tag Container (Styled like a heavy-duty vinyl outdoor pipe tag) */}
        <div className="p-6 flex justify-center bg-slate-950/60">
          <div className="w-full max-w-sm bg-white text-slate-900 p-5 rounded-xl border-4 border-dashed border-amber-500 shadow-2xl relative select-none font-mono">
            {/* Tag Eyelet Hole for steel wire tie */}
            <div className="absolute top-3 right-3 w-4 h-4 rounded-full border-2 border-slate-400 bg-slate-200 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
            </div>

            {/* Tag Header */}
            <div className="border-b-2 border-slate-900 pb-2 mb-3">
              <div className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-wider text-slate-900">
                <Factory className="w-4 h-4" />
                <span>OCTG LOT TRACEABILITY TAG</span>
              </div>
              <div className="text-[10px] text-slate-600 font-sans">
                API Spec 5CT • Heavy Industrial Lot Inwarding Tag
              </div>
            </div>

            {/* Main Barcode Tag */}
            <div className="text-center py-2 bg-slate-100 rounded-lg border border-slate-300 mb-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-sans">LOT / BATCH IDENTIFIER</div>
              <div className="text-base font-black tracking-wider text-slate-900">{pipe.ti_id}</div>
              {/* Simulated Code 128 Barcode Bars */}
              <div className="h-9 flex items-center justify-center space-x-[2px] mt-1 px-4 overflow-hidden">
                {[4, 2, 6, 1, 5, 2, 4, 3, 1, 6, 2, 5, 1, 4, 3, 2, 5, 1, 6, 2, 3, 4, 1, 5, 2, 6, 3, 1, 4].map(
                  (w, i) => (
                    <div
                      key={i}
                      className="bg-slate-950 h-full"
                      style={{ width: `${w * 1.2}px` }}
                    ></div>
                  )
                )}
              </div>
            </div>

            {/* Spec Attributes Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] mb-3 border-b-2 border-slate-900 pb-3">
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">HEAT NUMBER</span>
                <span className="font-bold text-blue-900 text-xs">{heatNo}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">LOT NUMBER</span>
                <span className="font-bold text-slate-900">{lotNo}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">TUBES IN LOT</span>
                <span className="font-bold text-emerald-900 text-xs">{tubeCount} Tubes</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">TOTAL TUBE LENGTH</span>
                <span className="font-bold text-slate-900">{pipe.tube_length_mm} mm</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">STEEL GRADE</span>
                <span className="font-black text-white bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">
                  {grade}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">THREAD CONNECTION</span>
                <span className="font-black text-slate-900">{thread}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">PIPE OD x WT</span>
                <span className="font-bold text-slate-900">{sizeOd} x {wt} mm</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">TARGET PARTING</span>
                <span className="font-bold text-slate-900">{pipe.parting_length_mm} mm</span>
              </div>
            </div>

            {/* Cutting Yield & Scrap Output */}
            <div className="bg-amber-50 p-2.5 rounded border border-amber-300 text-[10px] space-y-1 mb-3">
              <div className="flex justify-between font-bold text-amber-950">
                <span>TOTAL LOT LENGTH:</span>
                <span>{pipe.tube_length_mm} mm</span>
              </div>
              <div className="flex justify-between font-black text-emerald-900">
                <span>PLANNED PARTS:</span>
                <span>{pipe.rounded_qty} PIECES</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>EXPECTED SCRAP:</span>
                <span>{pipe.end_scrap_mm} mm</span>
              </div>
            </div>

            {/* Inspector Verification Footer */}
            <div className="flex items-center justify-between text-[9px] text-slate-600 pt-1">
              <div className="flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>MTC: {mtc}</span>
              </div>
              <span className="font-bold text-slate-800">STATUS: {pipe.pipe_allocation_status}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
