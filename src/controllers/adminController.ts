/**
 * Admin: stats, users list, missions list, disputes list and resolve
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/db';
import * as DisputeModel from '../models/Dispute';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import type { DisputeStatus } from '../types';

/** GET /api/admin/users – list users with optional role filter and pagination */
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ForbiddenError('Admin only'));
    }

    const role = req.query.role as string | undefined;
    const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 15), 10)));
    const offset = (page - 1) * limit;

    const validRoles = ['client', 'partner', 'admin'];
    const hasRoleFilter = role && validRoles.includes(role);

    const countQuery = hasRoleFilter
      ? pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users WHERE role = $1', [role])
      : pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
    const countResult = await countQuery;
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const listQuery = hasRoleFilter
      ? pool.query(
          `SELECT id, email, role, first_name, last_name, phone, address_lat, address_lng, created_at, verified, stripe_account_id
           FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [role, limit, offset]
        )
      : pool.query(
          `SELECT id, email, role, first_name, last_name, phone, address_lat, address_lng, created_at, verified, stripe_account_id
           FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
    const listResult = await listQuery;
    const data = listResult.rows.map((row) => ({
      ...row,
      password_hash: undefined,
      stripe_account_id: row.stripe_account_id ? '[REDACTED]' : null,
    }));

    res.json({
      success: true,
      data,
      total,
      page,
      limit,
    });
  } catch (e) {
    next(e);
  }
}

/** GET /api/admin/stats – total users, active missions, platform revenue, 6-month growth */
export async function stats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ForbiddenError('Admin only'));
    }

    const sixMonthsAgo = `date_trunc('month', CURRENT_DATE) - interval '6 months'`;

    const [usersRes, activeRes, revenueRes, usersBeforeWindowRes, newUsersByMonthRes, revenueByMonthRes] =
      await Promise.all([
        pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users'),
        pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM missions
           WHERE status NOT IN ('delivered', 'cancelled')`
        ),
        pool.query<{ sum: string }>(
          `SELECT COALESCE(SUM(commission), 0)::numeric::text AS sum FROM missions WHERE status = 'delivered'`
        ),
        pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM users WHERE created_at < ${sixMonthsAgo}`
        ),
        pool.query<{ month: string; new_users: string }>(
          `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*)::text AS new_users
           FROM users WHERE created_at >= ${sixMonthsAgo}
           GROUP BY date_trunc('month', created_at) ORDER BY 1`
        ),
        pool.query<{ month: string; revenue: string }>(
          `SELECT to_char(date_trunc('month', completed_at), 'YYYY-MM') AS month, COALESCE(SUM(commission), 0)::numeric::text AS revenue
           FROM missions WHERE status = 'delivered' AND completed_at IS NOT NULL AND completed_at >= ${sixMonthsAgo}
           GROUP BY date_trunc('month', completed_at) ORDER BY 1`
        ),
      ]);

    const total_users = parseInt(usersRes.rows[0]?.count ?? '0', 10);
    const active_missions = parseInt(activeRes.rows[0]?.count ?? '0', 10);
    const revenue = parseFloat(revenueRes.rows[0]?.sum ?? '0');
    let cumulativeUsers = parseInt(usersBeforeWindowRes.rows[0]?.count ?? '0', 10);

    const newUsersMap = new Map<string, number>();
    for (const row of newUsersByMonthRes.rows ?? []) {
      newUsersMap.set(row.month, parseInt(row.new_users ?? '0', 10));
    }
    const revenueMap = new Map<string, number>();
    for (const row of revenueByMonthRes.rows ?? []) {
      revenueMap.set(row.month, parseFloat(row.revenue ?? '0'));
    }

    const growth: { month: string; users: number; revenue: number }[] = [];
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    for (const month of monthKeys) {
      cumulativeUsers += newUsersMap.get(month) ?? 0;
      growth.push({
        month,
        users: cumulativeUsers,
        revenue: revenueMap.get(month) ?? 0,
      });
    }

    res.json({
      success: true,
      total_users,
      active_missions,
      revenue,
      growth,
    });
  } catch (e) {
    next(e);
  }
}

/** GET /api/admin/missions – list all missions with optional status filter */
export async function listMissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ForbiddenError('Admin only'));
    }

    const status = req.query.status as string | undefined;
    const validStatuses = ['pending', 'accepted', 'collected', 'in_transit', 'delivered', 'cancelled'];
    const hasStatus = status && validStatuses.includes(status);

    const missions = hasStatus
      ? await pool.query(
          'SELECT * FROM missions WHERE status = $1 ORDER BY created_at DESC LIMIT 500',
          [status]
        )
      : await pool.query('SELECT * FROM missions ORDER BY created_at DESC LIMIT 500');

    const data = missions.rows;
    res.json({
      success: true,
      data,
      total: data.length,
      page: 1,
      limit: 500,
    });
  } catch (e) {
    next(e);
  }
}

/** GET /api/admin/disputes – list all disputes (optional status filter) */
export async function listDisputes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ForbiddenError('Admin only'));
    }
    const status = req.query.status as DisputeStatus | undefined;
    const disputes = await DisputeModel.listAll(
      status && ['open', 'in_review', 'resolved'].includes(status) ? { status } : undefined
    );
    res.json({ success: true, disputes });
  } catch (e) {
    next(e);
  }
}

/** PATCH /api/admin/disputes/:id/resolve – resolve a dispute */
export async function resolveDispute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ForbiddenError('Admin only'));
    }
    const { id } = req.params;
    const { resolution } = req.body as { resolution: string };
    const dispute = await DisputeModel.getById(id);
    if (!dispute) return next(new NotFoundError('Dispute not found'));
    const updated = await DisputeModel.resolveDispute(id, resolution, req.user.userId);
    res.json({ success: true, dispute: updated });
  } catch (e) {
    next(e);
  }
}
