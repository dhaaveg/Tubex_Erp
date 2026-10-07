import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentSession,
  getAuditLogQueryWhere,
  getAuditFeedScopeMeta,
  maskAuthorIdentity,
} from '@/lib/auth';
import { withApiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request: Request) => {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid session required to view activity logs.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const offset = (page - 1) * limit;
    const actionFilter = searchParams.get('action');

    // Strict hierarchical query filtering enforced at the database layer:
    // - SUPER_ADMIN: Unrestricted system & governance audit logs
    // - ADMIN: Operational events across all plant departments; strict exclusion of SUPER_ADMIN actors and sensitive actions
    // - Standard Users: Only their individual activity history (user_id === current.user.id)
    const where = await getAuditLogQueryWhere(current.user, { actionFilter });
    const scopeMeta = getAuditFeedScopeMeta(current.user.role, current.user.roles);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              roles: true,
              department: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const formattedActivities = logs.map((log) => {
      let parsedDetails: any = null;
      let detailSummary = '';

      if (log.details) {
        try {
          parsedDetails = JSON.parse(log.details);
          if (typeof parsedDetails === 'string') {
            detailSummary = parsedDetails;
          } else if (parsedDetails.summary) {
            detailSummary = parsedDetails.summary;
          } else if (parsedDetails.reason) {
            detailSummary = parsedDetails.reason;
          } else if (parsedDetails.po_no) {
            detailSummary = `Purchase Order ${parsedDetails.po_no}${
              parsedDetails.supplier ? ` • ${parsedDetails.supplier}` : ''
            }${parsedDetails.total_value ? ` ($${Number(parsedDetails.total_value).toLocaleString()})` : ''}`;
          } else if (parsedDetails.grn_no) {
            detailSummary = `GRN ${parsedDetails.grn_no}${
              parsedDetails.heat_no ? ` • Heat ${parsedDetails.heat_no}` : ''
            }${parsedDetails.pipes_received ? ` (${parsedDetails.pipes_received} pipes)` : ''}`;
          } else if (parsedDetails.cpo_no) {
            detailSummary = `Customer Order ${parsedDetails.cpo_no}${
              parsedDetails.customer_name ? ` • ${parsedDetails.customer_name}` : ''
            }`;
          } else if (parsedDetails.dispatch_no) {
            detailSummary = `Dispatch ${parsedDetails.dispatch_no}${
              parsedDetails.destination ? ` • Destination: ${parsedDetails.destination}` : ''
            }`;
          } else if (parsedDetails.wo_id) {
            detailSummary = `Work Order ${parsedDetails.wo_id}${
              parsedDetails.grade ? ` • Grade ${parsedDetails.grade}` : ''
            }${parsedDetails.planned_parts ? ` (${parsedDetails.planned_parts} pcs)` : ''}`;
          } else if (parsedDetails.stage_name) {
            detailSummary = `Routing: ${parsedDetails.stage_name} (Acc: ${parsedDetails.accepted ?? 0}, Rej: ${parsedDetails.rejected ?? 0})`;
          } else if (parsedDetails.defect_type) {
            detailSummary = `QA Defect: ${parsedDetails.defect_type}${
              parsedDetails.part_id ? ` on Part ${parsedDetails.part_id}` : ''
            }`;
          } else if (parsedDetails.target_email || parsedDetails.target_name) {
            detailSummary = `User ${parsedDetails.target_name || parsedDetails.target_email} (${parsedDetails.target_role || 'Member'})`;
          } else if (parsedDetails.email) {
            detailSummary = `Account: ${parsedDetails.email}`;
          } else {
            detailSummary = Object.entries(parsedDetails)
              .filter(([_, v]) => typeof v === 'string' || typeof v === 'number')
              .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
              .join(' • ');
          }
        } catch {
          detailSummary = log.details;
        }
      }

      if (!detailSummary) {
        detailSummary = `${log.action.replace(/_/g, ' ')} on ${log.entity_type || 'System'}${
          log.entity_id ? ` (${log.entity_id})` : ''
        }`;
      }

      return {
        id: log.id,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        details: parsedDetails,
        summary: detailSummary,
        ip_address: log.ip_address || '127.0.0.1',
        created_at: log.created_at.toISOString(),
        user: log.user
          ? {
              id: log.user.id,
              name: maskAuthorIdentity(log.user.name, log.user.role, current.user.role, undefined, current.user.roles),
              email: log.user.email,
              role: log.user.role,
              department: log.user.department || 'Operations',
            }
          : {
              id: 'system',
              name: 'System Automation',
              email: 'system@energyoilfield.com',
              role: 'SYSTEM',
              department: 'Core ERP',
            },
      };
    });

    return NextResponse.json({
      success: true,
      activities: formattedActivities,
      feedScope: scopeMeta.scope,
      feedLabel: scopeMeta.label,
      feedDescription: scopeMeta.description,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching recent activities:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error while fetching activities' },
      { status: 500 }
    );
  }
});
