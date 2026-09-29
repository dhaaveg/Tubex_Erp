import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid session required to view activity logs.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const offset = (page - 1) * limit;
    const actionFilter = searchParams.get('action');

    const userRoles =
      current.user.roles && current.user.roles.length > 0
        ? current.user.roles
        : [current.user.role];

    const isAdminOrExecutive = userRoles.some((r) =>
      ['SUPER_ADMIN', 'ADMIN', 'MD'].includes(r)
    );

    const where: any = {};

    // Standard non-admin users can only view their own activity history
    if (!isAdminOrExecutive) {
      where.user_id = current.user.id;
    }

    if (actionFilter) {
      where.action = actionFilter;
    }

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
          } else if (parsedDetails.wo_id) {
            detailSummary = `Work Order ${parsedDetails.wo_id}${
              parsedDetails.grade ? ` • Grade ${parsedDetails.grade}` : ''
            }${parsedDetails.planned_parts ? ` (${parsedDetails.planned_parts} pcs)` : ''}`;
          } else if (parsedDetails.stage_name) {
            detailSummary = `Routing: ${parsedDetails.stage_name} (Acc: ${parsedDetails.accepted ?? 0}, Rej: ${parsedDetails.rejected ?? 0})`;
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
              name: log.user.name,
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
      { error: error.message || 'Internal server error while fetching activities' },
      { status: 500 }
    );
  }
}
