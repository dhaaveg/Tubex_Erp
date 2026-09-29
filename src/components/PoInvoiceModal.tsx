'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Printer, 
  FileText, 
  Building2, 
  Calendar, 
  DollarSign, 
  ShieldCheck,
  Pencil,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { DEFAULT_QUALITY_STIPULATIONS } from '@/lib/types';
import {
  COMPANY_LOGO_DATA_URI,
  COMPANY_NAME,
  COMPANY_GSTIN,
  COMPANY_CIN,
  COMPANY_IEC,
  COMPANY_PLANT_ADDRESS,
} from '@/lib/companyLogo';

interface PoInvoiceModalProps {
  po: any;
  onClose: () => void;
}

export default function PoInvoiceModal({ po, onClose }: PoInvoiceModalProps) {
  const [mounted, setMounted] = useState(false);
  const [stipulations, setStipulations] = useState<string>(
    po?.quality_stipulations || DEFAULT_QUALITY_STIPULATIONS
  );
  const [isEditingStipulations, setIsEditingStipulations] = useState(false);
  const [isSavingStipulations, setIsSavingStipulations] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('has-po-invoice-open');

    // Intercept browser Ctrl+P / Cmd+P to invoke high-fidelity print
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('has-po-invoice-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [po]);

  if (!po) return null;

  const totalPOValue = po.po_items?.reduce(
    (sum: number, item: any) => sum + (item.line_total || ((item.ordered_qty_mt || 0) * (item.unit_rate || 0))),
    0
  ) || 0;
  const advanceAmount = po.advance_amount || 0;
  const remainingBalance = Math.max(0, totalPOValue - advanceAmount);

  const totalMeters = po.po_items?.reduce((s: number, i: any) => s + (i.ordered_qty || 0), 0) || 0;
  const totalWeightMt = po.po_items?.reduce((s: number, i: any) => s + (i.ordered_qty_mt || 0), 0) || 0;

  const handlePrint = () => {
    const printElement = document.getElementById('po-invoice-printable-document');
    if (!printElement) {
      window.print();
      return;
    }

    // Remove any previous print iframes
    const oldIframe = document.getElementById('po-invoice-print-frame');
    if (oldIframe) {
      oldIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'po-invoice-print-frame';
    iframe.name = 'po_invoice_print_frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const pri = iframe.contentWindow;
    if (!pri) return;

    // Collect all stylesheets and style tags
    let stylesHtml = '';
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      stylesHtml += node.outerHTML;
    });

    pri.document.open();
    pri.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>PO_Invoice_${po.po_no}</title>
          ${stylesHtml}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
              box-sizing: border-box;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
              font-size: 11px;
              line-height: 1.4;
            }
            #po-invoice-printable-document {
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              background-color: #ffffff !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .avoid-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            /* Explicit fallback styling to guarantee exact rendering */
            .bg-white { background-color: #ffffff !important; }
            .bg-slate-50 { background-color: #f8fafc !important; }
            .bg-slate-100 { background-color: #f1f5f9 !important; }
            .bg-slate-900 { background-color: #0f172a !important; }
            .text-white { color: #ffffff !important; }
            .text-slate-900 { color: #0f172a !important; }
            .text-slate-800 { color: #1e293b !important; }
            .text-slate-700 { color: #334155 !important; }
            .text-slate-600 { color: #475569 !important; }
            .text-slate-500 { color: #64748b !important; }
            .text-blue-900 { color: #1e3a8a !important; }
            .text-blue-800 { color: #1e40af !important; }
            .text-blue-700 { color: #1d4ed8 !important; }
            .text-emerald-700 { color: #047857 !important; }
            .text-emerald-900 { color: #064e3b !important; }
            .border-slate-900 { border-color: #0f172a !important; }
            .border-slate-300 { border-color: #cbd5e1 !important; }
            .border-slate-200 { border-color: #e2e8f0 !important; }
            .border-slate-400 { border-color: #94a3b8 !important; }
            .border-emerald-300 { border-color: #6ee7b7 !important; }
            .bg-emerald-100 { background-color: #d1fae5 !important; }
            img { max-height: 60px !important; width: auto !important; object-fit: contain !important; }
          </style>
        </head>
        <body>
          ${printElement.outerHTML}
        </body>
      </html>
    `);
    pri.document.close();

    setTimeout(() => {
      pri.focus();
      pri.print();
      setTimeout(() => {
        try {
          iframe.remove();
        } catch (e) {}
      }, 2500);
    }, 350);
  };

  const handleSaveStipulations = async () => {
    setIsSavingStipulations(true);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...po,
          items: po.po_items?.map((item: any) => ({
            po_item_id: item.po_item_id,
            product_id: item.product_id,
            size_od: item.product?.size_od || item.size_od,
            grade: item.product?.grade || item.grade,
            wall_thickness: item.product?.wall_thickness || item.wall_thickness,
            schedule: item.schedule,
            cvn_requirement: item.product?.cvn_requirement || item.cvn_requirement,
            ordered_qty: Number(item.ordered_qty || 0),
            ordered_qty_mt: Number(item.ordered_qty_mt || 0),
            unit_rate: Number(item.unit_rate || 0),
            tolerable_variance_pct: Number(item.tolerable_variance_pct || 5),
          })),
          quality_stipulations: stipulations,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        setIsEditingStipulations(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingStipulations(false);
    }
  };

  const modalContent = (
    <div 
      id="po-invoice-modal-portal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white print:static"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none print:bg-white">
        
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 print-hidden-bar print:hidden">
          <div className="flex items-center space-x-3">
            <div className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center space-x-1.5 shadow">
              <FileText className="w-3.5 h-3.5" />
              <span>PO Invoice Document</span>
            </div>

            <span className="text-xs font-mono text-slate-400">
              PO: <strong className="text-blue-400">{po.po_no}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center space-x-1.5 shadow transition-colors"
              title="Print to Paper or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* COMMERCIAL INVOICE DOCUMENT VIEW */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-950/40 print:p-0 print:bg-white print:overflow-visible">
          {/* Printable Invoice Page */}
          <div 
            id="po-invoice-printable-document"
            className="bg-white text-slate-900 rounded-xl p-6 sm:p-8 shadow-xl font-sans print:shadow-none print:p-0 print:rounded-none"
          >
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row print:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-slate-900">
                <div className="flex items-start space-x-4">
                  <img 
                    src={COMPANY_LOGO_DATA_URI} 
                    alt={COMPANY_NAME} 
                    className="h-16 w-auto max-h-16 max-w-[220px] object-contain shrink-0" 
                  />
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase leading-snug">
                      {COMPANY_NAME}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5 font-mono">
                      {COMPANY_PLANT_ADDRESS}
                    </p>
                    <p className="text-[11px] text-slate-700 font-mono mt-1">
                      GSTIN: <strong className="text-slate-900">{COMPANY_GSTIN}</strong> • CIN: <strong className="text-slate-900">{COMPANY_CIN}</strong> • IEC No.: <strong className="text-slate-900">{COMPANY_IEC}</strong>
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right print:text-right">
                  <span className="text-xs uppercase font-bold tracking-widest px-3 py-1 rounded bg-slate-100 border border-slate-300 text-slate-800 whitespace-nowrap inline-block">
                    Purchase Order
                  </span>
                  <div className="mt-2 font-mono flex items-baseline sm:justify-end print:justify-end space-x-2">
                    <span className="text-xs text-slate-500 font-semibold">PO Number:</span>
                    <span className="text-lg font-black text-blue-900">{po.po_no}</span>
                  </div>
                  <div className="text-xs text-slate-600 font-mono mt-0.5">
                    Date: {po.po_date ? formatDate(po.po_date) : formatDate(new Date())}
                  </div>
                </div>
              </div>

              {/* Parties Section: Supplier & Delivery Destination */}
              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-6 py-5 border-b border-slate-200 text-xs">
                {/* Supplier / Mill Card */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Vendor / Mill Contractor
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">{po.supplier?.supplier_name || 'Mill Supplier'}</h4>
                  <p className="text-slate-700 font-semibold">{po.supplier?.mill_name || 'Designated Tube Mill'}</p>
                  <p className="text-slate-600">{po.supplier?.mill_address || po.supplier?.supplier_address}</p>
                  <div className="pt-2 text-[11px] text-slate-600 font-mono space-y-0.5">
                    <div>GST / Tax ID: <strong className="text-slate-900">{po.supplier?.gst_tax_id || 'N/A'}</strong></div>
                    <div>Contact: {po.supplier?.contact_person} ({po.supplier?.telephone_no})</div>
                    <div>Email: <span className="text-blue-700">{po.supplier?.supplier_mail}</span></div>
                  </div>
                </div>

                {/* Shipping & Commercial Terms */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Ship-To & Commercial Protocol
                  </span>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Inwarding Dock Address:</span>
                    <p className="text-slate-800 font-medium">{po.shipping_address || 'Plot No: G-60/1, M.I.D.C. Area, Ahmednagar - 414 111, Maharashtra, India.'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Delivery Due Date:</span>
                      <strong className="text-slate-900">
                        {po.delivery_date ? formatDate(po.delivery_date) : 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Delivery Terms:</span>
                      <strong className="text-slate-900">{po.delivery_terms || 'FOB Mill Yard'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Payment Terms:</span>
                      <span className="font-semibold text-slate-800">{po.payment_terms || '30% Advance, Net 60 Days'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">PO Status:</span>
                      <span className="font-bold text-blue-800 uppercase">{po.po_status || 'Draft'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contract Line Items Table */}
              <div className="py-5">
                <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 font-mono">
                  Contract Tubular Items ({po.po_items?.length || 0})
                </h5>
                <div className="overflow-x-auto border border-slate-300 rounded-lg print:overflow-visible">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-mono text-[11px] border-b border-slate-300">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Line ID</th>
                        <th className="p-2.5">Product Description</th>
                        <th className="p-2.5">Technical Specs (OD • WT • Grade • CVN)</th>
                        <th className="p-2.5 text-right">Ordered MT</th>
                        <th className="p-2.5 text-right">Rate ($)</th>
                        <th className="p-2.5 text-right">Total ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      {po.po_items?.map((item: any, idx: number) => {
                        const lineTot = item.line_total || ((item.ordered_qty_mt || 0) * (item.unit_rate || 0));
                        const prd = item.product || {};
                        const sizeOd = prd.size_od || item.size_od;
                        const wt = prd.wall_thickness || item.wall_thickness;
                        const grade = prd.grade || item.grade;
                        const cvn = prd.cvn_requirement || item.cvn_requirement || 'API 5CT Standard';

                        return (
                          <tr key={item.po_item_id || idx} className="hover:bg-slate-50 avoid-break print:break-inside-avoid">
                            <td className="p-2.5 text-slate-500">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-blue-900">{item.po_item_id}</td>
                            <td className="p-2.5 font-sans font-medium text-slate-800">
                              {prd.product_description || `${sizeOd}mm OD x ${wt}mm WT Grade ${grade} Pipe`}
                            </td>
                            <td className="p-2.5 text-slate-700">
                              <div><strong>{sizeOd}mm OD</strong> • {wt}mm WT • <strong>Grade {grade}</strong></div>
                              <div className="text-[10px] text-slate-500 font-sans">CVN: {cvn}</div>
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-900">{item.ordered_qty_mt?.toFixed(3)} MT</td>
                            <td className="p-2.5 text-right text-slate-700">${item.unit_rate}</td>
                            <td className="p-2.5 text-right font-bold text-slate-900">${lineTot.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Financial Breakdown */}
              <div className="flex flex-col sm:flex-row print:flex-row justify-between items-start gap-4 pt-3 pb-6 border-b border-slate-200 avoid-break">
                <div className="text-xs text-slate-600 font-mono space-y-1">
                  <div>Total Weight: <strong className="text-slate-900">{totalWeightMt.toFixed(3)} Metric Tonnes</strong></div>
                  <div>Allowable Mill Variance: <strong>±5%</strong> of ordered tonnage</div>
                </div>

                <div className="w-full sm:w-72 print:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Total PO Contract Value:</span>
                    <strong className="text-slate-900 text-sm">${totalPOValue.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between text-blue-800">
                    <span>Advance Amount Paid:</span>
                    <strong className="font-bold">-${advanceAmount.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-300 text-slate-900 font-bold text-sm">
                    <span>Remaining Balance:</span>
                    <span className="text-emerald-700 text-base">${remainingBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Quality Clauses & Authorized Signatures */}
              <div className="pt-5 space-y-6 avoid-break">
                <div className="text-[10px] text-slate-600 space-y-1.5 font-mono bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/90 mb-1">
                    <div className="font-bold text-slate-800 uppercase flex items-center space-x-2">
                      <span>Quality & Receiving Stipulations:</span>
                      {saveSuccess && (
                        <span className="text-[9px] font-sans font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                          Saved to PO!
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 print:hidden">
                      {isEditingStipulations ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setStipulations(DEFAULT_QUALITY_STIPULATIONS)}
                            className="text-[10px] text-slate-500 hover:text-slate-800 font-sans underline"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveStipulations}
                            disabled={isSavingStipulations}
                            className="px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-sans font-semibold text-[10px] shadow-sm transition-colors"
                          >
                            {isSavingStipulations ? 'Saving...' : 'Save & Done'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingStipulations(false)}
                            className="text-[10px] text-slate-500 hover:text-slate-800 font-sans"
                          >
                            Preview Only
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsEditingStipulations(true)}
                          className="text-[10px] text-blue-700 hover:text-blue-900 font-sans font-semibold flex items-center space-x-1 hover:underline bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit Stipulations</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditingStipulations ? (
                    <div className="space-y-1.5 print:hidden mb-2">
                      <textarea
                        rows={4}
                        value={stipulations}
                        onChange={(e) => setStipulations(e.target.value)}
                        placeholder="Enter quality, MTC 3.1, CVN, weighbridge tolerance, and receiving inspection stipulations..."
                        className="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 text-[10px] font-mono focus:border-blue-600 focus:outline-none leading-relaxed shadow-inner"
                      />
                      <div className="flex justify-between items-center text-[9px] text-slate-500 font-sans">
                        <span>Tip: Edit lines as required. Click <strong>"Save & Done"</strong> to save to the PO database, or print directly.</span>
                      </div>
                    </div>
                  ) : null}

                  {/* Rendered Clauses (Visible both in View and Print/PDF) */}
                  <div className={`space-y-1 ${isEditingStipulations ? 'hidden print:block' : 'block'}`}>
                    {stipulations
                      ? stipulations
                          .split('\n')
                          .filter((l) => l.trim().length > 0)
                          .map((clause, idx) => (
                            <p key={idx} className="leading-relaxed">
                              {clause}
                            </p>
                          ))
                      : (
                        <p className="italic text-slate-400">Standard API 5CT and MTC 3.1 compliance required.</p>
                      )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-6 pt-4 text-center text-xs">
                  <div>
                    <div className="h-12 border-b border-slate-400 flex items-end justify-center pb-1 font-mono text-[10px] text-slate-500">
                      System Generated (Verified)
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 block mt-1">Prepared By (Procurement)</span>
                  </div>
                  <div>
                    <div className="h-12 border-b border-slate-400 flex items-end justify-center pb-1">
                      <ShieldCheck className="w-6 h-6 text-emerald-700 mx-auto" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 block mt-1">QA & Metallurgy Seal</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1 print:col-span-1">
                    <div className="h-12 border-b border-slate-400 flex items-end justify-center pb-1 font-mono text-[10px] text-slate-400">
                      Signature & Company Stamp
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 block mt-1">Authorized Buyer Signatory</span>
                  </div>
                </div>

                {/* Print Verification & Timestamp Footer */}
                <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                  <span>{COMPANY_NAME} • PO #{po.po_no} • GSTIN: {COMPANY_GSTIN} • CIN: {COMPANY_CIN} • IEC: {COMPANY_IEC}</span>
                  <span>Generated: {formatDateTime(new Date())}</span>
                </div>
              </div>

            </div>
          </div>

      </div>
    </div>
  );

  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}

