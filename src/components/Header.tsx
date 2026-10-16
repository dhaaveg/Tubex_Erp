'use client';

import React, { useState } from 'react';
import {
  Search,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Eye,
  User,
  Mail,
  Edit2,
  CheckCircle,
  AlertTriangle,
  X,
  Activity,
  Sun,
  Moon,
  Lock,
  KeyRound,
  Check,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import RecentActivityFeed from './RecentActivityFeed';
import { PasswordInput } from './ui/PasswordInput';
import { apiUrl } from '@/lib/api';

interface HeaderProps {
  onQuickSearch?: (query: string) => void;
  onRefresh?: () => void;
  onExportClick?: () => void;
  isLoading?: boolean;
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-rose-50 dark:bg-rose-500/10 text-[#BE123C] dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
  ADMIN: 'bg-indigo-50 dark:bg-indigo-500/10 text-[#4338CA] dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
  MD: 'bg-purple-50 dark:bg-purple-500/10 text-[#6D28D9] dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
  PROCUREMENT: 'bg-blue-50 dark:bg-blue-500/10 text-[#1D4ED8] dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  MANUFACTURING: 'bg-amber-50 dark:bg-amber-500/10 text-[#B45309] dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  SALES: 'bg-orange-50 dark:bg-orange-500/10 text-[#C2410C] dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
  INVENTORY: 'bg-emerald-50 dark:bg-emerald-500/10 text-[#047857] dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  QUALITY: 'bg-cyan-50 dark:bg-cyan-500/10 text-[#0E7490] dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
};

export default function Header({ onQuickSearch, onRefresh, onExportClick, isLoading }: HeaderProps) {
  const { user, logout, refetchUser } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();

  // Theme toggle is strictly role-gated to SUPER_ADMIN
  const isSuperAdmin = Boolean(user && (user.roles?.includes('SUPER_ADMIN') || user.role === 'SUPER_ADMIN'));

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'profile' | 'security' | 'activity'>('profile');
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Security / Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const handleOpenProfileModal = () => {
    if (!user) return;
    setProfileName(user.name);
    setProfileEmail(user.email);
    setErrorMsg(null);
    setSuccessMsg(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwdError(null);
    setPwdSuccess(null);
    setProfileTab('profile');
    setIsProfileModalOpen(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (!currentPassword) {
      setPwdError('Current password is required.');
      return;
    }
    if (newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setPwdError('New password must contain at least one uppercase letter (A-Z).');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setPwdError('New password must contain at least one lowercase letter (a-z).');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setPwdError('New password must contain at least one number (0-9).');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      setPwdError('New password must contain at least one special symbol (!@#$%^&*...).');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New password and confirmation do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');

      setPwdSuccess('Password updated successfully! Your new credentials are now active.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPwdSuccess(null);
      }, 4000);
    } catch (err: any) {
      setPwdError(err.message || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
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
      const res = await fetch(apiUrl(`/api/users/${user.id}`), {
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
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between z-10 shrink-0 transition-colors duration-150">
        {/* Search Input for Quick Traceability */}
        <div className="flex items-center space-x-4 max-w-md w-full">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Quick search: Heat No (HT-84920), Pipe Tag, WO ID..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onQuickSearch) {
                  onQuickSearch((e.target as HTMLInputElement).value);
                }
              }}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono shadow-inner"
            />
          </div>
        </div>

        {/* Header Badges & Actions */}
        <div className="flex items-center space-x-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs flex items-center space-x-1 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
              <span className="hidden sm:inline text-xs">Sync</span>
            </button>
          )}

          {/* Role-Gated Theme Toggle: Strictly restricted to SUPER_ADMIN */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={
                isDark
                  ? 'Switch to Classic Corporate Light Mode'
                  : 'Switch to Dark Industrial Mode'
              }
              className="group relative flex items-center justify-center p-2 rounded-lg border transition-all duration-200 cursor-pointer active:scale-95 hover:scale-105 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-sm"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
              ) : (
                <Moon className="w-4 h-4 text-blue-600 group-hover:-rotate-12 transition-transform duration-300" />
              )}
              <span className="sr-only">
                {isDark ? 'Switch to Classic Corporate Light Mode' : 'Switch to Dark Industrial Mode'}
              </span>
            </button>
          )}

          {/* User Identity & Logout */}
          {user && (
            <div className="flex items-center space-x-2.5 pl-3 border-l border-slate-200 dark:border-slate-800">
              <button
                onClick={handleOpenProfileModal}
                className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-left cursor-pointer group border border-transparent hover:border-slate-200 dark:hover:border-slate-700/80"
                title="Click to view and edit your profile identity (Name, Mail ID)"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-mono group-hover:border-blue-500 transition-colors shadow-sm">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-200 leading-tight flex items-center space-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                    <span>{user.name}</span>
                    <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-blue-500 dark:text-blue-400 transition-opacity" />
                    {isSuperAdmin && (
                      <span title="Root Administrator">
                        <ShieldCheck className="w-3 h-3 text-rose-500 dark:text-rose-400 inline" />
                      </span>
                    )}
                    {(user.roles?.includes('MD') || user.role === 'MD') && (
                      <span title="Executive Read-Only">
                        <Eye className="w-3 h-3 text-purple-500 dark:text-purple-400 inline" />
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex flex-wrap gap-1">
                    {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map((r) => (
                      <span
                        key={r}
                        className={`px-1.5 py-0.5 rounded text-[9px] border font-semibold ${
                          ROLE_BADGE_STYLES[r] || 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
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
                className="p-2 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800/80 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 text-slate-500 dark:text-slate-400 transition-colors border border-slate-200 dark:border-slate-700/80 shadow-sm"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden transition-colors">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase font-mono">
                  Personal Identity Settings
                </h3>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs Bar */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 px-5 pt-2">
              <button
                type="button"
                onClick={() => setProfileTab('profile')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
                  profileTab === 'profile'
                    ? 'border-[#4F46E5] text-[#4F46E5] dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile & Roles</span>
              </button>

              <button
                type="button"
                onClick={() => setProfileTab('security')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
                  profileTab === 'security'
                    ? 'border-[#4F46E5] text-[#4F46E5] dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Security / Password</span>
              </button>

              <button
                type="button"
                onClick={() => setProfileTab('activity')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
                  profileTab === 'activity'
                    ? 'border-[#4F46E5] text-[#4F46E5] dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Recent Activity</span>
              </button>
            </div>

            {profileTab === 'activity' ? (
              <div className="p-5">
                <RecentActivityFeed compact limit={10} title="My Recent Activity" showRefresh />
              </div>
            ) : profileTab === 'security' ? (
              <form onSubmit={handleChangePassword} className="p-5 space-y-4">
                {pwdError && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-700/60 text-[#BE123C] dark:text-rose-200 text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>{pwdError}</span>
                  </div>
                )}

                {pwdSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-700/60 text-[#047857] dark:text-emerald-200 text-xs flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{pwdSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
                    <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                    <span>Current Password *</span>
                  </label>
                  <PasswordInput
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter your existing password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
                    <KeyRound className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                    <span>New Enterprise Password *</span>
                  </label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Min 8 characters, upper, lower, number, symbol"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
                    <Check className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                    <span>Confirm New Password *</span>
                  </label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter your new password"
                  />
                </div>

                {/* Live Password Complexity Checklist */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Password Complexity Requirement</span>
                    <span className="font-mono text-[10px]">
                      {
                        [
                          newPassword.length >= 8,
                          /[A-Z]/.test(newPassword),
                          /[a-z]/.test(newPassword),
                          /[0-9]/.test(newPassword),
                          /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
                          newPassword.length > 0 && newPassword === confirmPassword,
                        ].filter(Boolean).length
                      }
                      /6 Met
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className={`flex items-center space-x-1.5 ${newPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${newPassword.length >= 8 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>✓</span>
                      <span>8+ characters</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${/[A-Z]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${/[A-Z]/.test(newPassword) ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>✓</span>
                      <span>Uppercase letter</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${/[a-z]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${/[a-z]/.test(newPassword) ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>✓</span>
                      <span>Lowercase letter</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${/[0-9]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${/[0-9]/.test(newPassword) ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>✓</span>
                      <span>At least 1 number</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>✓</span>
                      <span>Special character</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${newPassword.length > 0 && newPassword === confirmPassword ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${newPassword.length > 0 && newPassword === confirmPassword ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>✓</span>
                      <span>Passwords match</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="px-4 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold transition shadow disabled:opacity-50"
                  >
                    {isChangingPassword ? 'Securing...' : 'Update Password'}
                  </button>
                </div>
              </form>
            ) : (
            <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-700/60 text-[#BE123C] dark:text-rose-200 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-700/60 text-[#047857] dark:text-emerald-200 text-xs flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
                  <User className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none"
                  placeholder="e.g. Ramesh Kulkarni"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
                  <Mail className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  <span>Corporate Mail ID *</span>
                </label>
                <input
                  type="email"
                  required
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none"
                  placeholder="name@energyoilfield.com"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  This email is your active ERP login credential across all platforms.
                </p>
              </div>

              {/* Roles Badge List (Read Only) */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                  Assigned Departmental Roles
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map((r) => (
                    <span
                      key={r}
                      className={`px-2 py-0.5 rounded text-[10px] border font-mono font-bold uppercase ${
                        ROLE_BADGE_STYLES[r] || 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold transition shadow disabled:opacity-50"
                >
                  {isSaving ? 'Updating...' : 'Save Identity Changes'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
