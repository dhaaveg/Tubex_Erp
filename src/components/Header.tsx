'use client';

import React, { useState } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  LogOut,
  ShieldCheck,
  Eye,
  User,
  Mail,
  Edit2,
  CheckCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  onQuickSearch?: (query: string) => void;
  onRefresh?: () => void;
  onExportClick?: () => void;
  isLoading?: boolean;
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  ADMIN: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  MD: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  PROCUREMENT: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  MANUFACTURING: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  SALES: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  INVENTORY: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  QUALITY: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
};

export default function Header({ onQuickSearch, onRefresh, onExportClick, isLoading }: HeaderProps) {
  const { user, logout, refetchUser } = useAuth();

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleOpenProfileModal = () => {
    if (!user) return;
    setProfileName(user.name);
    setProfileEmail(user.email);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!profileName.trim()) {
      setErrorMsg('Full name cannot be empty.');
      return;
    }
    if (!profileEmail.trim()) {
      setErrorMsg('Corporate email address cannot be empty.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName.trim(),
          email: profileEmail.trim().toLowerCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update personal identity');

      setSuccessMsg('Profile identity updated successfully.');
      await refetchUser();
      setTimeout(() => {
        setIsProfileModalOpen(false);
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-10 shrink-0">
        {/* Search Input for Quick Traceability */}
        <div className="flex items-center space-x-4 max-w-md w-full">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Quick search: Heat No (HT-84920), Pipe Tag, WO ID..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onQuickSearch) {
                  onQuickSearch((e.target as HTMLInputElement).value);
                }
              }}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
            />
          </div>
        </div>

        {/* Header Badges & Actions */}
        <div className="flex items-center space-x-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1 transition-colors border border-slate-700"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
              <span className="hidden sm:inline text-xs">Sync</span>
            </button>
          )}

          {onExportClick && (
            <button
              onClick={onExportClick}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-xs flex items-center space-x-1.5 transition-colors font-medium shadow-sm"
              title="Export ERP Data (Excel & CSV)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export Excel/CSV</span>
            </button>
          )}

          {/* User Identity & Logout */}
          {user && (
            <div className="flex items-center space-x-2.5 pl-3 border-l border-slate-800">
              <button
                onClick={handleOpenProfileModal}
                className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-800/80 transition-all text-left cursor-pointer group border border-transparent hover:border-slate-700/80"
                title="Click to view and edit your profile identity (Name, Mail ID)"
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 uppercase font-mono group-hover:border-blue-500 transition-colors">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-medium text-slate-200 leading-tight flex items-center space-x-1 group-hover:text-blue-300 transition-colors">
                    <span>{user.name}</span>
                    <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity" />
                    {(user.roles?.includes('SUPER_ADMIN') || user.role === 'SUPER_ADMIN') && (
                      <span title="Root Administrator">
                        <ShieldCheck className="w-3 h-3 text-rose-400 inline" />
                      </span>
                    )}
                    {(user.roles?.includes('MD') || user.role === 'MD') && (
                      <span title="Executive Read-Only">
                        <Eye className="w-3 h-3 text-purple-400 inline" />
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex flex-wrap gap-1">
                    {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map((r) => (
                      <span
                        key={r}
                        className={`px-1.5 py-0.5 rounded text-[9px] border font-semibold ${
                          ROLE_BADGE_STYLES[r] || 'border-slate-700 text-slate-400'
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </button>

              <button
                onClick={() => logout()}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 transition-colors border border-slate-700/80"
                title="Sign Out of Session"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MODAL: EDIT MY PROFILE IDENTITY */}
      {isProfileModalOpen && user && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  Personal Identity Settings
                </h3>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700/60 text-rose-200 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Ramesh Kulkarni"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>Corporate Mail ID *</span>
                </label>
                <input
                  type="email"
                  required
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="name@energyoilfield.com"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  This email is your active ERP login credential across all platforms.
                </p>
              </div>

              {/* Roles Badge List (Read Only) */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                  Assigned Departmental Roles
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map((r) => (
                    <span
                      key={r}
                      className={`px-2 py-0.5 rounded text-[10px] border font-mono font-bold uppercase ${
                        ROLE_BADGE_STYLES[r] || 'border-slate-700 text-slate-400'
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow disabled:opacity-50"
                >
                  {isSaving ? 'Updating...' : 'Save Identity Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
