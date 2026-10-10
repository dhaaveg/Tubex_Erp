'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Tag, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  RefreshCw, 
  X,
  AlertCircle,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';

export interface LovRecord {
  id: string;
  category: string;
  code: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
  is_system_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function LovManagementTab() {
  const { success, error } = useToast();
  const { user } = useAuth();

  const isAdmin = Boolean(
    user && (
      user.role === 'SUPER_ADMIN' ||
      user.role === 'ADMIN' ||
      user.roles?.includes('SUPER_ADMIN') ||
      user.roles?.includes('ADMIN')
    )
  );

  const [items, setItems] = useState<LovRecord[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isReordering, setIsReordering] = useState<boolean>(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<LovRecord | null>(null);
  const [formCategory, setFormCategory] = useState<string>('CVN_REQUIREMENT');
  const [formCode, setFormCode] = useState<string>('');
  const [formLabel, setFormLabel] = useState<string>('');
  const [formValue, setFormValue] = useState<string>('');
  const [formSortOrder, setFormSortOrder] = useState<number>(100);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isAdmin) {
        const url =
          selectedCategory && selectedCategory !== 'ALL'
            ? `/api/admin/lov?category=${encodeURIComponent(selectedCategory)}`
            : '/api/admin/lov';
        const res = await fetch(url);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || 'Failed to fetch LOV items');
        }
        const data = await res.json();
        if (data?.items) {
          setItems(data.items);
        }
        if (data?.categories) {
          setCategories(data.categories);
        }
      } else {
        // Non-admin read-only fallback via /api/lov to allow active dropdown inspection without 403 errors
        const url =
          selectedCategory && selectedCategory !== 'ALL'
            ? `/api/lov?category=${encodeURIComponent(selectedCategory)}`
            : '/api/lov';
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('Failed to fetch LOV items');
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setItems(data);
          const distinct = Array.from(new Set(data.map((i: any) => i.category))).sort() as string[];
          setCategories(distinct);
        }
      }
    } catch (err: any) {
      console.error(err);
      error(err?.message || 'Error loading LOV data');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, selectedCategory, error]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleMove = async (item: LovRecord, direction: 'up' | 'down') => {
    if (!isAdmin || isReordering) return;

    // Filter within same category as the item to ensure logical relative sorting
    const categoryItems = items
      .filter((i) => i.category === item.category)
      .sort((a, b) => a.sort_order - b.sort_order);

    const index = categoryItems.findIndex((i) => i.id === item.id);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categoryItems.length) return;

    const targetItem = categoryItems[targetIndex];
    setIsReordering(true);

    try {
      let newCurrentOrder = targetItem.sort_order;
      let newTargetOrder = item.sort_order;
      if (newCurrentOrder === newTargetOrder) {
        newCurrentOrder = direction === 'up' ? targetItem.sort_order - 1 : targetItem.sort_order + 1;
      }

      const res = await fetch('/api/admin/lov', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { id: item.id, sort_order: newCurrentOrder },
            { id: targetItem.id, sort_order: newTargetOrder },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to reorder items');
      }
      success(`Reordered "${item.label}" successfully.`);
      await fetchItems();
    } catch (err: any) {
      error(err?.message || 'Error reordering items');
    } finally {
      setIsReordering(false);
    }
  };

  const handleOpenCreate = () => {
    if (!isAdmin) {
      error('Access denied. Only Super Admin or Admin can create List of Values (LOV).');
      return;
    }
    setEditingItem(null);
    setFormCategory(selectedCategory !== 'ALL' ? selectedCategory : categories[0] || 'CVN_REQUIREMENT');
    setFormCode('');
    setFormLabel('');
    setFormValue('');
    setFormSortOrder(100);
    setFormIsActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: LovRecord) => {
    if (!isAdmin) {
      error('Access denied. Only Super Admin or Admin can modify List of Values (LOV).');
      return;
    }
    setEditingItem(item);
    setFormCategory(item.category);
    setFormCode(item.code);
    setFormLabel(item.label);
    setFormValue(item.value);
    setFormSortOrder(item.sort_order);
    setFormIsActive(item.is_active);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      error('Access denied. Only Super Admin or Admin can create or modify List of Values (LOV).');
      return;
    }
    setModalError(null);
    setIsSubmitting(true);

    try {
      if (editingItem) {
        // PUT update
        const res = await fetch(`/api/admin/lov/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: formLabel,
            value: formValue || formLabel,
            sort_order: Number(formSortOrder),
            is_active: formIsActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to update LOV item');
        }
        success(`LOV item "${formLabel}" updated successfully.`);
      } else {
        // POST create
        const res = await fetch('/api/admin/lov', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: formCategory,
            code: formCode,
            label: formLabel,
            value: formValue || formLabel,
            sort_order: Number(formSortOrder),
            is_active: formIsActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to create LOV item');
        }
        success(`LOV item "${formLabel}" created in ${formCategory}.`);
      }

      setIsModalOpen(false);
      fetchItems();
    } catch (err: any) {
      setModalError(err?.message || 'Error saving LOV item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (item: LovRecord) => {
    if (!isAdmin) {
      error('Access denied. Only Super Admin or Admin can modify List of Values (LOV).');
      return;
    }
    try {
      const res = await fetch(`/api/admin/lov/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || 'Failed to toggle status');
      }
      success(`Option "${item.label}" ${!item.is_active ? 'activated' : 'deactivated'}.`);
      fetchItems();
    } catch (err: any) {
      error(err?.message || 'Could not update status');
    }
  };

  const handleDelete = async (item: LovRecord) => {
    if (!isAdmin) {
      error('Access denied. Only Super Admin or Admin can delete List of Values (LOV).');
      return;
    }
    if (item.is_system_default) {
      error('System default items cannot be deleted. Deactivate them instead.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${item.label}" from category ${item.category}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/lov/${item.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete LOV item');
      }
      success(data?.message || `Option "${item.label}" deleted.`);
      fetchItems();
    } catch (err: any) {
      error(err?.message || 'Could not delete LOV item');
    }
  };

  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Non-Admin Security Warning Banner */}
      {!isAdmin && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 flex items-start space-x-3 text-amber-200 shadow-md">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-xs text-amber-200 uppercase tracking-wider font-mono">
              Restricted Access &bull; Read-Only Mode
            </h4>
            <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
              Access denied. Only Super Admin or Admin can create, modify, reorder, or delete List of Values (LOV). Dropdown entries are displayed for operational reference only.
            </p>
          </div>
        </div>
      )}

      {/* Category Pills & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Categories ({items.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={fetchItems}
            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title="Reload LOV Items"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Dropdown Option</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Filter by label, stored value, code, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* LOV Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Display Label</th>
                <th className="px-4 py-3">Stored Value</th>
                <th className="px-4 py-3 text-center">Order</th>
                <th className="px-4 py-3 text-center">Type</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">{isAdmin ? 'Actions' : 'Access'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {isLoading ? 'Loading dropdown options...' : 'No options found matching criteria.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-blue-400">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {item.code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-100">
                      {item.label}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {item.value}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-400">
                      <div className="flex items-center justify-center space-x-1">
                        <span className="w-6 text-right">{item.sort_order}</span>
                        {isAdmin && (
                          <div className="flex flex-col ml-1">
                            <button
                              type="button"
                              onClick={() => handleMove(item, 'up')}
                              disabled={isReordering}
                              className="p-0.5 text-slate-400 hover:text-blue-400 disabled:opacity-30 transition-colors"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(item, 'down')}
                              disabled={isReordering}
                              className="p-0.5 text-slate-400 hover:text-blue-400 disabled:opacity-30 transition-colors"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.is_system_default ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-950/50 text-amber-300 border border-amber-800/60 font-semibold" title="Protected System Default">
                          <Lock className="w-2.5 h-2.5" /> System
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold border transition-all ${
                            item.is_active
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                              : 'bg-red-950/60 text-red-400 border-red-800/60 hover:bg-red-900/60'
                          }`}
                          title="Click to toggle status"
                        >
                          {item.is_active ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-red-400" /> Inactive
                            </>
                          )}
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold border ${
                            item.is_active
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                              : 'bg-red-950/40 text-red-400 border-red-800/40'
                          }`}
                          title="Status (Read-Only)"
                        >
                          {item.is_active ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Inactive
                            </>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isAdmin ? (
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 border border-slate-800 transition-colors"
                            title="Edit LOV"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!item.is_system_default ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="p-1.5 rounded-lg bg-slate-950 hover:bg-red-600/20 text-slate-400 hover:text-red-400 border border-slate-800 transition-colors"
                              title="Delete custom option"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span
                              className="p-1.5 rounded-lg bg-slate-950 text-slate-600 border border-slate-850 cursor-not-allowed opacity-50"
                              title="System defaults cannot be deleted"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-slate-950 text-slate-500 border border-slate-800 font-mono"
                          title="Restricted: Read-only access"
                        >
                          <Lock className="w-2.5 h-2.5" /> Read-Only
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {editingItem ? `Edit Option: ${editingItem.label}` : 'Add New Dropdown Option'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Category</label>
                {editingItem ? (
                  <input
                    type="text"
                    disabled
                    value={formCategory}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 font-mono cursor-not-allowed"
                  />
                ) : (
                  <div className="space-y-1.5">
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="CUSTOM">+ New Category</option>
                    </select>
                    {formCategory === 'CUSTOM' && (
                      <input
                        type="text"
                        placeholder="ENTER_NEW_CATEGORY_NAME"
                        onChange={(e) => setFormCategory(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono uppercase focus:border-blue-500"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Code */}
              {!editingItem && (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Code (Unique identifier)</label>
                  <input
                    type="text"
                    placeholder="e.g. L_10_27J (Auto-generated if left blank)"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono uppercase focus:border-blue-500"
                  />
                </div>
              )}

              {/* Label */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Display Label (Required)</label>
                <input
                  type="text"
                  placeholder="e.g. L-10-27J (21°C ± 3°C)"
                  value={formLabel}
                  onChange={(e) => {
                    setFormLabel(e.target.value);
                    if (!formValue || formValue === formLabel) {
                      setFormValue(e.target.value);
                    }
                  }}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500"
                />
              </div>

              {/* Value */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Stored Value (Saved in Database)</label>
                <input
                  type="text"
                  placeholder="Value persisted to records (defaults to Label)"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-blue-500"
                />
              </div>

              {/* Sort Order & Status */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Sort Order</label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span className="text-slate-300 font-medium">Active (Visible in UI)</span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Option'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
