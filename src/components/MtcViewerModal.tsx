'use client';

import React from 'react';
import { X, Printer, ShieldCheck, FileCheck2, Award, Download } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

interface MtcViewerModalProps {
  tallySheet?: any;
  product?: any;
  supplier?: any;
  onClose: () => void;
}

export default function MtcViewerModal({ tallySheet, product, supplier, onClose }: MtcViewerModalProps) {
  const mtcNo = tallySheet?.mill_test_certificate_no || 'MTC-TEN-84920-REV2';
  const heatNo = tallySheet?.heat_no || 'HT-84920';
  const lotNo = tallySheet?.lot_no || 'LOT-2026-A1';
  const inspector = tallySheet?.inspector_name || 'Marcus Vance (Level III NDT)';
  const millName = supplier?.mill_name || 'Dalmine Seamless Tube Mill';
  const supplierName = supplier?.supplier_name || 'Tenaris Global Tubulars Ltd';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Digital Mill Test Certificate (EN 10204 Type 3.1)</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print MTC</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Certificate Body (Clean Paper Design) */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950/40">
          <div className="bg-white text-slate-900 p-8 rounded-xl border border-slate-300 shadow-xl space-y-6 select-none font-sans text-xs">
            {/* Header / Mill Logo */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  {supplierName}
                </h1>
                <div className="text-xs font-semibold text-slate-700">{millName}</div>
                <div className="text-[11px] text-slate-500">Quality Assurance Department • ISO 9001 / API Q1 Certified</div>
              </div>
              <div className="text-right font-mono">
                <div className="text-xs font-bold bg-slate-900 text-white px-2.5 py-1 rounded">
                  CERTIFICATE TYPE: EN 10204 3.1
                </div>
                <div className="text-[11px] text-slate-600 mt-1">Cert No: <span className="font-bold">{mtcNo}</span></div>
                <div className="text-[11px] text-slate-600">Date: {formatDate(tallySheet?.tally_sheet_date || new Date())}</div>
              </div>
            </div>

            {/* Spec & Traceability Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px]">
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">HEAT NUMBER</span>
                <span className="font-bold text-blue-900">{heatNo}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">LOT NUMBER</span>
                <span className="font-bold text-slate-900">{lotNo}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">STEEL GRADE</span>
                <span className="font-black text-slate-900">{product?.grade || 'L80'}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-sans">CONNECTION</span>
                <span className="font-black text-slate-900">{product?.thread_type || 'BTC'}</span>
              </div>
            </div>

            {/* Chemical Analysis Table (% wt) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1 font-mono">
                1. Ladle Chemical Analysis (% wt) - API 5CT Specification
              </h3>
              <div className="overflow-x-auto border border-slate-300 rounded">
                <table className="w-full text-center text-[10px] font-mono">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="py-1.5 px-2">C</th>
                      <th className="py-1.5 px-2">Mn</th>
                      <th className="py-1.5 px-2">P</th>
                      <th className="py-1.5 px-2">S</th>
                      <th className="py-1.5 px-2">Si</th>
                      <th className="py-1.5 px-2">Cr</th>
                      <th className="py-1.5 px-2">Ni</th>
                      <th className="py-1.5 px-2">Mo</th>
                      <th className="py-1.5 px-2">V</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-1.5 px-2">0.26</td>
                      <td className="py-1.5 px-2">1.32</td>
                      <td className="py-1.5 px-2">0.012</td>
                      <td className="py-1.5 px-2">0.003</td>
                      <td className="py-1.5 px-2">0.24</td>
                      <td className="py-1.5 px-2">0.45</td>
                      <td className="py-1.5 px-2">0.18</td>
                      <td className="py-1.5 px-2">0.22</td>
                      <td className="py-1.5 px-2">0.04</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mechanical Test Results */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1 font-mono">
                2. Mechanical Tensile & Impact Properties
              </h3>
              <div className="overflow-x-auto border border-slate-300 rounded">
                <table className="w-full text-center text-[10px] font-mono">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="py-1.5 px-2">Yield Strength (MPa)</th>
                      <th className="py-1.5 px-2">Tensile Strength (MPa)</th>
                      <th className="py-1.5 px-2">Elongation (%)</th>
                      <th className="py-1.5 px-2">Hardness (HRC)</th>
                      <th className="py-1.5 px-2">CVN Impact Avg (-10°C)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-1.5 px-2 font-bold text-slate-900">592 MPa (85.8 ksi)</td>
                      <td className="py-1.5 px-2 font-bold text-slate-900">710 MPa (103.0 ksi)</td>
                      <td className="py-1.5 px-2">23.5%</td>
                      <td className="py-1.5 px-2">21.8 HRC</td>
                      <td className="py-1.5 px-2 font-bold text-emerald-800">48 J (Min Req: 27 J)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* NDT Inspection Statement */}
            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-[10px] space-y-1">
              <div className="font-bold text-slate-800 uppercase font-mono">
                3. Non-Destructive Examination (NDE) & Hydrostatic Testing
              </div>
              <div className="text-slate-600 space-y-0.5">
                <div>• Ultrasonic Testing (Full Body UT): Satisfactory according to API Spec 5CT SR1.</div>
                <div>• Magnetic Particle Inspection (MPI): Wet fluorescent method applied. No defect indications.</div>
                <div>• Hydrostatic Pressure Test: 5,800 PSI held for 10 seconds with zero leakage or pressure drop.</div>
              </div>
            </div>

            {/* Inspector Sign-off */}
            <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-end text-[11px]">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-mono">INSPECTED & CERTIFIED BY:</div>
                <div className="font-bold text-slate-900 mt-0.5">{inspector}</div>
                <div className="text-[10px] text-slate-600">Chief Metallurgical & NDT Inspector</div>
              </div>

              <div className="text-right">
                <div className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-100 text-emerald-900 rounded font-bold border border-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>METALLURGICALLY APPROVED</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
