/**
 * Transaction model – payment records for partner earnings
 */

import { pool } from '../config/db';
import { Transaction as TransactionType, TransactionStatus } from '../types';
import { generateId } from '../utils/helpers';

export async function createTransaction(data: {
  mission_id: string;
  partner_id: string;
  amount: number;
  stripe_payment_intent?: string;
  status?: TransactionStatus;
}): Promise<TransactionType> {
  const id = generateId();
  await pool.query(
    `INSERT INTO transactions (id, mission_id, partner_id, amount, stripe_payment_intent, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      data.mission_id,
      data.partner_id,
      data.amount,
      data.stripe_payment_intent ?? null,
      data.status ?? 'pending',
    ]
  );
  const res = await pool.query<TransactionType>('SELECT * FROM transactions WHERE id = $1', [id]);
  return res.rows[0];
}

export async function getById(id: string): Promise<TransactionType | null> {
  const res = await pool.query<TransactionType>('SELECT * FROM transactions WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function getByMissionId(missionId: string): Promise<TransactionType | null> {
  const res = await pool.query<TransactionType>(
    'SELECT * FROM transactions WHERE mission_id = $1 LIMIT 1',
    [missionId]
  );
  return res.rows[0] ?? null;
}

export async function listByPartnerId(partnerId: string): Promise<TransactionType[]> {
  const res = await pool.query<TransactionType>(
    'SELECT * FROM transactions WHERE partner_id = $1 ORDER BY created_at DESC',
    [partnerId]
  );
  return res.rows;
}

export async function updateStatus(
  id: string,
  status: TransactionStatus
): Promise<TransactionType | null> {
  await pool.query('UPDATE transactions SET status = $2 WHERE id = $1', [id, status]);
  return getById(id);
}

export async function updateStatusByMissionId(
  missionId: string,
  status: TransactionStatus
): Promise<void> {
  await pool.query('UPDATE transactions SET status = $2 WHERE mission_id = $1', [
    missionId,
    status,
  ]);
}

/** Sum completed earnings for a partner */
export async function sumPartnerEarnings(partnerId: string): Promise<number> {
  const res = await pool.query<{ sum: string }>(
    "SELECT COALESCE(SUM(amount), 0)::numeric AS sum FROM transactions WHERE partner_id = $1 AND status = 'completed'",
    [partnerId]
  );
  return parseFloat(res.rows[0]?.sum ?? '0');
}
