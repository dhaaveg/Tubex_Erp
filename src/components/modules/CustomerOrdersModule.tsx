'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronRight,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
  Tag,
  Edit,
  Building,
  Truck,
  Layers,
  Search,
  Check,
  AlertTriangle,
  Printer,
  FileText
} from 'lucide-react';
import { CustomerOrder, CustomerPOLineItem } from '@/lib/types';
import { formatDate } from '@/lib/formatters';

interface LineItemRow {
  cpo_item_id?: string;
  size: string;
  grade: string;
  thread: string;
  quantity: number;
  price_per_unit: number;
  line_total: number;
  line_status?: 'Open' | 'In Production' | 'Fulfilled';
}

export default function CustomerOrdersModule() {
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewTagOrder, setPreviewTagOrder] = useState<CustomerOrder | null>(null);

  // Form State
  const [customerPoNo, setCustomerPoNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [deliveryTerms, setDeliveryTerms] = useState('FOB Port Houston');
  const [deliveryDueDate, setDeliveryDueDate] = useState(
    new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [remarks, setRemarks] = useState('');
  const [orderStatus, setOrderStatus] = useState<any>('Open');

  // Dynamic Line Items State
  const [lineItems, setLineItems] = useState<LineItemRow[]>([
    {
      size: '7 in (177.8 mm)',
      grade: 'L80',
      thread: 'BTC',
      quantity: 500,
      price_per_unit: 145.0,
      line_total: 72500.0,
      line_status: 'Open',
    },
  ]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/customer-orders?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setCustomerOrders(data);
        if (data.length > 0 && !expandedOrder) {
          setExpandedOrder(data[0].customer_po_no);
        }
      }
    } catch (e) {
      console.error('Error fetching customer orders:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery]);

  // Line item handlers
  const handleItemChange = (index: number, field: keyof LineItemRow, value: any) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };

    // Auto recalculate line total
    const qty = field === 'quantity' ? parseFloat(value) || 0 : item.quantity;
    const price = field === 'price_per_unit' ? parseFloat(value) || 0 : item.price_per_unit;
    item.line_total = Number((qty * price).toFixed(2));

    updated[index] = item;
    setLineItems(updated);
  };

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        size: '9-5/8 in (244.5 mm)',
        grade: 'P110',
        thread: 'Premium',
        quantity: 250,
        price_per_unit: 195.0,
        line_total: 48750.0,
        line_status: 'Open',
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) {
      alert('Customer Order must contain at least one line item.');
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Grand totals
  const totalOrderQty = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalOrderValue = lineItems.reduce((sum, item) => sum + (Number(item.line_total) || 0), 0);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setFormError(null);
    setCustomerPoNo(`CPO-${new Date().getFullYear()}-${String(customerOrders.length + 1).padStart(3, '0')}`);
    setCustomerName('');
    setPaymentTerms('Net 30 Days');
    setDeliveryTerms('FOB Port Houston');
    setDeliveryDueDate(new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setRemarks('');
    setOrderStatus('Open');
    setLineItems([
      {
        size: '7 in (177.8 mm)',
        grade: 'L80',
        thread: 'BTC',
        quantity: 500,
        price_per_unit: 145.0,
        line_total: 72500.0,
        line_status: 'Open',
      },
    ]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (order: CustomerOrder) => {
    setIsEditMode(true);
    setFormError(null);
    setCustomerPoNo(order.customer_po_no);
    setCustomerName(order.customer_name);
    setPaymentTerms(order.payment_terms);
    setDeliveryTerms(order.delivery_terms);
    setDeliveryDueDate(
      order.delivery_due_date
        ? new Date(order.delivery_due_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setRemarks(order.remarks || '');
    setOrderStatus(order.order_status);

    if (order.items && order.items.length > 0) {
      setLineItems(
        order.items.map((it) => ({
          cpo_item_id: it.cpo_item_id,
          size: it.size,
          grade: it.grade,
          thread: it.thread,
          quantity: it.quantity,
          price_per_unit: it.price_per_unit,
          line_total: it.line_total,
          line_status: it.line_status,
        }))
      );
    } else {
      setLineItems([
        {
          size: '7 in (177.8 mm)',
          grade: 'L80',
          thread: 'BTC',
          quantity: 100,
          price_per_unit: 100,
          line_total: 10000,
          line_status: 'Open',
        },
      ]);
    }

    setIsModalOpen(true);
  };

  // Submit Handler (POST or PUT)
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!customerPoNo.trim()) {
      setFormError("Customer's PO No is required");
      return;
    }
    if (!customerName.trim()) {
      setFormError("Customer's Name is required");
      return;
    }
    for (let i = 0; i < lineItems.length; i++) {
      const it = lineItems[i];
      if (!it.size.trim()) {
        setFormError(`Line #${i + 1}: Size is required`);
        return;
      }
      if (!it.grade.trim()) {
        setFormError(`Line #${i + 1}: Grade is required`);
        return;
      }
      if (!it.thread.trim()) {
        setFormError(`Line #${i + 1}: Thread is required`);
        return;
      }
      if (!it.quantity || it.quantity <= 0) {
        setFormError(`Line #${i + 1}: Quantity must be greater than 0`);
        return;
      }
    }

    try {
      const payload = {
        customer_po_no: customerPoNo.trim(),
        customer_name: customerName.trim(),
        order_date: new Date().toISOString(),
        payment_terms: paymentTerms.trim(),
        delivery_terms: deliveryTerms.trim(),
        delivery_due_date: new Date(deliveryDueDate).toISOString(),
        remarks: remarks.trim(),
        order_status: orderStatus,
        items: lineItems.map((item) => ({
          cpo_item_id: item.cpo_item_id,
          size: item.size.trim(),
          grade: item.grade.trim(),
          thread: item.thread.trim(),
          quantity: Number(item.quantity),
          price_per_unit: Number(item.price_per_unit),
          line_status: item.line_status || 'Open',
        })),
      };

      const res = await fetch('/api/customer-orders', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} Customer Order`);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  // Grade color scheme helper
  const getGradeBadge = (grade: string) => {
    const g = String(grade).toUpperCase();
    if (g.includes('J55') || g.includes('K55')) {
      return 'bg-emerald-950 text-emerald-300 border-emerald-800/80';
    }
    if (g.includes('L80')) {
      return 'bg-red-950 text-red-300 border-red-800/80';
    }
    if (g.includes('N80')) {
      return 'bg-amber-950 text-amber-300 border-amber-800/80';
    }
    if (g.includes('P110')) {
      return 'bg-slate-900 text-blue-300 border-blue-800/80';
    }
    if (g.includes('Q125')) {
      return 'bg-orange-950 text-orange-300 border-orange-800/80';
    }
    return 'bg-blue-950 text-blue-300 border-blue-800/80';
  };

  // KPI Calculations
  const filteredOrders = customerOrders.filter((ord) => {
    if (statusFilter !== 'ALL' && ord.order_status !== statusFilter) return false;
    return true;
  });

  const totalContractValue = customerOrders.reduce((sum, ord) => sum + (ord.total_amount || 0), 0);
  const totalOpenOrders = customerOrders.filter((ord) => ord.order_status === 'Open' || ord.order_status === 'In Production').length;
  const totalOrderedPieces = customerOrders.reduce((sum, ord) => sum + (ord.total_quantity || 0), 0);

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800/60 uppercase font-semibold tracking-wider">
              Step 4 • Sales & Demand Allocation
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">Pre-Production Work Order Driver</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-400" />
            <span>Customer&apos;s Orders &amp; Demand Master</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Log official customer purchase orders with commercial delivery &amp; payment terms and dynamic tubular line items before releasing shop floor Work Orders.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Customer Order</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Total Customer Orders</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1 font-mono">{customerOrders.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Logged sales contracts</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Active Demand</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{totalOpenOrders}</div>
          <div className="text-[11px] text-slate-400 mt-1">Open / In Production</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Total Contract Value</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
            ${totalContractValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Booked customer revenue</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Total Demand Volume</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300 mt-1 font-mono">
            {totalOrderedPieces.toLocaleString()} Pcs
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Total pieces on order</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Customer PO No, Customer Name, Paying Terms, Delivery Terms, Size, Grade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Production">In Production</option>
            <option value="Partially Fulfilled">Partially Fulfilled</option>
            <option value="Fulfilled">Fulfilled</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Customer Orders Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
              <tr>
                <th className="px-3 py-3 w-8"></th>
                <th className="px-4 py-3">Customer&apos;s PO No</th>
                <th className="px-4 py-3">Customer&apos;s Name</th>
                <th className="px-4 py-3">Paying Terms</th>
                <th className="px-4 py-3">Delivery Terms</th>
                <th className="px-4 py-3">Delivery Due Date</th>
                <th className="px-4 py-3 text-right">Total Qty (Pcs)</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    {isLoading ? 'Loading customer orders...' : 'No customer purchase orders logged yet.'}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isExpanded = expandedOrder === ord.customer_po_no;
                  const isDueSoon =
                    new Date(ord.delivery_due_date).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

                  return (
                    <React.Fragment key={ord.customer_po_no}>
                      <tr
                        className={`hover:bg-slate-850/50 transition-colors ${
                          isExpanded ? 'bg-slate-850/40 border-l-2 border-blue-500' : ''
                        }`}
                      >
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() =>
                              setExpandedOrder(isExpanded ? null : ord.customer_po_no)
                            }
                            className="text-slate-400 hover:text-white transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-blue-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-400">
                          <button
                            onClick={() => setPreviewTagOrder(ord)}
                            className="hover:underline flex items-center space-x-1"
                            title="Preview Order Tag / Commercial Spec"
                          >
                            <Tag className="w-3 h-3 text-blue-400" />
                            <span>{ord.customer_po_no}</span>
                          </button>
                          <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">
                            Date: {formatDate(ord.order_date)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-200">{ord.customer_name}</div>
                          {ord.remarks && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs" title={ord.remarks}>
                              &quot;{ord.remarks}&quot;
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-300 font-medium">
                          {ord.payment_terms}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          <div className="flex items-center space-x-1.5">
                            <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{ord.delivery_terms}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <div className="flex items-center space-x-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className={isDueSoon ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
                              {formatDate(ord.delivery_due_date)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-200">
                          {ord.total_quantity?.toLocaleString()} Pcs
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                          ${ord.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                              ord.order_status === 'Fulfilled'
                                ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                                : ord.order_status === 'In Production'
                                ? 'bg-blue-950 border-blue-800 text-blue-300'
                                : ord.order_status === 'Cancelled'
                                ? 'bg-rose-950 border-rose-800 text-rose-300'
                                : 'bg-amber-950 border-amber-800 text-amber-300'
                            }`}
                          >
                            <span>{ord.order_status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => setPreviewTagOrder(ord)}
                              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 text-[11px] font-medium flex items-center space-x-1"
                              title="Preview Order Spec"
                            >
                              <Tag className="w-3.5 h-3.5" />
                              <span>Tag</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(ord)}
                              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 text-[11px] font-medium flex items-center space-x-1"
                              title="Edit Customer Order"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-Table for Customer PO Line Items */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="px-6 py-4 bg-slate-950/70 border-y border-slate-800/80">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Layers className="w-4 h-4 text-blue-400" />
                                  <span className="font-bold text-slate-200 text-xs uppercase tracking-wide">
                                    Customer PO Line Items ({ord.items?.length || 0} specifications)
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Linked to Customer PO: <span className="font-mono text-blue-300">{ord.customer_po_no}</span>
                                </div>
                              </div>

                              <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                                    <tr>
                                      <th className="px-3 py-2">Item ID</th>
                                      <th className="px-3 py-2">Size</th>
                                      <th className="px-3 py-2">Steel Grade</th>
                                      <th className="px-3 py-2">Thread Connection</th>
                                      <th className="px-3 py-2 text-right">Ordered Qty (Pcs)</th>
                                      <th className="px-3 py-2 text-right">Price / Unit</th>
                                      <th className="px-3 py-2 text-right">Line Total</th>
                                      <th className="px-3 py-2 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/50">
                                    {ord.items && ord.items.length > 0 ? (
                                      ord.items.map((item, idx) => (
                                        <tr key={item.cpo_item_id} className="hover:bg-slate-850/50">
                                          <td className="px-3 py-2 font-mono text-slate-400">
                                            #{item.item_seq_no || idx + 1}
                                          </td>
                                          <td className="px-3 py-2 font-medium text-slate-200">
                                            {item.size}
                                          </td>
                                          <td className="px-3 py-2">
                                            <span
                                              className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] border ${getGradeBadge(
                                                item.grade
                                              )}`}
                                            >
                                              {item.grade}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 font-mono text-slate-300">
                                            <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/80 text-indigo-300">
                                              {item.thread}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-200">
                                            {item.quantity?.toLocaleString()} Pcs
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono text-slate-300">
                                            ${item.price_per_unit?.toFixed(2)}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">
                                            ${item.line_total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 border border-blue-800/60 text-blue-300">
                                              {item.line_status || 'Open'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                                          No line items found for this order.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
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

      {/* Creation & Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  {isEditMode ? "Edit Customer's Order" : "Log New Customer's Order"}
                </h3>
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

            <form onSubmit={handleSubmitOrder} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Header Details Section */}
              <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider font-mono">
                  1. Customer PO Header Details (User Entry)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Customer&apos;s PO No. *</label>
                    <input
                      type="text"
                      placeholder="e.g. CPO-2026-901"
                      value={customerPoNo}
                      onChange={(e) => setCustomerPoNo(e.target.value)}
                      disabled={isEditMode}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:border-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Customer&apos;s Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Saudi Aramco / ExxonMobil"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Paying Terms *</label>
                    <input
                      type="text"
                      placeholder="e.g. Net 30 Days, 50% Advance"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Delivery Terms *</label>
                    <input
                      type="text"
                      placeholder="e.g. FOB Port Houston, CIF Dammam"
                      value={deliveryTerms}
                      onChange={(e) => setDeliveryTerms(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Delivery Due Date *</label>
                    <input
                      type="date"
                      value={deliveryDueDate}
                      onChange={(e) => setDeliveryDueDate(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-slate-300 mb-1 font-medium">Remarks / Handling Instructions</label>
                    <input
                      type="text"
                      placeholder="e.g. High pressure sour service, inspect thread protectors"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Order Status</label>
                    <select
                      value={orderStatus}
                      onChange={(e) => setOrderStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                    >
                      <option value="Open">Open</option>
                      <option value="In Production">In Production</option>
                      <option value="Partially Fulfilled">Partially Fulfilled</option>
                      <option value="Fulfilled">Fulfilled</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Dynamic Line Items Section */}
              <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider font-mono">
                    2. Customer PO Line Items (User Entry)
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600/90 hover:bg-blue-600 text-white text-[11px] font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Line Item</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-800 rounded-lg">
                    <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2 w-8">#</th>
                        <th className="px-3 py-2 min-w-[150px]">Size *</th>
                        <th className="px-3 py-2 min-w-[110px]">Grade *</th>
                        <th className="px-3 py-2 min-w-[110px]">Thread *</th>
                        <th className="px-3 py-2 w-28">Quantity (Pcs) *</th>
                        <th className="px-3 py-2 w-28">Price / Unit ($) *</th>
                        <th className="px-3 py-2 w-32 text-right">Line Total</th>
                        <th className="px-2 py-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {lineItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-850/50">
                          <td className="px-3 py-2 font-mono text-slate-400 text-center">{idx + 1}</td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              placeholder="e.g. 7 in OD (177.8 mm)"
                              value={item.size}
                              onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                              required
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={item.grade}
                              onChange={(e) => handleItemChange(idx, 'grade', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono focus:border-blue-500"
                            >
                              <option value="J55">J55</option>
                              <option value="K55">K55</option>
                              <option value="L80">L80</option>
                              <option value="N80">N80</option>
                              <option value="C90">C90</option>
                              <option value="T95">T95</option>
                              <option value="P110">P110</option>
                              <option value="Q125">Q125</option>
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={
                                item.thread === 'NU(Non-Upset)' || item.thread === 'NU (Non-Upset)'
                                  ? 'NU'
                                  : item.thread === 'EUE (External Upset End)'
                                  ? 'EUE'
                                  : item.thread
                              }
                              onChange={(e) => handleItemChange(idx, 'thread', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono focus:border-blue-500"
                            >
                              <option value="BTC">BTC (Buttress)</option>
                              <option value="LTC">LTC (Long Thread)</option>
                              <option value="STC">STC (Short Thread)</option>
                              <option value="EUE">EUE (External Upset End)</option>
                              <option value="NU">NU(Non-Upset)</option>
                              {item.thread && !['BTC', 'LTC', 'STC', 'EUE', 'NU', 'NU(Non-Upset)', 'NU (Non-Upset)', 'EUE (External Upset End)'].includes(item.thread) && (
                                <option value={item.thread}>{item.thread}</option>
                              )}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="1"
                              min="1"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              required
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-right focus:border-blue-500"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Price"
                              value={item.price_per_unit}
                              onChange={(e) =>
                                handleItemChange(idx, 'price_per_unit', parseFloat(e.target.value) || 0)
                              }
                              required
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-right focus:border-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">
                            ${item.line_total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(idx)}
                              disabled={lineItems.length <= 1}
                              className="text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded"
                              title="Delete line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Bar */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 font-mono text-xs">
                    Total Ordered Volume: <span className="text-white font-bold">{totalOrderQty.toLocaleString()} Pcs</span>
                  </div>
                  <div className="text-slate-400 font-mono text-xs">
                    Grand Total Value: <span className="text-emerald-400 font-black text-sm">${totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
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
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30"
                >
                  {isEditMode ? 'Update Customer Order' : 'Save Customer Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Order Specification & Commercial Preview Tag Modal */}
      {previewTagOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-white text-xs">
                  Customer Commercial Order Tag (Master Preview)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const ord = previewTagOrder;
                    setPreviewTagOrder(null);
                    handleOpenEditModal(ord);
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white text-xs font-medium flex items-center space-x-1.5 transition-colors border border-slate-700"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Order</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Tag</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTagOrder(null)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Industrial Tag Content */}
            <div className="p-6 flex justify-center bg-slate-950/60 overflow-y-auto max-h-[80vh]">
              <div className="w-full max-w-md bg-white text-slate-900 p-6 rounded-2xl border-4 border-dashed border-blue-600 shadow-2xl relative select-none font-mono">
                {/* Punch Hole */}
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full bg-slate-950 border-2 border-slate-700 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900"></div>
                </div>

                {/* Header & Barcode */}
                <div className="text-center border-b-2 border-slate-900 pb-3 mt-1">
                  <div className="text-[10px] uppercase tracking-widest text-slate-600 font-sans font-black">
                    OFFICIAL CUSTOMER DEMAND ORDER
                  </div>
                  <div className="text-xl font-black tracking-tight text-blue-900 font-sans mt-0.5">
                    {previewTagOrder.customer_name}
                  </div>
                  <div className="mt-1 font-mono tracking-widest text-base font-bold bg-slate-100 py-1 rounded border border-slate-300">
                    *{previewTagOrder.customer_po_no}*
                  </div>
                </div>

                {/* Commercial Terms */}
                <div className="grid grid-cols-2 gap-3 py-3 border-b border-slate-200 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-sans">PAYING TERMS</span>
                    <span className="font-bold text-slate-800">{previewTagOrder.payment_terms}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-sans">DELIVERY TERMS</span>
                    <span className="font-bold text-slate-800">{previewTagOrder.delivery_terms}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-sans">DUE DATE</span>
                    <span className="font-bold text-blue-900 font-mono">
                      {formatDate(previewTagOrder.delivery_due_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-sans">ORDER STATUS</span>
                    <span className="font-bold text-emerald-800 uppercase">{previewTagOrder.order_status}</span>
                  </div>
                </div>

                {/* Ordered Items Summary */}
                <div className="py-3 border-b border-slate-200">
                  <div className="text-[9px] text-slate-500 uppercase font-sans mb-1 font-bold">
                    ORDERED SPECIFICATIONS ({previewTagOrder.items?.length || 0} ITEMS)
                  </div>
                  <div className="space-y-1.5">
                    {previewTagOrder.items?.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50 p-1.5 rounded border border-slate-200">
                        <div>
                          <span className="font-bold text-slate-900">{it.size}</span>
                          <span className="text-slate-600"> • {it.grade} {it.thread}</span>
                        </div>
                        <div className="font-mono font-bold text-slate-800">
                          {it.quantity} Pcs (${it.line_total?.toLocaleString()})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Value & Signature */}
                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-sans">TOTAL CONTRACT VALUE</span>
                    <span className="text-base font-black text-emerald-800 font-mono">
                      ${previewTagOrder.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block uppercase font-sans">VOLUME</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      {previewTagOrder.total_quantity?.toLocaleString()} Pcs
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
