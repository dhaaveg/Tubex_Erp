'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  Printer,
  Search,
  Filter,
  ArrowUpDown,
  Layers,
  Scale,
  Truck,
  MoreVertical,
  Copy,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronUp,
  Check,
  Package
} from 'lucide-react';
import PoInvoiceModal from '@/components/PoInvoiceModal';
import { formatDate } from '@/lib/formatters';
import { DEFAULT_QUALITY_STIPULATIONS, CVN_REQUIREMENT_OPTIONS, DEFAULT_CVN_REQUIREMENT } from '@/lib/types';
import { useLov } from '@/hooks/useLov';

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

export default function ProcurementModule() {
  const router = useRouter();
  const { options: cvnOptions } = useLov('CVN_REQUIREMENT', CVN_REQUIREMENT_OPTIONS);

  // Data States
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('All');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<'date' | 'po_no' | 'value' | 'mt'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // UI Interactive States
  const [expandedPo, setExpandedPo] = useState<string | null>(null);
  const [activeMenuPo, setActiveMenuPo] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedInvoicePo, setSelectedInvoicePo] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Form Fields
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

  const [items, setItems] = useState<POItemRow[]>([
    {
      product_id: '',
      size_od: 177.8,
      grade: 'L80',
      wall_thickness: 10.36,
      schedule: 'Sch 80',
      cvn_requirement: DEFAULT_CVN_REQUIREMENT,
      ordered_qty: 1000,
      ordered_qty_mt: 43.15,
      unit_rate: 45,
      tolerable_variance_pct: 5,
    },
  ]);

  // Nominal weight formula: (OD - WT) * WT * 0.0246615
  const calcNominalWeight = (od: number, wt: number) => {
    if (!od || !wt || od <= wt) return 30;
    return Number(((od - wt) * wt * 0.0246615).toFixed(2));
  };

  const calcEstMt = (meters: number, od: number, wt: number) => {
    const nomWeight = calcNominalWeight(od, wt);
    return Number(((meters * nomWeight) / 1000).toFixed(3));
  };

  // Close overflow menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuPo(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchData = async (isSilent: boolean = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
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
      console.error('Error fetching procurement data:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Unique Grades for Filter Dropdown
  const availableGrades = useMemo(() => {
    const gradesSet = new Set<string>();
    purchaseOrders.forEach((po) => {
      po.po_items?.forEach((item: any) => {
        if (item.grade) gradesSet.add(item.grade);
        if (item.product?.grade) gradesSet.add(item.product.grade);
      });
    });
    return Array.from(gradesSet).sort();
  }, [purchaseOrders]);

  // Executive KPI Calculations
  const kpiStats = useMemo(() => {
    let activeCount = 0;
    let pendingDeliveryCount = 0;
    let awaitingQcCount = 0;
    let totalSpend = 0;
    let totalContractedMt = 0;

    const now = new Date();

    purchaseOrders.forEach((po) => {
      const isClosed = po.po_status === 'Closed' || po.po_status === 'Cancelled';
      if (!isClosed) {
        activeCount++;
      }

      // Spend
      const poVal = po.po_items?.reduce((acc: number, item: any) => acc + (item.line_total || 0), 0) || 0;
      totalSpend += poVal;

      // MT
      const poMt = po.po_items?.reduce((acc: number, item: any) => acc + (item.ordered_qty_mt || 0), 0) || 0;
      totalContractedMt += poMt;

      // Delivery & QC Tracking
      const hasGrns = po.grns && po.grns.length > 0;
      const allFulfilled = po.po_items?.every((item: any) => item.line_status === 'Fulfilled');

      if (!allFulfilled && !isClosed) {
        pendingDeliveryCount++;
      }

      if (hasGrns && (!allFulfilled || po.po_items?.some((i: any) => i.line_status === 'Partially Received'))) {
        awaitingQcCount++;
      }
    });

    return {
      activeCount,
      pendingDeliveryCount,
      awaitingQcCount,
      totalSpend,
      totalContractedMt,
    };
  }, [purchaseOrders]);

  // Filter & Search Logic
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      // 1. Status Filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'Partial Receipt') {
          const hasPartial = po.po_items?.some((i: any) => i.line_status === 'Partially Received');
          if (!hasPartial) return false;
        } else if (statusFilter === 'Fulfilled') {
          if (po.po_status !== 'Closed' && !po.po_items?.every((i: any) => i.line_status === 'Fulfilled')) {
            return false;
          }
        } else {
          if (po.po_status !== statusFilter) return false;
        }
      }

      // 2. Supplier Filter
      if (selectedSupplierFilter !== 'All' && po.supplier_id !== selectedSupplierFilter) {
        return false;
      }

      // 3. Grade Filter
      if (selectedGradeFilter !== 'All') {
        const matchesGrade = po.po_items?.some(
          (i: any) => i.grade === selectedGradeFilter || i.product?.grade === selectedGradeFilter
        );
        if (!matchesGrade) return false;
      }

      // 4. Search Query (PO #, Supplier Name, Mill, Grade, OD)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const poMatch = po.po_no?.toLowerCase().includes(query);
        const supMatch = po.supplier?.supplier_name?.toLowerCase().includes(query);
        const millMatch = po.supplier?.mill_name?.toLowerCase().includes(query);
        const itemMatch = po.po_items?.some((i: any) => {
          return (
            i.grade?.toLowerCase().includes(query) ||
            i.product?.product_description?.toLowerCase().includes(query) ||
            String(i.size_od).includes(query) ||
            String(i.wall_thickness).includes(query)
          );
        });
        if (!poMatch && !supMatch && !millMatch && !itemMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'date') {
        const dateA = new Date(a.po_date || a.created_at).getTime();
        const dateB = new Date(b.po_date || b.created_at).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      }
      if (sortField === 'po_no') {
        return sortOrder === 'desc' ? b.po_no.localeCompare(a.po_no) : a.po_no.localeCompare(b.po_no);
      }
      if (sortField === 'value') {
        const valA = a.po_items?.reduce((s: number, i: any) => s + (i.line_total || 0), 0) || 0;
        const valB = b.po_items?.reduce((s: number, i: any) => s + (i.line_total || 0), 0) || 0;
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      }
      if (sortField === 'mt') {
        const mtA = a.po_items?.reduce((s: number, i: any) => s + (i.ordered_qty_mt || 0), 0) || 0;
        const mtB = b.po_items?.reduce((s: number, i: any) => s + (i.ordered_qty_mt || 0), 0) || 0;
        return sortOrder === 'desc' ? mtB - mtA : mtA - mtB;
      }
      return 0;
    });
  }, [purchaseOrders, statusFilter, selectedSupplierFilter, selectedGradeFilter, searchQuery, sortField, sortOrder]);

  // Status Filter Counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: purchaseOrders.length,
      Draft: 0,
      Approved: 0,
      Open: 0,
      'Partial Receipt': 0,
      Closed: 0,
    };

    purchaseOrders.forEach((po) => {
      if (counts[po.po_status] !== undefined) {
        counts[po.po_status]++;
      }
      if (po.po_items?.some((i: any) => i.line_status === 'Partially Received')) {
        counts['Partial Receipt']++;
      }
    });

    return counts;
  }, [purchaseOrders]);

  // Modal Handlers
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
        cvn_requirement: DEFAULT_CVN_REQUIREMENT,
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
    setShippingAddress(po.shipping_address || 'Dock 4, Tubular Inwarding Yard, Precision Hub');
    setDeliveryDate(po.delivery_date ? new Date(po.delivery_date).toISOString().split('T')[0] : '');
    setPaymentTerms(po.payment_terms || '30% Advance, Net 60 Days');
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
              cvn_requirement: item.cvn_requirement || prd?.cvn_requirement || DEFAULT_CVN_REQUIREMENT,
              ordered_qty: item.ordered_qty || 1000,
              ordered_qty_mt: item.ordered_qty_mt || calcEstMt(item.ordered_qty || 1000, od, wt),
              unit_rate: item.unit_rate || 45,
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
              cvn_requirement: DEFAULT_CVN_REQUIREMENT,
              ordered_qty: 1000,
              ordered_qty_mt: 43.15,
              unit_rate: 45,
              tolerable_variance_pct: 5,
            },
          ]
    );
    setIsModalOpen(true);
  };

  const handleDuplicatePO = (po: any) => {
    setIsEditMode(false);
    setFormError(null);
    setPoNo(`PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(3, '0')}`);
    setPoDate(new Date().toISOString().split('T')[0]);
    setSupplierId(po.supplier_id);
    setShippingAddress(po.shipping_address || 'Dock 4, Tubular Inwarding Yard, Precision Hub');
    setDeliveryDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setPaymentTerms(po.payment_terms || '30% Advance, Net 60 Days');
    setDeliveryTerms(po.delivery_terms || 'FOB Mill Yard');
    setAdvanceAmount(0);
    setQualityStipulations(po.quality_stipulations || DEFAULT_QUALITY_STIPULATIONS);
    setPoStatus('Draft');

    setItems(
      po.po_items?.map((item: any) => ({
        product_id: item.product_id || '',
        size_od: item.size_od || 177.8,
        grade: item.grade || 'L80',
        wall_thickness: item.wall_thickness || 10.36,
        schedule: item.schedule || 'Sch 80',
        cvn_requirement: item.cvn_requirement || DEFAULT_CVN_REQUIREMENT,
        ordered_qty: item.ordered_qty || 1000,
        ordered_qty_mt: item.ordered_qty_mt || 43.15,
        unit_rate: item.unit_rate || 45,
        tolerable_variance_pct: item.tolerable_variance_pct || 5,
      })) || []
    );
    setActiveMenuPo(null);
    setIsModalOpen(true);
  };

  const handleDeletePO = async (targetPoNo: string) => {
    if (!confirm(`Are you sure you want to delete Purchase Order ${targetPoNo}? This action cannot be reversed.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/purchase-orders?po_no=${encodeURIComponent(targetPoNo)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete PO');
      fetchData(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActiveMenuPo(null);
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
        cvn_requirement: DEFAULT_CVN_REQUIREMENT,
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

    if (field === 'size_od' || field === 'wall_thickness') {
      const od = field === 'size_od' ? Number(value) : item.size_od;
      const wt = field === 'wall_thickness' ? Number(value) : item.wall_thickness;
      if (od > 0 && wt > 0) {
        item.ordered_qty_mt = calcEstMt(item.ordered_qty || 0, od, wt);
      }
    }

    item.product_id = '';
    newItems[index] = item;
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof POItemRow, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  // Live Calculations in Modal
  const totalPOValue = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.ordered_qty_mt || 0) * (item.unit_rate || 0), 0);
  }, [items]);

  const totalPOMt = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.ordered_qty_mt || 0), 0);
  }, [items]);

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
      fetchData(true);
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  // Helper for Status Badge Styling
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse" />
            Open
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
            Approved
          </span>
        );
      case 'Closed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5" />
            Closed
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
            Draft
          </span>
        );
    }
  };

  const selectedSupplierObj = suppliers.find((s) => s.supplier_id === supplierId);

  return (
    <div className="space-y-6">
      {/* 1. Executive Summary & KPI Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Active POs */}
        <div className="relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700/80 transition-all group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Total Active POs
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-sm">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {isLoading ? <span className="inline-block w-8 h-6 bg-slate-800 animate-pulse rounded" /> : kpiStats.activeCount}
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              of {purchaseOrders.length} contracts
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center space-x-1">
            <span className="text-blue-400 font-medium">Active Mill Pipelines</span>
          </div>
        </div>

        {/* Card 2: Pending Delivery / In Transit */}
        <div className="relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700/80 transition-all group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Pending Delivery
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-sm">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {isLoading ? <span className="inline-block w-8 h-6 bg-slate-800 animate-pulse rounded" /> : kpiStats.pendingDeliveryCount}
            </div>
            <span className="text-[11px] font-mono text-amber-400/90 font-medium">
              Inward Awaiting
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center space-x-1">
            <span className="text-slate-400">Dispatch / Transit Phase</span>
          </div>
        </div>

        {/* Card 3: Awaiting GRN / QC Inspection */}
        <div className="relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700/80 transition-all group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Awaiting GRN / QC
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {isLoading ? <span className="inline-block w-8 h-6 bg-slate-800 animate-pulse rounded" /> : kpiStats.awaitingQcCount}
            </div>
            <span className="text-[11px] font-mono text-indigo-400/90 font-medium">
              Weighbridge / Tally
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center space-x-1">
            <span className="text-slate-400">Quality Holds & Verification</span>
          </div>
        </div>

        {/* Card 4: Total Procurement Spend */}
        <div className="relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700/80 transition-all group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Total Contract Spend
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
              {isLoading ? (
                <span className="inline-block w-20 h-6 bg-slate-800 animate-pulse rounded" />
              ) : (
                `$${(kpiStats.totalSpend / 1000).toFixed(1)}k`
              )}
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {kpiStats.totalContractedMt.toFixed(1)} MT Total
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center space-x-1">
            <span className="text-emerald-400 font-medium">Reconciled Value</span>
          </div>
        </div>
      </div>

      {/* 2. Unified Filter & Action Toolbar */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 rounded-xl p-3 shadow-lg space-y-3">
        {/* Top Row: Search Input, Quick Dropdown Filters & Primary Action */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PO #, Supplier, Mill, Grade, OD..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Supplier Filter */}
            <div className="relative">
              <select
                value={selectedSupplierFilter}
                onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer appearance-none pr-7 font-sans"
              >
                <option value="All">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.supplier_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Material Grade Filter */}
            <div className="relative">
              <select
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer appearance-none pr-7 font-mono"
              >
                <option value="All">All Grades</option>
                {availableGrades.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Sort Order Selector */}
            <div className="relative">
              <select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as [any, any];
                  setSortField(field);
                  setSortOrder(order);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer appearance-none pr-7 font-sans"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="value-desc">Highest Value</option>
                <option value="mt-desc">Highest Tonnage</option>
                <option value="po_no-asc">PO Number (A-Z)</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Refresh Purchase Orders"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            {/* Primary Action Button */}
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all transform active:scale-95 cursor-pointer ml-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Pill-based Status Segmented Filters */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 overflow-x-auto scrollbar-none">
          <div className="flex items-center space-x-1.5">
            {[
              { id: 'All', label: 'All Orders' },
              { id: 'Draft', label: 'Draft' },
              { id: 'Approved', label: 'Approved' },
              { id: 'Open', label: 'Open' },
              { id: 'Partial Receipt', label: 'Partial Receipt' },
              { id: 'Closed', label: 'Fulfilled / Closed' },
            ].map((tab) => {
              const count = statusCounts[tab.id] ?? 0;
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-blue-800 text-white font-bold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {(searchQuery || statusFilter !== 'All' || selectedSupplierFilter !== 'All' || selectedGradeFilter !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
                setSelectedSupplierFilter('All');
                setSelectedGradeFilter('All');
              }}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1 ml-3 shrink-0 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. High-Density PO Data Table & Information Hierarchy */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b border-slate-800 select-none">
              <tr>
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">PO & Status</th>
                <th className="py-3 px-4">Supplier & Mill</th>
                <th className="py-3 px-4">Technical Spec Summary</th>
                <th className="py-3 px-4 text-right">Tonnage & Lines</th>
                <th className="py-3 px-4 text-right">Commercial Value</th>
                <th className="py-3 px-4">Delivery & Terms</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-sans">
              {isLoading ? (
                // Skeleton Rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="w-4 h-4 bg-slate-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-24 h-4 bg-slate-800 rounded mb-1.5" /><div className="w-16 h-3 bg-slate-850 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-36 h-4 bg-slate-800 rounded mb-1.5" /><div className="w-24 h-3 bg-slate-850 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-32 h-4 bg-slate-800 rounded mb-1.5" /><div className="w-20 h-3 bg-slate-850 rounded" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="w-16 h-4 bg-slate-800 rounded ml-auto mb-1.5" /><div className="w-12 h-3 bg-slate-850 rounded ml-auto" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="w-20 h-4 bg-slate-800 rounded ml-auto mb-1.5" /><div className="w-28 h-3 bg-slate-850 rounded ml-auto" /></td>
                    <td className="py-3.5 px-4"><div className="w-24 h-4 bg-slate-800 rounded mb-1.5" /><div className="w-16 h-3 bg-slate-850 rounded" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="w-20 h-6 bg-slate-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filteredOrders.length === 0 ? (
                // 5. Empty State
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 shadow-inner">
                        <Package className="w-6 h-6 text-slate-500" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">No Purchase Orders Found</h4>
                        <p className="text-xs text-slate-400">
                          {searchQuery || statusFilter !== 'All' || selectedSupplierFilter !== 'All'
                            ? 'No purchase orders match your active filter criteria. Try clearing filters.'
                            : 'No purchase contracts have been recorded in the system yet.'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 pt-2">
                        {searchQuery || statusFilter !== 'All' || selectedSupplierFilter !== 'All' ? (
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setStatusFilter('All');
                              setSelectedSupplierFilter('All');
                              setSelectedGradeFilter('All');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                          >
                            Clear All Filters
                          </button>
                        ) : null}
                        <button
                          onClick={handleOpenCreate}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition"
                        >
                          + Create First Purchase Order
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((po) => {
                  const isExpanded = expandedPo === po.po_no;
                  const totalVal = po.po_items?.reduce((sum: number, item: any) => sum + (item.line_total || 0), 0) || 0;
                  const totalMt = po.po_items?.reduce((sum: number, item: any) => sum + (item.ordered_qty_mt || 0), 0) || 0;
                  const receivedMt = po.po_items?.reduce((sum: number, item: any) => sum + (item.received_qty_mt || 0), 0) || 0;
                  const fulfillmentPct = totalMt > 0 ? Math.min(100, Math.round((receivedMt / totalMt) * 100)) : 0;
                  const hasGrns = po.grns && po.grns.length > 0;
                  const firstItem = po.po_items?.[0];

                  return (
                    <React.Fragment key={po.po_no}>
                      <tr 
                        onClick={() => setExpandedPo(isExpanded ? null : po.po_no)}
                        className={`hover:bg-slate-800/40 transition-colors cursor-pointer group ${
                          isExpanded ? 'bg-slate-800/30' : ''
                        }`}
                      >
                        {/* Expand Icon */}
                        <td className="py-3.5 px-4 text-slate-500 group-hover:text-slate-300">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>

                        {/* PO # & Status */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-xs text-blue-400 group-hover:underline">
                              {po.po_no}
                            </span>
                            {renderStatusBadge(po.po_status)}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>{formatDate(po.po_date)}</span>
                          </div>
                        </td>

                        {/* Supplier & Mill Details */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200 text-xs flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[200px]" title={po.supplier?.supplier_name}>
                              {po.supplier?.supplier_name || 'Vendor Unassigned'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]">
                            {po.supplier?.mill_name || po.supplier?.supplier_code || 'Direct Mill Delivery'}
                          </div>
                        </td>

                        {/* Product Technical Spec Summary */}
                        <td className="py-3.5 px-4">
                          {firstItem ? (
                            <div>
                              <div className="font-mono text-xs text-slate-200">
                                {firstItem.size_od || firstItem.product?.size_od || '—'}mm OD • {firstItem.wall_thickness || firstItem.product?.wall_thickness || '—'}mm WT
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1.5">
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                                  {firstItem.grade || firstItem.product?.grade || 'L80'}
                                </span>
                                {po.po_items && po.po_items.length > 1 && (
                                  <span className="text-[10px] text-blue-400">
                                    +{po.po_items.length - 1} more item(s)
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px]">No items configured</span>
                          )}
                        </td>

                        {/* Tonnage & Lines */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono text-xs font-bold text-slate-200">
                            {totalMt.toFixed(2)} MT
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {po.po_items?.length || 0} line item(s)
                          </div>
                          {fulfillmentPct > 0 && (
                            <div className="w-20 bg-slate-800 rounded-full h-1 mt-1 ml-auto overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-1 rounded-full" 
                                style={{ width: `${fulfillmentPct}%` }} 
                              />
                            </div>
                          )}
                        </td>

                        {/* Commercial Value */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono text-xs font-bold text-emerald-400">
                            ${totalVal.toLocaleString()}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            Adv: ${po.advance_amount?.toLocaleString() || '0'} • Bal: ${(po.remaining_amount || Math.max(0, totalVal - (po.advance_amount || 0))).toLocaleString()}
                          </div>
                        </td>

                        {/* Delivery & Terms */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-xs text-slate-200">
                            Due: {formatDate(po.delivery_date)}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[150px] mt-0.5">
                            {po.delivery_terms || 'FOB Mill Yard'}
                          </div>
                        </td>

                        {/* Actions Column */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Quick Print/PDF Invoice */}
                            <button
                              onClick={() => setSelectedInvoicePo(po)}
                              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-emerald-950 text-slate-400 hover:text-emerald-300 border border-slate-700/60 hover:border-emerald-600/50 transition-colors"
                              title="Print / Export Commercial Invoice as PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* Link to GRN Receiving */}
                            <button
                              onClick={() => router.push(`/receiving?po=${encodeURIComponent(po.po_no)}`)}
                              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-blue-950 text-slate-400 hover:text-blue-300 border border-slate-700/60 hover:border-blue-600/50 transition-colors"
                              title="Go to Receiving & Inward Tally (GRN)"
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </button>

                            {/* Three-Dot Overflow Menu */}
                            <div className="relative">
                              <button
                                onClick={() => setActiveMenuPo(activeMenuPo === po.po_no ? null : po.po_no)}
                                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-colors"
                                title="More actions"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {activeMenuPo === po.po_no && (
                                <div
                                  ref={menuRef}
                                  className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-30 divide-y divide-slate-800 text-left font-sans animate-in fade-in zoom-in-95 duration-100"
                                >
                                  <div className="py-1">
                                    <button
                                      onClick={() => {
                                        setActiveMenuPo(null);
                                        handleOpenEdit(po);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center space-x-2"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-blue-400" />
                                      <span>Edit PO Contract</span>
                                    </button>

                                    <button
                                      onClick={() => handleDuplicatePO(po)}
                                      className="w-full px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center space-x-2"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Duplicate as New PO</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        setActiveMenuPo(null);
                                        setSelectedInvoicePo(po);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center space-x-2"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>View Invoice Preview</span>
                                    </button>
                                  </div>

                                  <div className="py-1">
                                    {!hasGrns ? (
                                      <button
                                        onClick={() => handleDeletePO(po.po_no)}
                                        className="w-full px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/60 flex items-center space-x-2"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Cancel & Delete PO</span>
                                      </button>
                                    ) : (
                                      <div className="px-3 py-1 text-[10px] text-slate-500 font-mono">
                                        Locked by existing GRN
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-Table Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-950/90 border-t border-slate-800">
                          <td colSpan={8} className="p-4 pl-12">
                            <div className="space-y-4">
                              {/* Meta Details Header */}
                              <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800/80 pb-3">
                                <div className="flex flex-wrap items-center gap-4 text-slate-400">
                                  <span>Pay Terms: <strong className="text-slate-200">{po.payment_terms}</strong></span>
                                  <span>Delivery Terms: <strong className="text-slate-200">{po.delivery_terms || 'FOB Mill Yard'}</strong></span>
                                  <span>Delivery Target: <strong className="text-slate-200">{formatDate(po.delivery_date)}</strong></span>
                                  <span>Receiving Dock: <strong className="text-slate-200">{po.shipping_address}</strong></span>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleOpenEdit(po)}
                                    className="px-2.5 py-1 rounded-md bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold border border-blue-500/40 flex items-center space-x-1 transition"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    <span>Edit PO</span>
                                  </button>
                                  <button
                                    onClick={() => setSelectedInvoicePo(po)}
                                    className="px-2.5 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/40 flex items-center space-x-1 transition"
                                  >
                                    <Printer className="w-3 h-3" />
                                    <span>Print Invoice</span>
                                  </button>
                                </div>
                              </div>

                              {/* Nested Line Items Table */}
                              <div>
                                <div className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-2">
                                  <span>Line Items Breakdown ({po.po_items?.length || 0})</span>
                                </div>
                                <div className="rounded-lg border border-slate-800 overflow-hidden bg-slate-900/60">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase">
                                      <tr>
                                        <th className="py-2.5 px-3">Item #</th>
                                        <th className="py-2.5 px-3">Product Description</th>
                                        <th className="py-2.5 px-3">OD × WT • Grade</th>
                                        <th className="py-2.5 px-3">CVN Specification</th>
                                        <th className="py-2.5 px-3 text-right">Ordered MT</th>
                                        <th className="py-2.5 px-3 text-right">Rate ($/MT)</th>
                                        <th className="py-2.5 px-3 text-right">Line Total</th>
                                        <th className="py-2.5 px-3 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-850 font-mono text-xs">
                                      {po.po_items?.map((item: any, idx: number) => (
                                        <tr key={item.po_item_id || idx} className="hover:bg-slate-850/40 transition">
                                          <td className="py-2 px-3 text-blue-400 font-bold">
                                            #{idx + 1}
                                          </td>
                                          <td className="py-2 px-3 font-sans font-medium text-slate-200">
                                            {item.product?.product_description || `Tubular Pipe ${item.size_od}mm`}
                                          </td>
                                          <td className="py-2 px-3 text-slate-300">
                                            {item.size_od}mm × {item.wall_thickness}mm • Grade {item.grade}
                                          </td>
                                          <td className="py-2 px-3 text-slate-400 font-sans text-[11px]">
                                            {item.cvn_requirement || DEFAULT_CVN_REQUIREMENT}
                                          </td>
                                          <td className="py-2 px-3 text-right font-bold text-slate-200">
                                            {item.ordered_qty_mt} MT
                                          </td>
                                          <td className="py-2 px-3 text-right text-slate-300">
                                            ${item.unit_rate}
                                          </td>
                                          <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                                            ${(item.line_total || (item.ordered_qty_mt * item.unit_rate)).toLocaleString()}
                                          </td>
                                          <td className="py-2 px-3 text-center font-sans">
                                            <span
                                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                item.line_status === 'Fulfilled'
                                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                                  : item.line_status === 'Partially Received'
                                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                                              }`}
                                            >
                                              {item.line_status || 'Pending'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Quality Stipulations Note */}
                              {po.quality_stipulations && (
                                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg text-xs space-y-1">
                                  <div className="font-semibold text-slate-300 flex items-center space-x-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Quality & Compliance Stipulations:</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 font-mono whitespace-pre-line leading-relaxed">
                                    {po.quality_stipulations}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. "Create / Edit Purchase Order" Modal (Sectioned Enterprise Layout) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Top Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>{isEditMode ? 'Edit Purchase Order Contract' : 'Create Purchase Order Contract'}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300 text-[10px] font-mono font-bold">
                      {poNo}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Precision engineering multi-line contract builder with automated MT calculation and MTC compliance.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Notification */}
            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Body: Scrollable Content with Sections */}
            <form onSubmit={handleSubmitPO} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* SECTION 1: General Details & Logistics */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Section 1: Contract Header & Vendor Details</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {selectedSupplierObj ? `${selectedSupplierObj.supplier_name} • ${selectedSupplierObj.mill_name}` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* PO Number */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      PO Number {isEditMode && <span className="text-amber-400 font-mono">(Locked)</span>}
                    </label>
                    {isEditMode ? (
                      <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 font-mono">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-bold text-blue-400">{poNo}</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={poNo}
                        onChange={(e) => setPoNo(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono font-bold text-xs focus:border-blue-500 outline-none"
                      />
                    )}
                  </div>

                  {/* PO Date */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">PO Issuance Date</label>
                    <input
                      type="date"
                      value={poDate}
                      onChange={(e) => setPoDate(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* Supplier Selection */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Vendor / Mill Supplier</label>
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 outline-none font-medium"
                    >
                      {suppliers.map((s) => (
                        <option key={s.supplier_id} value={s.supplier_id}>
                          {s.supplier_name} ({s.mill_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Delivery Due Date */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Delivery Due Target</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* Delivery IncoTerms */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">IncoTerms / Delivery Terms</label>
                    <input
                      type="text"
                      list="po-delivery-terms-list"
                      value={deliveryTerms}
                      onChange={(e) => setDeliveryTerms(e.target.value)}
                      placeholder="e.g. FOB Mill Yard"
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 outline-none"
                    />
                    <datalist id="po-delivery-terms-list">
                      <option value="FOB Mill Yard" />
                      <option value="FOB Shipping Port" />
                      <option value="CIF Destination Port" />
                      <option value="DDP Plant Receiving Yard" />
                      <option value="Ex-Works (EXW)" />
                    </datalist>
                  </div>

                  {/* Payment Terms */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Payment Commercial Terms</label>
                    <input
                      type="text"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder="e.g. 30% Advance, Net 60 Days"
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* Shipping Destination */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Destination Receiving Yard</label>
                    <input
                      type="text"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* PO Status */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Contract Status</label>
                    <select
                      value={poStatus}
                      onChange={(e) => setPoStatus(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 outline-none font-medium"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Approved">Approved</option>
                      <option value="Open">Open</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Line Items Builder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Section 2: Pipe Specifications & Line Items ({items.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item Line</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const lineTot = (item.ordered_qty_mt || 0) * (item.unit_rate || 0);
                    const nomWt = calcNominalWeight(item.size_od, item.wall_thickness);

                    return (
                      <div
                        key={idx}
                        className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 relative hover:border-slate-700 transition shadow-inner"
                      >
                        {/* Item Bar Header */}
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800 text-[11px]">
                              Line #{idx + 1}
                            </span>
                            <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-mono">
                              {item.size_od || 0}mm OD • {item.grade || 'L80'} • {item.wall_thickness || 0}mm WT
                            </span>
                          </div>

                          <div className="flex items-center space-x-3">
                            <span className="text-[10px] text-slate-500 font-mono">
                              Nominal: <strong className="text-blue-400">{nomWt} kg/m</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              disabled={items.length === 1}
                              className={`p-1.5 rounded transition ${
                                items.length === 1
                                  ? 'text-slate-600 cursor-not-allowed'
                                  : 'text-rose-400 hover:bg-rose-950 hover:text-rose-300'
                              }`}
                              title="Remove Line Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Technical Spec Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                          {/* 1. Size OD */}
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
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono font-bold text-xs focus:border-blue-500 outline-none"
                              placeholder="e.g. 177.8"
                            />
                            {/* Preset Chips */}
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
                                  className={`text-[9px] px-1.5 py-0.5 rounded border transition ${
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
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono font-bold text-xs focus:border-blue-500 outline-none"
                            >
                              <option value="J55">J55 (API 5CT)</option>
                              <option value="K55">K55 (API 5CT)</option>
                              <option value="L80">L80 (Sour Service / 80 ksi)</option>
                              <option value="N80">N80 (API 5CT)</option>
                              <option value="P110">P110 (Deep Wells / 110 ksi)</option>
                              <option value="Q125">Q125 (High Strength / 125 ksi)</option>
                            </select>
                            {/* Quick Chips */}
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {['J55', 'L80', 'P110'].map((g) => (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => handleItemSpecChange(idx, 'grade', g)}
                                  className={`text-[9px] px-2 py-0.5 rounded border transition ${
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
                              3. Wall Thickness / Sch (mm)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={item.wall_thickness || ''}
                              onChange={(e) => handleItemSpecChange(idx, 'wall_thickness', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono font-bold text-xs focus:border-blue-500 outline-none"
                              placeholder="e.g. 10.36"
                            />
                            {/* Quick WT Chips */}
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
                                  className={`text-[9px] px-1.5 py-0.5 rounded border transition ${
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

                          {/* 4. CVN Charpy V-Notch Requirement */}
                          <div>
                            <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                              4. CVN (Charpy V-Notch)
                            </label>
                            <select
                              value={item.cvn_requirement || DEFAULT_CVN_REQUIREMENT}
                              onChange={(e) => handleItemSpecChange(idx, 'cvn_requirement', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
                            >
                              {item.cvn_requirement && !cvnOptions.includes(item.cvn_requirement as any) && (
                                <option value={item.cvn_requirement}>{item.cvn_requirement} (Custom/Legacy)</option>
                              )}
                              {cvnOptions.map((cvn) => (
                                <option key={cvn} value={cvn}>
                                  {cvn}
                                </option>
                              ))}
                            </select>
                            <div className="mt-1.5 text-[9px] text-slate-500 truncate">
                              API 5CT Impact Compliance
                            </div>
                          </div>
                        </div>

                        {/* Order Commercials: Ordered MT, Unit Rate, Line Total */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-2 border-t border-slate-900">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1 font-medium">Ordered MT (Tonnage)</label>
                            <input
                              type="number"
                              step="0.001"
                              required
                              value={item.ordered_qty_mt}
                              onChange={(e) => handleItemChange(idx, 'ordered_qty_mt', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono font-bold text-xs focus:border-blue-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1 font-medium">Contract Rate ($/MT)</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={item.unit_rate}
                              onChange={(e) => handleItemChange(idx, 'unit_rate', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono font-bold text-xs focus:border-blue-500 outline-none"
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

              {/* SECTION 3: Quality & Compliance Stipulations */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Section 3: Quality & Receiving Stipulations
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 text-xs font-mono focus:border-blue-500 leading-relaxed outline-none shadow-inner"
                />
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>These compliance stipulations print directly on the official PO Invoice document.</span>
                  <span className="font-mono text-slate-500">{qualityStipulations.split('\n').filter(Boolean).length} clause(s)</span>
                </div>
              </div>
            </form>

            {/* SECTION 4: Financial Summary Sticky Footer */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-2xl">
              {/* Financial Snapshot */}
              <div className="flex flex-wrap items-center gap-6 font-mono text-xs">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Total Tonnage</span>
                  <span className="text-sm font-bold text-slate-200">{totalPOMt.toFixed(2)} MT</span>
                </div>

                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Total Value</span>
                  <span className="text-base font-bold text-emerald-400">${totalPOValue.toLocaleString()}</span>
                </div>

                <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Advance Paid ($)</span>
                    <input
                      type="number"
                      value={advanceAmount || ''}
                      onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-24 bg-transparent font-bold text-blue-400 text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Balance Due</span>
                  <span className="text-sm font-bold text-amber-400">${remainingAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitPO}
                  type="button"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 flex items-center space-x-1.5 transition cursor-pointer"
                >
                  {isEditMode ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isEditMode ? 'Update Purchase Order' : 'Save & Release PO'}</span>
                </button>
              </div>
            </div>
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
