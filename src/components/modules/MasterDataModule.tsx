'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Package, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  X, 
  Factory,
  Check,
  AlertCircle,
  Tag,
  Edit,
  Barcode,
  Eye
} from 'lucide-react';
import MasterDataTagModal from '../MasterDataTagModal';
import { formatDate } from '@/lib/formatters';
import { DEFAULT_CVN_REQUIREMENT } from '@/lib/types';

export default function MasterDataModule() {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'products'>('suppliers');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [previewTagItem, setPreviewTagItem] = useState<{ type: 'supplier' | 'product'; data: any } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Supplier Form State
  const [supplierForm, setSupplierForm] = useState({
    supplier_id: '',
    supplier_name: '',
    supplier_onboarding_date: new Date().toISOString().split('T')[0],
    supplier_address: '',
    contact_person: '',
    telephone_no: '',
    supplier_mail: '',
    mill_name: '',
    mill_address: '',
    gst_tax_id: '',
    status: 'Active',
  });

  // Product Form State
  const [productForm, setProductForm] = useState<{
    product_id: string;
    product_description: string;
    size_od: number;
    wall_thickness: number;
    grade: string;
    thread_type: string;
    cvn_requirement: string;
    nominal_weight_kg_m: number;
    uom: string;
  }>({
    product_id: '',
    product_description: '',
    size_od: 177.8,
    wall_thickness: 10.36,
    grade: 'L80',
    thread_type: 'BTC',
    cvn_requirement: DEFAULT_CVN_REQUIREMENT,
    nominal_weight_kg_m: 43.15,
    uom: 'Meters',
  });

  const getNextSupplierId = () => {
    const ids = suppliers.map((s) => s.supplier_id);
    let maxNum = 0;
    for (const id of ids) {
      const match = String(id).match(/SUP-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `SUP-${String(maxNum + 1).padStart(3, '0')}`;
  };

  const getNextProductId = () => {
    const ids = products.map((p) => p.product_id);
    let maxNum = 0;
    for (const id of ids) {
      const match = String(id).match(/PRD-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `PRD-${String(maxNum + 1).padStart(3, '0')}`;
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'suppliers') {
        const res = await fetch(`/api/suppliers?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (Array.isArray(data)) setSuppliers(data);
      } else {
        const res = await fetch(`/api/products?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (Array.isArray(data)) setProducts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, searchQuery]);

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setFormError(null);
    if (activeTab === 'suppliers') {
      setSupplierForm({
        supplier_id: getNextSupplierId(),
        supplier_name: '',
        supplier_onboarding_date: new Date().toISOString().split('T')[0],
        supplier_address: '',
        contact_person: '',
        telephone_no: '',
        supplier_mail: '',
        mill_name: '',
        mill_address: '',
        gst_tax_id: '',
        status: 'Active',
      });
    } else {
      setProductForm({
        product_id: getNextProductId(),
        product_description: '',
        size_od: 177.8,
        wall_thickness: 10.36,
        grade: 'L80',
        thread_type: 'BTC',
        cvn_requirement: DEFAULT_CVN_REQUIREMENT,
        nominal_weight_kg_m: 43.15,
        uom: 'Meters',
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenEditSupplier = (s: any) => {
    setIsEditMode(true);
    setFormError(null);
    setSupplierForm({
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name || '',
      supplier_onboarding_date: s.supplier_onboarding_date ? new Date(s.supplier_onboarding_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      supplier_address: s.supplier_address || '',
      contact_person: s.contact_person || '',
      telephone_no: s.telephone_no || '',
      supplier_mail: s.supplier_mail || '',
      mill_name: s.mill_name || '',
      mill_address: s.mill_address || '',
      gst_tax_id: s.gst_tax_id || '',
      status: s.status || 'Active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditProduct = (p: any) => {
    setIsEditMode(true);
    setFormError(null);
    setProductForm({
      product_id: p.product_id,
      product_description: p.product_description || '',
      size_od: p.size_od || 177.8,
      wall_thickness: p.wall_thickness || 10.36,
      grade: p.grade || 'L80',
      thread_type: p.thread_type || 'BTC',
      cvn_requirement: p.cvn_requirement || DEFAULT_CVN_REQUIREMENT,
      nominal_weight_kg_m: p.nominal_weight_kg_m || 43.15,
      uom: p.uom || 'Meters',
    });
    setIsModalOpen(true);
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const res = await fetch('/api/suppliers', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} supplier`);

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const res = await fetch('/api/products', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} product`);

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Master Data Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Maintain normalized supplier, mill, and product specifications without field duplication.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-2 transition-all ${
                activeTab === 'suppliers'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Suppliers & Mills</span>
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-2 transition-all ${
                activeTab === 'products'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>OCTG Products</span>
            </button>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add {activeTab === 'suppliers' ? 'Supplier' : 'Product'}</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center space-x-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'suppliers'
                ? 'Search by Supplier ID, Name, Mill, Tax ID...'
                : 'Search by Product ID, Grade (J55, L80, P110), Thread (BTC, LTC)...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table Content */}
      {activeTab === 'suppliers' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Supplier ID</th>
                  <th className="px-4 py-3">Company & Contact</th>
                  <th className="px-4 py-3">Mill Details</th>
                  <th className="px-4 py-3">GST / Tax ID</th>
                  <th className="px-4 py-3">POs Active</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      {isLoading ? 'Loading suppliers...' : 'No suppliers found.'}
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.supplier_id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold">
                        <button
                          onClick={() => setPreviewTagItem({ type: 'supplier', data: s })}
                          className="text-blue-400 hover:text-blue-300 hover:underline flex items-center space-x-1 font-mono"
                          title="Click to view Tag"
                        >
                          <Tag className="w-3 h-3 text-blue-400" />
                          <span>{s.supplier_id}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{s.supplier_name}</div>
                        <div className="text-[11px] text-slate-400">
                          {s.contact_person} • {s.supplier_mail}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Onboarded: {formatDate(s.supplier_onboarding_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                          <Factory className="w-3.5 h-3.5 text-amber-400" />
                          <span>{s.mill_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{s.mill_address}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {s.gst_tax_id ? s.gst_tax_id : <span className="text-slate-500 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {s._count?.purchase_orders ?? 0} POs
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            s.status === 'Active'
                              ? 'bg-emerald-950 border border-emerald-800/80 text-emerald-300'
                              : 'bg-rose-950 border border-rose-800/80 text-rose-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.status === 'Active' ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          ></span>
                          <span>{s.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => setPreviewTagItem({ type: 'supplier', data: s })}
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 text-[11px] font-medium flex items-center space-x-1 transition-colors"
                            title="Preview Master Tag"
                          >
                            <Tag className="w-3.5 h-3.5" />
                            <span>Tag</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditSupplier(s)}
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 text-[11px] font-medium flex items-center space-x-1 transition-colors"
                            title="Edit Supplier Record"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Product ID</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">OD (mm)</th>
                  <th className="px-4 py-3">WT (mm)</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Thread</th>
                  <th className="px-4 py-3">CVN Criteria</th>
                  <th className="px-4 py-3">Weight (kg/m)</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      {isLoading ? 'Loading products...' : 'No products found.'}
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.product_id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold">
                        <button
                          onClick={() => setPreviewTagItem({ type: 'product', data: p })}
                          className="text-blue-400 hover:text-blue-300 hover:underline flex items-center space-x-1 font-mono"
                          title="Click to view Tag"
                        >
                          <Tag className="w-3 h-3 text-blue-400" />
                          <span>{p.product_id}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-200">
                        {p.product_description}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">{p.size_od}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{p.wall_thickness}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/80 text-blue-300 font-mono font-bold">
                          {p.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 font-mono">
                          {p.thread_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{p.cvn_requirement}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {p.nominal_weight_kg_m} {p.uom}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => setPreviewTagItem({ type: 'product', data: p })}
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 text-[11px] font-medium flex items-center space-x-1 transition-colors"
                            title="Preview Specification Tag"
                          >
                            <Tag className="w-3.5 h-3.5" />
                            <span>Tag</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditProduct(p)}
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 text-[11px] font-medium flex items-center space-x-1 transition-colors"
                            title="Edit Product Specification"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                {isEditMode ? <Edit className="w-4 h-4 text-amber-400" /> : <Plus className="w-4 h-4 text-blue-400" />}
                <span>
                  {activeTab === 'suppliers'
                    ? isEditMode ? 'Edit Supplier & Mill Master' : 'Register New Supplier Master'
                    : isEditMode ? 'Edit OCTG Product Master' : 'Add New Product Master'}
                </span>
              </h3>
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

            <form
              onSubmit={activeTab === 'suppliers' ? handleCreateSupplier : handleCreateProduct}
              className="p-6 space-y-4 overflow-y-auto flex-1 text-xs"
            >
              {activeTab === 'suppliers' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-400">Supplier ID</label>
                        <span className="text-[10px] text-blue-400 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800/60 font-mono">
                          {isEditMode ? 'Locked' : 'Auto-Generated'}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="Auto-generated (e.g. SUP-005)"
                        value={supplierForm.supplier_id}
                        onChange={(e) => setSupplierForm({ ...supplierForm, supplier_id: e.target.value })}
                        disabled={isEditMode}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:border-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Supplier Name</label>
                      <input
                        type="text"
                        placeholder="Company legal name"
                        value={supplierForm.supplier_name}
                        onChange={(e) => setSupplierForm({ ...supplierForm, supplier_name: e.target.value })}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Mill Name</label>
                      <input
                        type="text"
                        placeholder="Manufacturing mill name"
                        value={supplierForm.mill_name}
                        onChange={(e) => setSupplierForm({ ...supplierForm, mill_name: e.target.value })}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">GST / Tax ID (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. US-9842019 (Optional)"
                        value={supplierForm.gst_tax_id}
                        onChange={(e) => setSupplierForm({ ...supplierForm, gst_tax_id: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Mill Physical Address</label>
                    <input
                      type="text"
                      placeholder="Mill plant facility address"
                      value={supplierForm.mill_address}
                      onChange={(e) => setSupplierForm({ ...supplierForm, mill_address: e.target.value })}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Supplier Commercial Address</label>
                    <input
                      type="text"
                      placeholder="Headquarters address"
                      value={supplierForm.supplier_address}
                      onChange={(e) => setSupplierForm({ ...supplierForm, supplier_address: e.target.value })}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Contact Person</label>
                      <input
                        type="text"
                        placeholder="Key account rep"
                        value={supplierForm.contact_person}
                        onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Telephone</label>
                      <input
                        type="text"
                        placeholder="+1 555 0192"
                        value={supplierForm.telephone_no}
                        onChange={(e) => setSupplierForm({ ...supplierForm, telephone_no: e.target.value })}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Email</label>
                      <input
                        type="email"
                        placeholder="sales@mill.com"
                        value={supplierForm.supplier_mail}
                        onChange={(e) => setSupplierForm({ ...supplierForm, supplier_mail: e.target.value })}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-400">Product ID</label>
                        <span className="text-[10px] text-blue-400 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800/60 font-mono">
                          {isEditMode ? 'Locked' : 'Auto-Generated'}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="Auto-generated (e.g. PRD-005)"
                        value={productForm.product_id}
                        onChange={(e) => setProductForm({ ...productForm, product_id: e.target.value })}
                        disabled={isEditMode}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:border-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Steel Grade</label>
                      <select
                        value={productForm.grade}
                        onChange={(e) => setProductForm({ ...productForm, grade: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
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
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="e.g. 7 in OD x 0.408 in WT L80 BTC Casing Pipe"
                      value={productForm.product_description}
                      onChange={(e) => setProductForm({ ...productForm, product_description: e.target.value })}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Outer Dia (OD mm)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={productForm.size_od}
                        onChange={(e) => setProductForm({ ...productForm, size_od: parseFloat(e.target.value) || 0 })}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Wall Thickness (mm)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={productForm.wall_thickness}
                        onChange={(e) => setProductForm({ ...productForm, wall_thickness: parseFloat(e.target.value) || 0 })}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Thread Type</label>
                      <select
                        value={productForm.thread_type}
                        onChange={(e) => setProductForm({ ...productForm, thread_type: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                      >
                        <option value="BTC">BTC (Buttress)</option>
                        <option value="LTC">LTC (Long Thread)</option>
                        <option value="STC">STC (Short Thread)</option>
                        <option value="EUE">EUE (External Upset End)</option>
                        <option value="NU">NU(Non-Upset)</option>
                        <option value="Premium">Premium Gas-Tight</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">CVN Requirement</label>
                      <input
                        type="text"
                        placeholder="e.g. 27J @ -10°C"
                        value={productForm.cvn_requirement}
                        onChange={(e) => setProductForm({ ...productForm, cvn_requirement: e.target.value })}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Nominal Weight (kg/m)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={productForm.nominal_weight_kg_m}
                        onChange={(e) => setProductForm({ ...productForm, nominal_weight_kg_m: parseFloat(e.target.value) || 0 })}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

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
                  {isEditMode ? 'Update Master Record' : 'Save Master Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Master Data Tag Preview Modal */}
      {previewTagItem && (
        <MasterDataTagModal
          type={previewTagItem.type}
          data={previewTagItem.data}
          onClose={() => setPreviewTagItem(null)}
          onEdit={() => {
            const { type, data } = previewTagItem;
            setPreviewTagItem(null);
            if (type === 'supplier') {
              handleOpenEditSupplier(data);
            } else {
              handleOpenEditProduct(data);
            }
          }}
        />
      )}
    </div>
  );
}
