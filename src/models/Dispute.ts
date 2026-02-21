/**
 * Dispute model – create, list, resolve
 */

import { pool } from '../config/db';
import { Dispute as DisputeType, DisputeStatus } from '../types';
import { generateId } from '../utils/helpers';

export async function createDispute(data: {
  mission_id: string;
  raised_by: string;
  reason: string;
}): Promise<DisputeType> {
  const id = generateId();
  await pool.query(
    `INSERT INTO disputes (id, mission_id, raised_by, reason)
     VALUES ($1, $2, $3, $4)`,
    [id, data.mission_id, data.raised_by, data.reason]
  );
  const res = await pool.query<DisputeType>('SELECT * FROM disputes WHERE id = $1', [id]);
  return res.rows[0];
}

export async function getById(id: string): Promise<DisputeType | null> {
  const res = await pool.query<DisputeType>('SELECT * FROM disputes WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function listAll(options?: { status?: DisputeStatus }): Promise<DisputeType[]> {
  if (options?.status) {
    const res = await pool.query<DisputeType>(
      'SELECT * FROM disputes WHERE status = $1 ORDER BY created_at DESC',
      [options.status]
    );
    return res.rows;
  }
  const res = await pool.query<DisputeType>(
    'SELECT * FROM disputes ORDER BY created_at DESC'
  );
  return res.rows;
}

export async function resolveDispute(
  id: string,
  resolution: string,
  resolved_by: string
): Promise<DisputeType | null> {
  await pool.query(
    `UPDATE disputes SET status = 'resolved', resolution = $2, resolved_by = $3, resolved_at = NOW() WHERE id = $1`,
    [id, resolution, resolved_by]
  );
  return getById(id);
}
