'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  RefreshCw,
  KeyRound,
  Building,
  Mail,
  User,
  AlertTriangle,
  X,
  Lock,
  Search,
  Filter,
  Sliders,
  RotateCcw,
  Save,
  Check,
  Info,
  Layers,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SafeUser, Role, ALL_ROLES, CANONICAL_MODULES, ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/lib/auth-types';
import { formatDate, formatDateTime } from '@/lib/formatters';
import PasswordInput from '@/components/PasswordInput';

const ROLE_BADGE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-rose-500/20 text-rose-300 border-rose-600/40',
  ADMIN: 'bg-indigo-500/20 text-indigo-300 border-indigo-600/40',
  MD: 'bg-purple-500/20 text-purple-300 border-purple-600/40',
  PROCUREMENT: 'bg-blue-500/20 text-blue-300 border-blue-600/40',
  MANUFACTURING: 'bg-amber-500/20 text-amber-300 border-amber-600/40',
  SALES: 'bg-orange-500/20 text-orange-300 border-orange-600/40',
  INVENTORY: 'bg-emerald-500/20 text-emerald-300 border-emerald-600/40',
  QUALITY: 'bg-cyan-500/20 text-cyan-300 border-cyan-600/40',
};

export default function UserManagementModule() {
  const { user: currentUser, refetchUser } = useAuth();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Quota & Permission State
  const [nonSuperAdminCount, setNonSuperAdminCount] = useState<number>(0);
  const [canAdminProvision, setCanAdminProvision] = useState<boolean>(false);

  // Active Module Sub-tab: 'users' | 'matrix'
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'matrix'>('users');

  // Matrix State
  const [matrixByRole, setMatrixByRole] = useState<Record<string, Record<string, { id?: string; route_path: string; is_enabled: boolean; can_read: boolean; can_write: boolean }>>>({});
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [selectedMatrixRole, setSelectedMatrixRole] = useState<Role>('PROCUREMENT');
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [matrixDirty, setMatrixDirty] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRoles, setNewRoles] = useState<Role[]>(['PROCUREMENT']);
  const [newDepartment, setNewDepartment] = useState('');
  const [newTempPassword, setNewTempPassword] = useState('EotErp@2026!');
  const [isCreating, setIsCreating] = useState(false);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoles, setEditRoles] = useState<Role[]>(['PROCUREMENT']);
  const [editDepartment, setEditDepartment] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editForcePassword, setEditForcePassword] = useState(false);
  const [editTempPassword, setEditTempPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const isSuperAdmin =
    currentUser?.role === 'SUPER_ADMIN' ||
    (currentUser?.roles && currentUser.roles.includes('SUPER_ADMIN'));

  const isAdmin =
    !isSuperAdmin &&
    (currentUser?.role === 'ADMIN' ||
      (currentUser?.roles && currentUser.roles.includes('ADMIN')));

  const canProvisionUser = isSuperAdmin || canAdminProvision;

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      setUsers(data.users || []);
      if (typeof data.nonSuperAdminCount === 'number') {
        setNonSuperAdminCount(data.nonSuperAdminCount);
      }
      if (typeof data.canAdminProvision === 'boolean') {
        setCanAdminProvision(data.canAdminProvision);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading users');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatrix = async () => {
    setMatrixLoading(true);
    try {
      const res = await fetch('/api/admin/role-permissions?fresh=true');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch permissions');
      if (data.matrixByRole) {
        setMatrixByRole(data.matrixByRole);
        setMatrixDirty(false);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading permissions matrix');
    } finally {
      setMatrixLoading(false);
    }
  };

  const handleToggleModuleEnabled = (role: Role, moduleKey: string) => {
    if (role === 'SUPER_ADMIN') return;
    setMatrixByRole((prev) => {
      const roleMap = { ...prev[role] };
      const current = roleMap[moduleKey] || { is_enabled: false, can_read: false, can_write: false, route_path: `/${moduleKey}` };
      const newEnabled = !current.is_enabled;
      roleMap[moduleKey] = {
        ...current,
        is_enabled: newEnabled,
        can_read: newEnabled,
        can_write: newEnabled ? current.can_write : false,
      };
      return { ...prev, [role]: roleMap };
    });
    setMatrixDirty(true);
  };

  const handleSetWriteMode = (role: Role, moduleKey: string, canWrite: boolean) => {
    if (role === 'SUPER_ADMIN') return;
    setMatrixByRole((prev) => {
      const roleMap = { ...prev[role] };
      const current = roleMap[moduleKey] || { is_enabled: true, can_read: true, can_write: false, route_path: `/${moduleKey}` };
      roleMap[moduleKey] = {
        ...current,
        is_enabled: true,
        can_read: true,
        can_write: canWrite,
      };
      return { ...prev, [role]: roleMap };
    });
    setMatrixDirty(true);
  };

  const handleSaveMatrix = async () => {
    if (selectedMatrixRole === 'SUPER_ADMIN') return;
    setMatrixSaving(true);
    setError(null);
    try {
      const rolePermissions = matrixByRole[selectedMatrixRole] || {};
      const updates = CANONICAL_MODULES.map((mod) => {
        const perm = rolePermissions[mod.key] || {
          is_enabled: false,
          can_read: false,
          can_write: false,
          route_path: mod.route_path,
        };
        return {
          role: selectedMatrixRole,
          module_key: mod.key,
          route_path: perm.route_path || mod.route_path,
          is_enabled: perm.is_enabled,
          can_read: perm.can_read,
          can_write: perm.can_write,
        };
      });

      const res = await fetch('/api/admin/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update permissions');

      setSuccessMsg(`Permissions for role "${ROLE_LABELS[selectedMatrixRole]}" updated successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setMatrixDirty(false);
      await refetchUser();
      fetchMatrix();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMatrixSaving(false);
    }
  };

  const handleResetRole = async (role: Role) => {
    if (role === 'SUPER_ADMIN') return;
    if (!confirm(`Reset all module permissions for role "${ROLE_LABELS[role]}" to their system defaults?`)) {
      return;
    }
    setMatrixSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetRole: role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset role permissions');

      setSuccessMsg(`Role "${ROLE_LABELS[role]}" has been reset to system defaults.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setMatrixDirty(false);
      await refetchUser();
      fetchMatrix();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMatrixSaving(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMatrix();
  }, []);

  const toggleEditRole = (roleToToggle: Role) => {
    if (editRoles.includes(roleToToggle)) {
      if (editRoles.length === 1) {
        setError('User must have at least one assigned role.');
        return;
      }
      setEditRoles(editRoles.filter((r) => r !== roleToToggle));
    } else {
      setEditRoles([...editRoles, roleToToggle]);
    }
  };

  const toggleNewRole = (roleToToggle: Role) => {
    if (newRoles.includes(roleToToggle)) {
      if (newRoles.length === 1) {
        setError('User must have at least one assigned role.');
        return;
      }
      setNewRoles(newRoles.filter((r) => r !== roleToToggle));
    } else {
      setNewRoles([...newRoles, roleToToggle]);
    }
  };

  const generateSecurePassword = () => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*-_=+';
    const all = uppercase + lowercase + numbers + symbols;

    const parts = [
      uppercase[Math.floor(Math.random() * uppercase.length)],
      lowercase[Math.floor(Math.random() * lowercase.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
    ];

    for (let i = parts.length; i < 14; i++) {
      parts.push(all[Math.floor(Math.random() * all.length)]);
    }

    const shuffled = parts.sort(() => Math.random() - 0.5).join('');
    setEditTempPassword(shuffled);
    setEditForcePassword(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProvisionUser) {
      setError(
        'Admin Quota Exceeded: Provisioning is blocked because total non-Super-Admin accounts exceed the limit of 5. Only Super Admins can add accounts.'
      );
      return;
    }

    if (newRoles.length === 0) {
      setError('Please select at least one role for this user.');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          roles: newRoles,
          role: newRoles[0] || 'PROCUREMENT',
          department: newDepartment,
          temporaryPassword: newTempPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      setSuccessMsg(`User ${data.user.email} created. Temporary password: ${newTempPassword}`);
      setTimeout(() => setSuccessMsg(null), 6000);
      setIsAddModalOpen(false);
      setNewEmail('');
      setNewName('');
      setNewRoles(['PROCUREMENT']);
      setNewDepartment('');
      setNewTempPassword('EotErp@2026!');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEdit = (user: SafeUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    const userRoles: Role[] =
      user.roles && user.roles.length > 0
        ? (user.roles as Role[])
        : [(user.role as Role) || 'PROCUREMENT'];
    setEditRoles(userRoles);
    setEditDepartment(user.department || '');
    setEditIsActive(user.is_active);
    setEditForcePassword(user.force_password_change);
    setEditTempPassword('');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editName.trim()) {
      setError('User name cannot be empty.');
      return;
    }

    if (!editEmail.trim()) {
      setError('Corporate email cannot be empty.');
      return;
    }

    if (editRoles.length === 0) {
      setError('User must have at least one assigned role.');
      return;
    }

    setIsUpdating(true);
    setError(null);
    try {
      const updatePayload: any = {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        roles: editRoles,
        role: editRoles[0] || 'PROCUREMENT',
        department: editDepartment,
        is_active: editIsActive,
        force_password_change: editForcePassword,
      };
      if (editForcePassword && editTempPassword.trim()) {
        updatePayload.temporaryPassword = editTempPassword.trim();
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      setSuccessMsg(`Identity & profile for ${data.user.email} updated successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setEditingUser(null);
      setEditTempPassword('');
      fetchUsers();
      if (currentUser?.id === editingUser.id) {
        await refetchUser();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!isSuperAdmin) return;
    if (!confirm(`Are you sure you want to permanently delete user ${email}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');

      setSuccessMsg(data.message || 'User deleted');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const activeCount = users.filter((u) => u.is_active).length;
  const deactivatedCount = users.filter((u) => !u.is_active).length;
  const allAssignedRoles = new Set(
    users.flatMap((u) => (u.roles && u.roles.length > 0 ? u.roles : [u.role]))
  );

  // Available roles in selector:
  // If SUPER_ADMIN: can assign all roles including SUPER_ADMIN
  // If ADMIN: CANNOT assign SUPER_ADMIN
  const availableRoles = isSuperAdmin ? ALL_ROLES : ALL_ROLES.filter((r) => r !== 'SUPER_ADMIN');

  const filteredUsers = users.filter((u) => {
    const userRoles = u.roles && u.roles.length > 0 ? u.roles : [u.role];
    const matchesRole = filterRole === 'ALL' || userRoles.includes(filterRole as Role);
    const matchesSearch =
      searchTerm.trim() === '' ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Enterprise User & Access Management
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase ${
                isSuperAdmin
                  ? 'bg-rose-500/20 text-rose-300 border-rose-600/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-600/40'
              }`}
            >
              {isSuperAdmin ? 'Root Super Admin View' : 'Administrator View'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Departmental RBAC isolation, active session control, and identity governance.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* "Add User" button: Visible for SUPER_ADMIN (unrestricted) & ADMIN (conditioned on count <= 5) */}
          {isSuperAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              title="Super Administrator: Unrestricted account provisioning"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
          )}

          {isAdmin && canAdminProvision && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              title={`Admin Provisioning Quota: ${nonSuperAdminCount}/5 non-Super-Admin accounts active`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New User ({nonSuperAdminCount}/5)</span>
            </button>
          )}

          {isAdmin && !canAdminProvision && (
            <div className="relative">
              <button
                disabled
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-400 border border-amber-600/40 text-xs font-semibold cursor-not-allowed opacity-85"
                title={`Admin Quota Exceeded: Provisioning blocked because non-Super-Admin accounts (${nonSuperAdminCount}) exceed the limit of 5.`}
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Add User (Quota Exceeded: {nonSuperAdminCount}/5)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin Quota Status Banner */}
      {isAdmin && !canAdminProvision && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs flex items-start space-x-3">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-300">
              Admin Provisioning Quota Exceeded ({nonSuperAdminCount}/5 Accounts)
            </div>
            <p className="text-amber-200/80 leading-relaxed text-[11px]">
              Administrators are permitted to provision new users only while total non-Super-Admin accounts remain ≤ 5. The system currently contains <strong>{nonSuperAdminCount}</strong> accounts. Adding further users requires a Super Administrator.
            </p>
          </div>
        </div>
      )}

      {isAdmin && canAdminProvision && (
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-600/40 text-indigo-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              Admin Provisioning Quota Active: <strong>{nonSuperAdminCount}/5</strong> accounts used. You may provision accounts until the count exceeds 5.
            </span>
          </div>
          <span className="font-mono text-[10px] text-indigo-300 uppercase px-2 py-0.5 rounded bg-indigo-900/50 border border-indigo-700/50 font-bold">
            {5 - nonSuperAdminCount} slots remaining
          </span>
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700/60 text-rose-200 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveAdminTab('users')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center space-x-2 border-b-2 cursor-pointer ${
            activeAdminTab === 'users'
              ? 'border-blue-500 text-blue-400 bg-slate-900/80 shadow-sm'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Accounts &amp; Provisioning</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            {users.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveAdminTab('matrix');
            fetchMatrix();
          }}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center space-x-2 border-b-2 cursor-pointer ${
            activeAdminTab === 'matrix'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/80 shadow-sm'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Role &amp; Module Access Matrix</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50 font-mono font-bold">
            Dynamic RBAC
          </span>
        </button>
      </div>

      {activeAdminTab === 'users' && (
        <>
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
            Total Visible Users
          </span>
          <span className="text-xl font-bold text-white font-mono mt-0.5 block">{users.length}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider block">
            Active Accounts
          </span>
          <span className="text-xl font-bold text-emerald-400 font-mono mt-0.5 block">
            {activeCount}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[10px] text-rose-500 uppercase font-bold tracking-wider block">
            Deactivated
          </span>
          <span className="text-xl font-bold text-rose-400 font-mono mt-0.5 block">
            {deactivatedCount}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[10px] text-cyan-500 uppercase font-bold tracking-wider block">
            RBAC Roles Assigned
          </span>
          <span className="text-xl font-bold text-cyan-400 font-mono mt-0.5 block">
            {allAssignedRoles.size}
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search directory by name, email, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Filter by Role:</span>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
          >
            <option value="ALL">ALL ROLES</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
              <tr>
                <th className="px-4 py-3">User & Identity</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Assigned Roles</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Password Policy</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading directory...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition">
                    {/* User & Identity */}
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-white block">{user.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">{user.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3 text-slate-300">
                      {user.department || <span className="text-slate-600">—</span>}
                    </td>

                    {/* Roles */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[240px]">
                        {((user.roles && user.roles.length > 0) ? user.roles : [user.role]).map((r) => (
                          <span
                            key={r}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase inline-block ${
                              ROLE_BADGE_STYLES[r] || 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {user.is_active ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3" />
                          <span>Deactivated</span>
                        </span>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                      {user.last_login_at ? formatDateTime(user.last_login_at) : 'Never'}
                    </td>

                    {/* Password Policy */}
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {user.force_password_change ? (
                        <span className="text-amber-400 font-semibold flex items-center space-x-1">
                          <KeyRound className="w-3 h-3" />
                          <span>Reset on Login</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">Standard</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 text-[11px] font-medium flex items-center space-x-1 transition"
                          title="Edit User Profile"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {/* Delete button: Visible ONLY to Super Admin */}
                        {isSuperAdmin && user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900 text-rose-400 border border-rose-800 text-[11px] font-medium flex items-center space-x-1 transition"
                            title="Delete User"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* ROLE & MODULE ACCESS MATRIX TAB */}
      {activeAdminTab === 'matrix' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Multi-Role Union Notice */}
          <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-600/40 text-blue-200 text-xs flex items-start space-x-3 shadow-sm">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-blue-300 text-sm flex items-center space-x-2">
                <span>Multi-Role Union Permission Architecture</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-900/60 text-blue-200 border border-blue-700/50">
                  Enterprise RBAC
                </span>
              </div>
              <p className="text-blue-200/90 leading-relaxed text-xs">
                When a user is assigned multiple departmental roles (e.g., <code>QUALITY</code> + <code>INVENTORY</code>), the system dynamically calculates the <strong>mathematical union</strong> of all module access rights across those roles. If a module is enabled in <em>any</em> of their active roles, the user is granted access. Write mutations are permitted if <em>at least one</em> matching active role has write permissions enabled.
              </p>
            </div>
          </div>

          {/* Role Selection Tabs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                  Select Role to Configure
                </span>
                <span className="text-[11px] text-slate-500">
                  Toggle modules, assign read-only vs read/write rights, or reset individual roles to factory defaults.
                </span>
              </div>

              {/* Global Matrix Refresh */}
              <button
                type="button"
                onClick={fetchMatrix}
                disabled={matrixLoading}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${matrixLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Matrix</span>
              </button>
            </div>

            {/* Role Pill Selectors */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_ROLES.map((role) => {
                const isSelected = selectedMatrixRole === role;
                const isSuper = role === 'SUPER_ADMIN';
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setSelectedMatrixRole(role);
                      setMatrixDirty(false);
                    }}
                    className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                          ROLE_BADGE_STYLES[role] || 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {role}
                      </span>
                      {isSuper && (
                        <span title="Root IT Protection">
                          <Lock className="w-3.5 h-3.5 text-rose-400" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white truncate">
                      {ROLE_LABELS[role]}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {ROLE_DESCRIPTIONS[role]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Role Configuration Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            {/* Role Panel Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2.5">
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                      ROLE_BADGE_STYLES[selectedMatrixRole] || 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {selectedMatrixRole}
                  </span>
                  <h3 className="text-base font-bold text-white">
                    {ROLE_LABELS[selectedMatrixRole]} Permissions
                  </h3>
                  {matrixDirty && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      Unsaved Changes
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 max-w-2xl">
                  {ROLE_DESCRIPTIONS[selectedMatrixRole]}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2.5 shrink-0">
                {selectedMatrixRole !== 'SUPER_ADMIN' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleResetRole(selectedMatrixRole)}
                      disabled={matrixSaving || matrixLoading}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition cursor-pointer"
                      title={`Reset ${ROLE_LABELS[selectedMatrixRole]} back to initial factory defaults`}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                      <span>Reset to Defaults</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveMatrix}
                      disabled={matrixSaving || matrixLoading || !matrixDirty}
                      className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition shadow-lg ${
                        matrixDirty
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{matrixSaving ? 'Saving...' : 'Save Role Changes'}</span>
                    </button>
                  </>
                ) : (
                  <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
                    <Lock className="w-4 h-4 text-rose-400" />
                    <span className="font-semibold">Root IT Privileges Immutable</span>
                  </div>
                )}
              </div>
            </div>

            {/* Super Admin Notice if selected */}
            {selectedMatrixRole === 'SUPER_ADMIN' && (
              <div className="px-5 py-3 bg-rose-950/30 border-b border-rose-800/40 text-rose-200 text-xs flex items-center space-x-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  SUPER_ADMIN possesses unrestricted core privilege across all current and future modules. To prevent system lockouts, these settings are non-revocable.
                </span>
              </div>
            )}

            {/* Modules Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-mono text-[11px] uppercase">
                    <th className="px-5 py-3.5">ERP Module &amp; Route</th>
                    <th className="px-4 py-3.5">Module Scope &amp; Function</th>
                    <th className="px-4 py-3.5 text-center">Access Status</th>
                    <th className="px-5 py-3.5 text-right">Access Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {CANONICAL_MODULES.map((mod) => {
                    const roleMap = matrixByRole[selectedMatrixRole] || {};
                    const perm = roleMap[mod.key] || {
                      is_enabled: false,
                      can_read: false,
                      can_write: false,
                      route_path: mod.route_path,
                    };
                    const isSuper = selectedMatrixRole === 'SUPER_ADMIN';

                    return (
                      <tr
                        key={mod.key}
                        className={`hover:bg-slate-800/30 transition ${
                          perm.is_enabled ? 'bg-slate-900/40' : 'bg-slate-950/30 opacity-70'
                        }`}
                      >
                        {/* Module Name & Route */}
                        <td className="px-5 py-4">
                          <div className="font-bold text-white text-xs flex items-center space-x-2">
                            <span>{mod.label}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 mt-1">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                              {perm.route_path || mod.route_path}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              [{mod.key}]
                            </span>
                          </div>
                        </td>

                        {/* Description */}
                        <td className="px-4 py-4 text-slate-400 text-xs max-w-sm">
                          {mod.description}
                        </td>

                        {/* Access Status Toggle */}
                        <td className="px-4 py-4 text-center">
                          {isSuper ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                              <Check className="w-3 h-3" />
                              <span>Enabled (Root)</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleModuleEnabled(selectedMatrixRole, mod.key)}
                              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                                perm.is_enabled
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                              }`}
                            >
                              {perm.is_enabled ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Enabled</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Disabled</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Access Mode (Read-Only vs Read/Write) */}
                        <td className="px-5 py-4 text-right">
                          {isSuper ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px] font-bold">
                              <span>Read / Write</span>
                            </span>
                          ) : perm.is_enabled ? (
                            <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950 p-0.5">
                              <button
                                type="button"
                                onClick={() => handleSetWriteMode(selectedMatrixRole, mod.key, false)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center space-x-1 ${
                                  !perm.can_write
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <Eye className="w-3 h-3" />
                                <span>Read-Only</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetWriteMode(selectedMatrixRole, mod.key, true)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center space-x-1 ${
                                  perm.can_write
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Read / Write</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-600 font-mono italic">
                              Not Applicable
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Global Enterprise Permission Matrix Overview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-0">
            <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">
                  Full Enterprise Access Matrix (At a Glance)
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                8 Roles × 10 Modules (80 Permission Points)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] font-mono uppercase text-slate-400">
                    <th className="px-4 py-3 sticky left-0 bg-slate-950/90 z-10">ERP Module</th>
                    {ALL_ROLES.map((r) => (
                      <th key={r} className="px-3 py-3 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[9px] ${
                            ROLE_BADGE_STYLES[r] || 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {r}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                  {CANONICAL_MODULES.map((mod) => (
                    <tr key={mod.key} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-2.5 font-bold text-slate-200 sticky left-0 bg-slate-900/90 z-10 whitespace-nowrap">
                        {mod.label}
                      </td>
                      {ALL_ROLES.map((r) => {
                        const perm = matrixByRole[r]?.[mod.key];
                        if (!perm || !perm.is_enabled) {
                          return (
                            <td key={r} className="px-3 py-2.5 text-center text-slate-600">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 text-slate-500 border border-slate-800/60">
                                Disabled
                              </span>
                            </td>
                          );
                        }
                        if (perm.can_write) {
                          return (
                            <td key={r} className="px-3 py-2.5 text-center">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                                Write
                              </span>
                            </td>
                          );
                        }
                        return (
                          <td key={r} className="px-3 py-2.5 text-center">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 font-semibold">
                              Read
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW USER */}
      {isAddModalOpen && canProvisionUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  {isSuperAdmin
                    ? 'Provision New Enterprise User (Root Super Admin)'
                    : `Provision New Enterprise User (Admin Quota: ${nonSuperAdminCount}/5)`}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kulkarni"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Corporate Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="r.kulkarni@energyoilfield.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Department Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sourcing / Plant / QA"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Assigned Roles * (Multi-Role Support)
                  </label>
                  <span className="text-[10px] text-blue-400 font-mono font-semibold">
                    {newRoles.length} selected
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">
                  Select one or more operational roles. The user receives aggregated module access.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {availableRoles.map((r) => {
                    const isSelected = newRoles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleNewRole(r)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition cursor-pointer ${
                          isSelected
                            ? `${ROLE_BADGE_STYLES[r]} border-current font-bold shadow-sm`
                            : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <span className="font-mono text-[11px]">{r}</span>
                        {isSelected ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Temporary Initial Password *
                </label>
                <PasswordInput
                  required
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  placeholder="Enter initial temporary password..."
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Account will be provisioned with <strong>Reset on First Login</strong> flag active.
                </p>
              </div>

              </div>

              {/* Persistent Sticky Footer */}
              <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-end space-x-2 shrink-0 z-10 shadow-lg">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1.5"
                >
                  {isCreating ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <span>Provision User</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER PROFILE */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  Edit User Identity: {editingUser.name}
                </h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {/* User Identity Section */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-400 uppercase font-mono tracking-wider">
                  <User className="w-3.5 h-3.5" />
                  <span>User Identity & Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kulkarni"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Corporate Mail ID *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="r.kulkarni@energyoilfield.com"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Department / Unit Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Quality Assurance / Sourcing / Plant"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Assigned Roles * (Multi-Role Support)
                  </label>
                  <span className="text-[10px] text-blue-400 font-mono font-semibold">
                    {editRoles.length} selected
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">
                  Select one or more roles. The user receives combined permissions across all assigned roles.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {availableRoles.map((r) => {
                    const isSelected = editRoles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleEditRole(r)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition cursor-pointer ${
                          isSelected
                            ? `${ROLE_BADGE_STYLES[r]} border-current font-bold shadow-sm`
                            : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <span className="font-mono text-[11px]">{r}</span>
                        {isSelected ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status & Security Toggles */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Account Active</span>
                    <span className="text-[10px] text-slate-500 block">
                      Deactivating revokes all active database sessions immediately.
                    </span>
                  </div>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForcePassword}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditForcePassword(checked);
                      if (!checked) {
                        setEditTempPassword('');
                      }
                    }}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      Force Password Change on Next Login
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      User will be required to set a new password before accessing ERP modules.
                    </span>
                  </div>
                </label>
              </div>

              {/* Administrative Section: Security & Credentials Reset (Shown ONLY if Force Password Change is ticked) */}
              {editForcePassword && (
                <div className="bg-slate-950/80 border border-amber-600/30 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-200 uppercase font-mono">
                        Security &amp; Credentials Reset
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={generateSecurePassword}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition cursor-pointer"
                      title="Generate a cryptographically complex temporary password"
                    >
                      <RefreshCw className="w-3 h-3 text-indigo-400" />
                      <span>Generate Secure Password</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Set Temporary Password
                    </label>
                    <PasswordInput
                      value={editTempPassword}
                      onChange={(e) => setEditTempPassword(e.target.value)}
                      placeholder="Leave blank to preserve current credentials..."
                      className="font-mono text-xs"
                      autoComplete="new-password"
                    />
                    <p className="text-[10px] text-amber-300/90 mt-2 leading-relaxed bg-amber-950/30 border border-amber-800/30 rounded-lg p-2.5 flex items-start space-x-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Setting a temporary password will immediately overwrite the existing hash and set the &apos;Reset on First Login&apos; flag so the user is forced to choose a new password upon next sign-in.
                      </span>
                    </p>
                  </div>
                </div>
              )}

              </div>

              {/* Persistent Sticky Footer */}
              <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-end space-x-2 shrink-0 z-10 shadow-lg">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1.5"
                >
                  {isUpdating ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Profile Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
