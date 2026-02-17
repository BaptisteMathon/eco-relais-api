/**
 * Admin: stats, users list, missions list, disputes stub
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/db';
import { ForbiddenError } from '../utils/errors';

/** GET /api/admin/users – list users with optional role filter and pagination */
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ForbiddenError('Admin only'));
    }

    const role = req.query.role as string | undefined;
    const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 20), 10)));
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

/** GET /api/admin/stats – total users, active missions, platform revenue */
export async function stats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ForbiddenError('Admin only'));
    }

    const [usersRes, activeRes, revenueRes] = await Promise.all([
      pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users'),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM missions
         WHERE status NOT IN ('delivered', 'cancelled')`
      ),
      pool.query<{ sum: string }>(
        `SELECT COALESCE(SUM(commission), 0)::numeric::text AS sum FROM missions WHERE status = 'delivered'`
      ),
    ]);

    const total_users = parseInt(usersRes.rows[0]?.count ?? '0', 10);
    const active_missions = parseInt(activeRes.rows[0]?.count ?? '0', 10);
    const revenue = parseFloat(revenueRes.rows[0]?.sum ?? '0');

    res.json({
      success: true,
      total_users,
      active_missions,
      revenue,
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

/** GET /api/admin/disputes – list disputes (stub: no table yet, returns empty array) */
export async function listDisputes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ForbiddenError('Admin only'));
    }
    res.json([]);
  } catch (e) {
    next(e);
  }
}
