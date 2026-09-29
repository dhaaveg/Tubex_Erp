'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  Clock,
  User,
  Shield,
  Globe,
  CheckCircle2,
  AlertCircle,
  FileText,
  Wrench,
  Key,
  ShieldAlert,
  ArrowRight,
  Database,
  ExternalLink,
} from 'lucide-react';

export interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  ip_address: string;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
  };
}

interface RecentActivityFeedProps {
  limit?: number;
  compact?: boolean;
  title?: string;
  showRefresh?: boolean;
  onViewAll?: () => void;
}

const ACTION_CONFIG: Record<
  string,
  { label: string; badge: string; icon: React.ComponentType<{ className?: string }> }
> = {
  LOGIN: {
    label: 'Login',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
  LOGOUT: {
    label: 'Logout',
    badge: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    icon: Clock,
  },
  SESSION_TIMEOUT: {
    label: 'Timeout',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    icon: ShieldAlert,
  },
  PASSWORD_CHANGED: {
    label: 'Pwd Change',
    badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    icon: Key,
  },
  ADMIN_PASSWORD_RESET: {
    label: 'Admin Reset',
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    icon: Key,
  },
  PO_CREATED: {
    label: 'PO Created',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    icon: FileText,
  },
  WO_RELEASED: {
    label: 'WO Released',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    icon: Wrench,
  },
  QUALITY_INSPECTION: {
    label: 'QA Inspection',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    icon: Shield,
  },
  USER_CREATED: {
    label: 'User Created',
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    icon: User,
  },
  USER_UPDATED: {
    label: 'User Updated',
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    icon: User,
  },
  USER_DELETED: {
    label: 'User Deleted',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    icon: AlertCircle,
  },
  USER_DEACTIVATED: {
    label: 'User Deactivated',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    icon: AlertCircle,
  },
  USER_ACTIVATED: {
    label: 'User Activated',
    badge: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    icon: CheckCircle2,
  },
  ROLE_PERMISSIONS_UPDATED: {
    label: 'Permissions',
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    icon: Shield,
  },
};

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 45) return 'Just now';
    if (diffSec < 90) return '1 minute ago';
    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return `${mins} minutes ago`;
    }
    if (diffSec < 7200) return '1 hour ago';
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return `${hours} hours ago`;
    }
    if (diffSec < 172800) return 'Yesterday';
    const days = Math.floor(diffSec / 86400);
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recently';
  }
}

export default function RecentActivityFeed({
  limit = 15,
  compact = false,
  title = 'Recent Activity',
  showRefresh = true,
  onViewAll,
}: RecentActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const res = await fetch(`/api/activity/recent?limit=${limit}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error('Failed to load recent activity feed');
      }

      const data = await res.json();
      setActivities(data.activities || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching activity log');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl ${
        compact ? 'p-3' : 'p-5'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
            {!compact && (
              <p className="text-[11px] text-slate-400">
                Real-time operational audit trail & security events
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 border border-emerald-800/80 text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Audit</span>
          </span>

          {showRefresh && (
            <button
              onClick={() => fetchActivities(true)}
              disabled={isRefreshing}
              title="Refresh Activity Feed"
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Body / List */}
      {isLoading ? (
        <div className="space-y-3 py-3">
          {[...Array(compact ? 3 : 5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center space-x-3 p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
              <div className="w-6 h-6 rounded-md bg-slate-800" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-800 rounded w-1/3" />
                <div className="h-2.5 bg-slate-850 rounded w-2/3" />
              </div>
              <div className="h-2.5 bg-slate-800 rounded w-16" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
          <p className="text-xs text-slate-400 font-medium">No recent activity recorded.</p>
        </div>
      ) : (
        <div className={`space-y-2.5 overflow-y-auto ${compact ? 'max-h-[280px]' : 'max-h-[460px]'} pr-1`}>
          {activities.map((item) => {
            const config = ACTION_CONFIG[item.action] || {
              label: item.action.replace(/_/g, ' '),
              badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
              icon: Activity,
            };
            const ActionIcon = config.icon;

            return (
              <div
                key={item.id}
                className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/90 transition-all duration-150 gap-2"
              >
                {/* Left section: Action badge + Actor info + Summary */}
                <div className="flex items-start sm:items-center space-x-3 min-w-0">
                  <div className="mt-0.5 sm:mt-0 p-1.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                    <ActionIcon className="w-3.5 h-3.5 text-slate-300" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${config.badge}`}
                      >
                        {config.label}
                      </span>

                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {item.user.name}
                      </span>

                      <span className="text-[10px] text-slate-500 font-medium truncate">
                        • {item.user.department} ({item.user.role})
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-1 leading-snug">
                      {item.summary}
                    </p>
                  </div>
                </div>

                {/* Right section: Timestamp & IP Address */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-800/50 text-[10px] text-slate-500 space-y-0.5 font-mono">
                  <div className="flex items-center space-x-1 text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formatRelativeTime(item.created_at)}</span>
                  </div>

                  {item.ip_address && item.ip_address !== 'local' && (
                    <div className="flex items-center space-x-1 text-slate-600">
                      <Globe className="w-2.5 h-2.5 text-slate-600" />
                      <span>{item.ip_address}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer link if onViewAll provided */}
      {onViewAll && (
        <div className="pt-3 mt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center space-x-1 transition cursor-pointer"
          >
            <span>View Full Audit Log</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
