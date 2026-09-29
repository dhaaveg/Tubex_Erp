'use client';

import React from 'react';
import { X, Printer, Barcode, Factory, Building2, Package, CheckCircle2, ShieldCheck, Edit3 } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

interface MasterDataTagModalProps {
  type: 'supplier' | 'product';
  data: any;
  onClose: () => void;
  onEdit?: () => void;
}

export default function MasterDataTagModal({ type, data, onClose, onEdit }: MasterDataTagModalProps) {
  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  // Grade color scheme helper for OCTG Products
  const getGradeBadge = (grade: string) => {
    const g = String(grade).toUpperCase();
    if (g.includes('J55') || g.includes('K55')) {
      return { bg: 'bg-emerald-600 text-white', border: 'border-emerald-500', name: 'API Group 1' };
    }
    if (g.includes('L80')) {
      return { bg: 'bg-red-700 text-white', border: 'border-red-600', name: 'API Group 2 (Restricted)' };
    }
    if (g.includes('N80')) {
      return { bg: 'bg-amber-600 text-white', border: 'border-amber-500', name: 'API Group 1 (Normalized)' };
    }
    if (g.includes('P110')) {
      return { bg: 'bg-slate-900 text-white ring-2 ring-slate-400', border: 'border-slate-800', name: 'API Group 3 (High Strength)' };
    }
    if (g.includes('Q125')) {
      return { bg: 'bg-orange-600 text-white', border: 'border-orange-500', name: 'API Group 4 (Extreme)' };
    }
    return { bg: 'bg-blue-700 text-white', border: 'border-blue-600', name: 'API Spec 5CT' };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Top Bar */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
            <Barcode className="w-4 h-4 text-amber-400" />
            <span>
              {type === 'supplier'
                ? 'Approved Mill & Supplier Identification Tag (Master Preview)'
                : 'API Spec 5CT Product Specification Tag (Master Preview)'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white text-xs font-medium flex items-center space-x-1.5 transition-colors border border-slate-700"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Record</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Tag</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Physical Industrial Tag Container */}
        <div className="p-6 flex justify-center bg-slate-950/60 overflow-y-auto max-h-[80vh]">
          {type === 'supplier' ? (
            /* ================= SUPPLIER / MILL MASTER TAG ================= */
            <div className="w-full max-w-md bg-white text-slate-900 p-6 rounded-2xl border-4 border-dashed border-amber-500 shadow-2xl relative select-none font-mono">
              {/* Tag Eyelet Hole */}
              <div className="absolute top-4 right-4 w-5 h-5 rounded-full border-2 border-slate-400 bg-slate-200 flex items-center justify-center shadow-inner">
                <div className="w-2 h-2 rounded-full bg-slate-500"></div>
              </div>

              {/* Tag Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-3">
                <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-slate-900">
                  <Factory className="w-4 h-4 text-blue-800" />
                  <span>APPROVED MILL & SUPPLIER MASTER TAG</span>
                </div>
                <div className="text-[10px] text-slate-600 font-sans mt-0.5">
                  ISO 9001 / API Q1 Certified Tubular Supply Source
                </div>
              </div>

              {/* Barcode & Key ID */}
              <div className="text-center py-2.5 bg-slate-100 rounded-xl border border-slate-300 mb-4">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest font-sans font-semibold">
                  MASTER SUPPLIER IDENTIFIER
                </div>
                <div className="text-lg font-black tracking-wider text-blue-900">{data.supplier_id}</div>
                {/* Simulated Barcode */}
                <div className="h-8 flex items-center justify-center space-x-[2px] mt-1.5 px-6 overflow-hidden">
                  {[4, 2, 5, 1, 6, 3, 2, 4, 1, 5, 3, 2, 6, 1, 4, 2, 5, 3, 1, 6, 2, 4, 3, 5, 1, 4, 2, 6, 3, 1].map(
                    (w, i) => (
                      <div key={i} className="bg-slate-950 h-full" style={{ width: `${w * 1.3}px` }}></div>
                    )
                  )}
                </div>
              </div>

              {/* Supplier Legal & Mill Facility Details */}
              <div className="space-y-3 text-xs mb-4 border-b-2 border-slate-900 pb-4">
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-sans font-bold">
                    COMPANY LEGAL ENTITY
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{data.supplier_name}</span>
                </div>

                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  <span className="text-[9px] text-amber-800 block uppercase font-sans font-bold flex items-center gap-1">
                    <Factory className="w-3 h-3 text-amber-700" />
                    MANUFACTURING MILL & PLANT
                  </span>
                  <div className="font-bold text-slate-900">{data.mill_name}</div>
                  <div className="text-[11px] text-slate-600 font-sans mt-0.5">{data.mill_address}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-sans">GST / TAX ID</span>
                    <span className="font-bold text-slate-900">
                      {data.gst_tax_id ? data.gst_tax_id : <span className="text-slate-500 italic">Not Provided / Exempt</span>}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-sans">ONBOARDING DATE</span>
                    <span className="font-bold text-slate-900">
                      {data.supplier_onboarding_date ? formatDate(data.supplier_onboarding_date) : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-sans">CONTACT PERSON</span>
                    <span className="font-bold text-slate-900">{data.contact_person}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-sans">PHONE / EMAIL</span>
                    <div className="text-[10px] text-slate-800 font-sans truncate">{data.telephone_no}</div>
                    <div className="text-[10px] text-blue-700 font-sans truncate">{data.supplier_mail}</div>
                  </div>
                </div>
              </div>

              {/* Tag Footer & Status */}
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span className="text-[10px] font-bold text-slate-700 uppercase font-sans">
                    {data.status === 'Active' ? 'APPROVED ACTIVE SUPPLIER' : 'INACTIVE / DORMANT'}
                  </span>
                </div>
                <div className="font-black text-[11px] px-2 py-0.5 rounded bg-slate-900 text-white font-mono">
                  {data._count?.purchase_orders ?? 0} ACTIVE POs
                </div>
              </div>
            </div>
          ) : (
            /* ================= PRODUCT MASTER SPEC TAG ================= */
            <div className="w-full max-w-md bg-white text-slate-900 p-6 rounded-2xl border-4 border-dashed border-blue-600 shadow-2xl relative select-none font-mono">
              {/* Tag Eyelet Hole */}
              <div className="absolute top-4 right-4 w-5 h-5 rounded-full border-2 border-slate-400 bg-slate-200 flex items-center justify-center shadow-inner">
                <div className="w-2 h-2 rounded-full bg-slate-500"></div>
              </div>

              {/* Tag Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-3">
                <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-slate-900">
                  <Package className="w-4 h-4 text-blue-800" />
                  <span>API SPEC 5CT TUBULAR PRODUCT SPEC TAG</span>
                </div>
                <div className="text-[10px] text-slate-600 font-sans mt-0.5">
                  OCTG Casing & Tubing Master Classification
                </div>
              </div>

              {/* Barcode & Key ID */}
              <div className="text-center py-2.5 bg-slate-100 rounded-xl border border-slate-300 mb-4">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest font-sans font-semibold">
                  CATALOG PRODUCT ID
                </div>
                <div className="text-lg font-black tracking-wider text-blue-900">{data.product_id}</div>
                {/* Simulated Barcode */}
                <div className="h-8 flex items-center justify-center space-x-[2px] mt-1.5 px-6 overflow-hidden">
                  {[2, 5, 1, 6, 2, 4, 3, 1, 5, 2, 6, 3, 4, 1, 5, 2, 6, 3, 1, 4, 2, 5, 3, 6, 1, 2, 4, 5, 3, 1].map(
                    (w, i) => (
                      <div key={i} className="bg-slate-950 h-full" style={{ width: `${w * 1.3}px` }}></div>
                    )
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="mb-3">
                <span className="text-[9px] text-slate-500 block uppercase font-sans font-bold">
                  TECHNICAL DESCRIPTION
                </span>
                <span className="font-bold text-slate-900 text-xs font-sans">{data.product_description}</span>
              </div>

              {/* Spec Matrix Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs mb-4 border-y-2 border-slate-900 py-3">
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-sans">STEEL GRADE</span>
                  {(() => {
                    const badge = getGradeBadge(data.grade);
                    return (
                      <span className={`inline-block px-2 py-0.5 rounded font-black text-xs ${badge.bg}`}>
                        {data.grade}
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-sans">THREAD CONNECTION</span>
                  <span className="font-bold text-indigo-900 text-xs bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block">
                    {data.thread_type}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-sans">OUTER DIAMETER (OD)</span>
                  <span className="font-black text-slate-900 text-sm">
                    {data.size_od} mm
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans block">
                    (~{(data.size_od / 25.4).toFixed(3)} in)
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-sans">WALL THICKNESS (WT)</span>
                  <span className="font-black text-slate-900 text-sm">
                    {data.wall_thickness} mm
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans block">
                    (~{(data.wall_thickness / 25.4).toFixed(3)} in)
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-sans">CVN IMPACT CRITERIA</span>
                  <span className="font-bold text-slate-900 text-[11px]">{data.cvn_requirement}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-sans">NOMINAL WEIGHT</span>
                  <span className="font-black text-emerald-800 text-xs">
                    {data.nominal_weight_kg_m} {data.uom || 'kg/m'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans block">
                    (~{(data.nominal_weight_kg_m * 0.67197).toFixed(2)} lb/ft)
                  </span>
                </div>
              </div>

              {/* Tag Footer & Status */}
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-700" />
                  <span className="text-[10px] font-bold text-slate-700 uppercase font-sans">
                    OFFICIAL API SPEC 5CT STANDARD
                  </span>
                </div>
                <div className="font-black text-[11px] px-2 py-0.5 rounded bg-blue-900 text-white font-mono">
                  {data._count?.po_items ?? 0} POs Linked
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
