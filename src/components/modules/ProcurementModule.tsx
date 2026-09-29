'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Calendar, 
  Building2, 
  DollarSign, 
  ChevronDown, 
  ChevronRight, 
  X, 
  AlertCircle,
  Clock,
  CheckCircle,
  FileText,
  Pencil,
  Lock,
  Printer
} from 'lucide-react';
import PoInvoiceModal from '@/components/PoInvoiceModal';
import { formatDate } from '@/lib/formatters';
import { DEFAULT_QUALITY_STIPULATIONS } from '@/lib/types';

export default function ProcurementModule() {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [expandedPo, setExpandedPo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedInvoicePo, setSelectedInvoicePo] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [poNo, setPoNo] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [shippingAddress, setShippingAddress] = useState('Dock 4, Tubular Inwarding Yard, Precision Hub');
  const [deliveryDate, setDeliveryDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [paymentTerms, setPaymentTerms] = useState('30% Advance, Net 60 Days');
  const [deliveryTerms, setDeliveryTerms] = useState('FOB Mill Yard');
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [qualityStipulations, setQualityStipulations] = useState<string>(DEFAULT_QUALITY_STIPULATIONS);
  const [poStatus, setPoStatus] = useState<'Draft' | 'Approved' | 'Open' | 'Closed'>('Draft');

  // Helper: Nominal weight formula: (OD - WT) * WT * 0.0246615
  const calcNominalWeight = (od: number, wt: number) => {
    if (!od || !wt || od <= wt) return 30;
    return Number(((od - wt) * wt * 0.0246615).toFixed(2));
  };

  const calcEstMt = (meters: number, od: number, wt: number) => {
    const nomWeight = calcNominalWeight(od, wt);
    return Number(((meters * nomWeight) / 1000).toFixed(3));
  };

  // Dynamic PO Items Lines asking for Size, Grade, Wall Thickness/Schedule, CVN
  interface POItemRow {
    po_item_id?: string;
    product_id: string;
    size_od: number;
    grade: string;
    wall_thickness: number;
    schedule?: string;
    cvn_requirement: string;
    ordered_qty: number;
    ordered_qty_mt: number;
    unit_rate: number;
    tolerable_variance_pct: number;
  }

  const [items, setItems] = useState<POItemRow[]>([
    {
      product_id: '',
      size_od: 177.8,
      grade: 'L80',
      wall_thickness: 10.36,
      schedule: 'Sch 80',
      cvn_requirement: '27J Min Avg @ -10°C',
      ordered_qty: 1000,
      ordered_qty_mt: 43.15,
      unit_rate: 45,
      tolerable_variance_pct: 5,
    },
  ]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [poRes, supRes, prdRes] = await Promise.all([
        fetch('/api/purchase-orders'),
        fetch('/api/suppliers?status=Active'),
        fetch('/api/products'),
      ]);
      const [pos, sups, prds] = await Promise.all([
        poRes.json(),
        supRes.json(),
        prdRes.json(),
      ]);
      if (Array.isArray(pos)) setPurchaseOrders(pos);
      if (Array.isArray(sups)) {
        setSuppliers(sups);
        if (sups.length > 0 && !supplierId) setSupplierId(sups[0].supplier_id);
      }
      if (Array.isArray(prds)) {
        setProducts(prds);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setIsEditMode(false);
    setFormError(null);
    setPoNo(`PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(3, '0')}`);
    setPoDate(new Date().toISOString().split('T')[0]);
    setSupplierId(suppliers[0]?.supplier_id || '');
    setShippingAddress('Dock 4, Tubular Inwarding Yard, Precision Hub');
    setDeliveryDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setPaymentTerms('30% Advance, Net 60 Days');
    setDeliveryTerms('FOB Mill Yard');
    setAdvanceAmount(0);
    setQualityStipulations(DEFAULT_QUALITY_STIPULATIONS);
    setPoStatus('Draft');

    setItems([
      {
        product_id: '',
        size_od: 177.8,
        grade: 'L80',
        wall_thickness: 10.36,
        schedule: 'Sch 80',
        cvn_requirement: '27J Min Avg @ -10°C',
        ordered_qty: 1000,
        ordered_qty_mt: calcEstMt(1000, 177.8, 10.36),
        unit_rate: 45,
        tolerable_variance_pct: 5,
      },
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (po: any) => {
    setIsEditMode(true);
    setFormError(null);
    setPoNo(po.po_no);
    setPoDate(po.po_date ? new Date(po.po_date).toISOString().split('T')[0] : '');
    setSupplierId(po.supplier_id);
    setShippingAddress(po.shipping_address || '');
    setDeliveryDate(po.delivery_date ? new Date(po.delivery_date).toISOString().split('T')[0] : '');
    setPaymentTerms(po.payment_terms || '');
    setDeliveryTerms(po.delivery_terms || 'FOB Mill Yard');
    setAdvanceAmount(po.advance_amount || 0);
    setQualityStipulations(po.quality_stipulations || DEFAULT_QUALITY_STIPULATIONS);
    setPoStatus(po.po_status || 'Draft');

    setItems(
      po.po_items && po.po_items.length > 0
        ? po.po_items.map((item: any) => {
            const prd = item.product || products.find((p) => p.product_id === item.product_id);
            const od = item.size_od || prd?.size_od || 177.8;
            const wt = item.wall_thickness || prd?.wall_thickness || 10.36;
            return {
              po_item_id: item.po_item_id,
              product_id: item.product_id || '',
              size_od: od,
              grade: item.grade || prd?.grade || 'L80',
              wall_thickness: wt,
              schedule: wt <= 7 ? 'Sch 40' : wt <= 10 ? 'Sch 80' : 'Sch 120',
              cvn_requirement: item.cvn_requirement || prd?.cvn_requirement || '27J Min Avg @ -10°C',
              ordered_qty: item.ordered_qty,
              ordered_qty_mt: item.ordered_qty_mt || calcEstMt(item.ordered_qty, od, wt),
              unit_rate: item.unit_rate,
              tolerable_variance_pct: item.tolerable_variance_pct ?? 5,
            };
          })
        : [
            {
              product_id: '',
              size_od: 177.8,
              grade: 'L80',
              wall_thickness: 10.36,
              schedule: 'Sch 80',
              cvn_requirement: '27J Min Avg @ -10°C',
              ordered_qty: 1000,
              ordered_qty_mt: 43.15,
              unit_rate: 45,
              tolerable_variance_pct: 5,
            },
          ]
    );
    setIsModalOpen(true);
  };

  const handleDeletePO = async (targetPoNo: string) => {
    if (!confirm(`Are you sure you want to delete Purchase Order ${targetPoNo}? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/purchase-orders?po_no=${encodeURIComponent(targetPoNo)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete PO');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        product_id: '',
        size_od: 177.8,
        grade: 'L80',
        wall_thickness: 10.36,
        schedule: 'Sch 80',
        cvn_requirement: '27J Min Avg @ -10°C',
        ordered_qty: 500,
        ordered_qty_mt: calcEstMt(500, 177.8, 10.36),
        unit_rate: 50,
        tolerable_variance_pct: 5,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemSpecChange = (index: number, field: keyof POItemRow, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    // If size_od or wall_thickness changed, recalculate MT
    if (field === 'size_od' || field === 'wall_thickness') {
      const od = field === 'size_od' ? Number(value) : item.size_od;
      const wt = field === 'wall_thickness' ? Number(value) : item.wall_thickness;
      if (od > 0 && wt > 0) {
        item.ordered_qty_mt = calcEstMt(item.ordered_qty || 0, od, wt);
      }
    }

    // Explicit manual specification - do not auto-bind catalog preset
    item.product_id = '';

    newItems[index] = item;
    setItems(newItems);
  };

  const handleItemOrderQtyChange = (index: number, qty: number) => {
    const newItems = [...items];
    const item = { ...newItems[index] };
    item.ordered_qty = qty;
    item.ordered_qty_mt = calcEstMt(qty, item.size_od, item.wall_thickness);
    newItems[index] = item;
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof POItemRow, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  // Compute live PO values (Line Total = Ordered MT * Rate)
  const totalPOValue = items.reduce(
    (sum, item) => sum + (item.ordered_qty_mt || 0) * (item.unit_rate || 0),
    0
  );
  const remainingAmount = Math.max(0, totalPOValue - advanceAmount);

  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const payload = {
        po_no: poNo,
        po_date: poDate,
        supplier_id: supplierId,
        shipping_address: shippingAddress,
        delivery_date: deliveryDate,
        payment_terms: paymentTerms,
        delivery_terms: deliveryTerms,
        quality_stipulations: qualityStipulations,
        advance_amount: Number(advanceAmount),
        po_status: poStatus,
        items: items.map((item) => ({
          po_item_id: item.po_item_id,
          product_id: item.product_id || undefined,
          size_od: Number(item.size_od),
          grade: item.grade,
          wall_thickness: Number(item.wall_thickness),
          schedule: item.schedule,
          cvn_requirement: item.cvn_requirement,
          ordered_qty: Number(item.ordered_qty),
          ordered_qty_mt: Number(item.ordered_qty_mt),
          unit_rate: Number(item.unit_rate),
          tolerable_variance_pct: Number(item.tolerable_variance_pct || 5),
        })),
      };

      const res = await fetch('/api/purchase-orders', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} PO`);

      setIsModalOpen(false);
      setPoNo('');
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Procurement & Purchase Orders</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage multi-line tubular purchase contracts, supplier advances, and line item fulfillment status.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {/* PO List */}
      <div className="space-y-3">
        {purchaseOrders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
            {isLoading ? 'Loading purchase orders...' : 'No purchase orders recorded yet.'}
          </div>
        ) : (
          purchaseOrders.map((po) => {
            const isExpanded = expandedPo === po.po_no;
            const totalVal = po.po_items?.reduce((sum: number, item: any) => sum + item.line_total, 0) || 0;
            const hasGrns = po.grns && po.grns.length > 0;
            return (
              <div
                key={po.po_no}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all"
              >
                {/* Header Summary Row */}
                <div
                  onClick={() => setExpandedPo(isExpanded ? null : po.po_no)}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer hover:bg-slate-850/60 transition-colors select-none"
                >
                  <div className="flex items-center space-x-3">
                    <button className="text-slate-400 hover:text-white">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-400" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-sm text-blue-400">{po.po_no}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            po.po_status === 'Open'
                              ? 'bg-blue-950 border border-blue-800 text-blue-300'
                              : po.po_status === 'Approved'
                              ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                              : po.po_status === 'Closed'
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-amber-950 border border-amber-800 text-amber-300'
                          }`}
                        >
                          {po.po_status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-300 font-medium">{po.supplier?.supplier_name}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400">{po.supplier?.mill_name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Item Stats & Actions */}
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                    <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">TOTAL VALUE</span>
                      <span className="text-emerald-400 font-bold">${totalVal.toLocaleString()}</span>
                    </div>
                    <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">ADVANCE PAID</span>
                      <span className="text-blue-400">${po.advance_amount?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">REMAINING BAL</span>
                      <span className="text-amber-400">${po.remaining_amount?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="text-slate-400 text-[11px] hidden xl:flex flex-col text-right font-mono">
                      <span>Due: <strong className="text-slate-200">{formatDate(po.delivery_date)}</strong></span>
                      <span className="text-[10px] text-slate-500 font-sans">{po.delivery_terms || 'FOB Mill Yard'}</span>
                    </div>

                    {/* Action Buttons: Print/PDF, Edit & Delete */}
                    <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInvoicePo(po);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-800/80 text-emerald-300 hover:text-white border border-emerald-700/50 text-xs font-sans font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                        title="Print or Save Commercial PO Invoice as PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print / PDF</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(po);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 text-xs font-sans font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                        title="Edit Purchase Order & Lines"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit PO</span>
                      </button>

                      {!hasGrns && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePO(po.po_no);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                          title="Delete Purchase Order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Nested Line Items */}
                {isExpanded && (
                  <div className="bg-slate-950/70 border-t border-slate-800/80 p-4">
                    <div className="text-xs font-mono font-semibold text-slate-400 uppercase mb-2 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span>PO Line Items ({po.po_items?.length || 0})</span>
                        <span className="text-slate-500 text-[11px] font-sans">Date: {formatDate(po.po_date)}</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-slate-500 text-[11px] font-sans">Pay Terms: {po.payment_terms}</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-slate-500 text-[11px] font-sans">Delivery Terms: {po.delivery_terms || 'FOB Mill Yard'}</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-slate-500 text-[11px] font-sans">Due: {formatDate(po.delivery_date)}</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setSelectedInvoicePo(po)}
                          className="text-xs font-sans text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 hover:underline"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Print / PDF Invoice</span>
                        </button>
                        <span className="text-slate-700">•</span>
                        <button
                          onClick={() => handleOpenEdit(po)}
                          className="text-xs font-sans text-blue-400 hover:text-blue-300 flex items-center space-x-1 underline"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit Header & Line Items</span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 font-mono text-[11px]">
                          <tr>
                            <th className="px-3 py-2">Line ID</th>
                            <th className="px-3 py-2">Product Description</th>
                            <th className="px-3 py-2">Spec (OD / WT / Grade / CVN)</th>
                            <th className="px-3 py-2">Ordered MT</th>
                            <th className="px-3 py-2">Rate ($)</th>
                            <th className="px-3 py-2">Line Total ($)</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {po.po_items?.map((item: any) => (
                            <tr key={item.po_item_id} className="hover:bg-slate-900/40">
                              <td className="px-3 py-2 text-blue-400">{item.po_item_id}</td>
                              <td className="px-3 py-2 font-sans font-medium text-slate-200">
                                {item.product?.product_description}
                              </td>
                              <td className="px-3 py-2 text-slate-400">
                                <div className="text-slate-200 font-medium">
                                  {item.product?.size_od}mm OD • {item.product?.wall_thickness}mm WT • Grade {item.product?.grade}
                                </div>
                                <div className="text-[10px] text-slate-500 font-sans">
                                  CVN: {item.product?.cvn_requirement || 'API 5CT Standard'}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-slate-300 font-bold">{item.ordered_qty_mt} MT</td>
                              <td className="px-3 py-2 text-slate-300">${item.unit_rate}</td>
                              <td className="px-3 py-2 text-emerald-400 font-bold">${item.line_total?.toLocaleString()}</td>
                              <td className="px-3 py-2 font-sans">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                    item.line_status === 'Fulfilled'
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                      : item.line_status === 'Partially Received'
                                      ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                                  }`}
                                >
                                  {item.line_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Purchase Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>{isEditMode ? 'Edit Purchase Order Contract' : 'Create Purchase Order Contract'}</span>
                  {isEditMode && (
                    <span className="px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300 text-[10px] font-mono">
                      {poNo}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isEditMode
                    ? 'Modify contract header, delivery terms, advance amount, and line item specifications'
                    : 'Configure header terms and dynamic multi-row line items'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPO} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    PO Number {isEditMode && <span className="text-[10px] text-amber-400 font-mono">(Key ID)</span>}
                  </label>
                  {isEditMode ? (
                    <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 font-mono">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-bold text-blue-400">{poNo}</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={poNo}
                      onChange={(e) => setPoNo(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:border-blue-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">PO Date</label>
                  <input
                    type="date"
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Supplier Master</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                  >
                    {suppliers.map((s) => (
                      <option key={s.supplier_id} value={s.supplier_id}>
                        {s.supplier_name} ({s.mill_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Delivery Due Date</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Delivery Terms</label>
                  <input
                    type="text"
                    list="po-delivery-terms-list"
                    value={deliveryTerms}
                    onChange={(e) => setDeliveryTerms(e.target.value)}
                    placeholder="e.g. FOB Mill Yard, CIF, DDP"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                  />
                  <datalist id="po-delivery-terms-list">
                    <option value="FOB Mill Yard" />
                    <option value="FOB Shipping Port" />
                    <option value="CIF Destination Port" />
                    <option value="DDP Plant Receiving Yard" />
                    <option value="Ex-Works (EXW)" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">Shipping & Receiving Address</label>
                  <input
                    type="text"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">PO Status</label>
                  <select
                    value={poStatus}
                    onChange={(e) => setPoStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500 font-medium"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Approved">Approved</option>
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Line Items: Asked as Size, Grade, Wall Thickness/Schedule, CVN */}
              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Nested PO Items ({items.length})
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Specify products by Size (OD), Steel Grade, Wall Thickness / Schedule, and CVN impact criteria
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1.5 rounded-lg bg-blue-900/70 hover:bg-blue-800 text-blue-200 text-xs font-semibold flex items-center space-x-1.5 border border-blue-700 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item Line</span>
                  </button>
                </div>

                <div className="space-y-3.5">
                  {items.map((item, idx) => {
                    const lineTot = (item.ordered_qty_mt || 0) * (item.unit_rate || 0);
                    const nomWt = calcNominalWeight(item.size_od, item.wall_thickness);

                    return (
                      <div
                        key={idx}
                        className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 relative hover:border-slate-700 transition-colors shadow-inner"
                      >
                        {/* Line Card Header Bar */}
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80 text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800 text-[11px]">
                              Line #{idx + 1} {item.po_item_id ? `(${item.po_item_id})` : ''}
                            </span>
                            <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-mono">
                              {item.size_od || 0}mm OD • {item.grade || 'L80'} • {item.wall_thickness || 0}mm WT
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length === 1}
                            className={`p-1.5 rounded transition-colors ${
                              items.length === 1
                                ? 'text-slate-600 cursor-not-allowed'
                                : 'text-rose-400 hover:bg-rose-950 hover:text-rose-300'
                            }`}
                            title="Remove Line Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Product Technical Specifications: Size, Grade, Wall Thickness/Schedule, CVN */}
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                            <span>Product Technical Specifications</span>
                            <span className="text-[9px] text-slate-500 font-normal">
                              Nominal Weight: <strong className="text-blue-400 font-mono">{nomWt} kg/m</strong>
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                            {/* 1. Size (OD) */}
                            <div>
                              <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                                1. Size / OD (mm)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={item.size_od || ''}
                                onChange={(e) => handleItemSpecChange(idx, 'size_od', parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono font-bold text-xs focus:border-blue-500"
                                placeholder="e.g. 177.8"
                              />
                              {/* Quick Size Chips */}
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {[
                                  { label: '3-1/2" (88.9)', val: 88.9 },
                                  { label: '5-1/2" (139.7)', val: 139.7 },
                                  { label: '7" (177.8)', val: 177.8 },
                                  { label: '9-5/8" (244.5)', val: 244.48 },
                                ].map((s) => (
                                  <button
                                    key={s.label}
                                    type="button"
                                    onClick={() => handleItemSpecChange(idx, 'size_od', s.val)}
                                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                                      Math.abs((item.size_od || 0) - s.val) < 0.1
                                        ? 'bg-blue-900 text-blue-200 border-blue-600 font-bold'
                                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                                    }`}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 2. Steel Grade */}
                            <div>
                              <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                                2. Steel Grade
                              </label>
                              <select
                                value={item.grade || 'L80'}
                                onChange={(e) => handleItemSpecChange(idx, 'grade', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono font-bold text-xs focus:border-blue-500"
                              >
                                <option value="J55">J55 (API 5CT)</option>
                                <option value="K55">K55 (API 5CT)</option>
                                <option value="L80">L80 (Sour Service / 80 ksi)</option>
                                <option value="N80">N80 (API 5CT)</option>
                                <option value="P110">P110 (Deep Wells / 110 ksi)</option>
                                <option value="Q125">Q125 (High Strength / 125 ksi)</option>
                              </select>
                              {/* Quick Grade Chips */}
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {['J55', 'L80', 'P110'].map((g) => (
                                  <button
                                    key={g}
                                    type="button"
                                    onClick={() => handleItemSpecChange(idx, 'grade', g)}
                                    className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
                                      item.grade === g
                                        ? 'bg-blue-900 text-blue-200 border-blue-600 font-bold'
                                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                                    }`}
                                  >
                                    {g}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 3. Wall Thickness / Schedule */}
                            <div>
                              <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                                3. Wall Thickness / Schedule (mm)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={item.wall_thickness || ''}
                                onChange={(e) => handleItemSpecChange(idx, 'wall_thickness', parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono font-bold text-xs focus:border-blue-500"
                                placeholder="e.g. 10.36"
                              />
                              {/* Quick WT / Schedule Chips */}
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {[
                                  { label: 'Sch 40 (6.45)', val: 6.45 },
                                  { label: 'Sch 80 (9.17)', val: 9.17 },
                                  { label: '10.36mm', val: 10.36 },
                                  { label: 'Sch 120 (11.99)', val: 11.99 },
                                ].map((wt) => (
                                  <button
                                    key={wt.label}
                                    type="button"
                                    onClick={() => handleItemSpecChange(idx, 'wall_thickness', wt.val)}
                                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                                      Math.abs((item.wall_thickness || 0) - wt.val) < 0.1
                                        ? 'bg-blue-900 text-blue-200 border-blue-600 font-bold'
                                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                                    }`}
                                  >
                                    {wt.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 4. CVN Requirement */}
                            <div>
                              <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                                4. CVN (Charpy V-Notch)
                              </label>
                              <select
                                value={item.cvn_requirement || '27J Min Avg @ -10°C'}
                                onChange={(e) => handleItemSpecChange(idx, 'cvn_requirement', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500"
                              >
                                <option value="27J Min Avg @ -10°C">27J Min Avg @ -10°C (API 5CT SR16)</option>
                                <option value="42J Min Avg @ -20°C">42J Min Avg @ -20°C (Severe / Arctic)</option>
                                <option value="20J Min Avg @ 0°C">20J Min Avg @ 0°C</option>
                                <option value="API 5CT Standard SR16">API 5CT Standard SR16</option>
                                <option value="N/A - Non-Impact Tested">N/A - Non-Impact Tested</option>
                              </select>
                              <div className="mt-1.5 text-[9px] text-slate-500 truncate">
                                Impact energy & test temp
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Order Commercials: Ordered MT, Unit Rate, Line Total */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-2 border-t border-slate-900">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1 font-medium">Ordered MT</label>
                            <input
                              type="number"
                              step="0.001"
                              required
                              value={item.ordered_qty_mt}
                              onChange={(e) => handleItemChange(idx, 'ordered_qty_mt', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono font-bold text-xs focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1 font-medium">Unit Rate ($/MT)</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={item.unit_rate}
                              onChange={(e) => handleItemChange(idx, 'unit_rate', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono font-bold text-xs focus:border-blue-500"
                            />
                          </div>

                          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between shadow-sm">
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase font-semibold block">Line Total</span>
                              <span className="text-[9px] text-slate-500 font-mono">±{item.tolerable_variance_pct || 5}% tol</span>
                            </div>
                            <div className="text-emerald-400 font-mono font-bold text-sm">
                              ${lineTot.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* User Entry Option: Quality & Receiving Stipulations */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Quality & Receiving Stipulations
                    </span>
                    <span className="text-[10px] text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800 font-mono">
                      Contract Terms
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQualityStipulations(DEFAULT_QUALITY_STIPULATIONS)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline font-mono"
                  >
                    Reset to Standard Clauses
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={qualityStipulations}
                  onChange={(e) => setQualityStipulations(e.target.value)}
                  placeholder="Enter quality, MTC 3.1, CVN, weighbridge tolerance, and receiving inspection stipulations..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 text-xs font-mono focus:border-blue-500 leading-relaxed shadow-inner"
                />
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Customise compliance terms for this vendor. These stipulations are printed directly on the PO Contract / Invoice.</span>
                  <span className="font-mono text-slate-500">{qualityStipulations.split('\n').filter(Boolean).length} clause(s)</span>
                </div>
              </div>

              {/* Financial Calculation Summary */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Total PO Value (Calculated)</span>
                  <span className="text-lg font-bold text-emerald-400">${totalPOValue.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Advance Amount Paid ($)</span>
                  <input
                    type="number"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Remaining Balance (Calculated)</span>
                  <span className="text-lg font-bold text-amber-400">${remainingAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30 flex items-center space-x-1.5"
                >
                  {isEditMode ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isEditMode ? 'Update Purchase Order' : 'Save & Release PO'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Commercial PO Invoice Print / Download / Email Modal */}
      {selectedInvoicePo && (
        <PoInvoiceModal
          po={selectedInvoicePo}
          onClose={() => setSelectedInvoicePo(null)}
        />
      )}
    </div>
  );
}
