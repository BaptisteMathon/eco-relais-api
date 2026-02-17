/**
 * Notification model
 */

import { pool } from '../config/db';
import { Notification as NotificationType } from '../types';
import { generateId } from '../utils/helpers';

export async function create(data: {
  user_id: string;
  type: string;
  message: string;
}): Promise<NotificationType> {
  const id = generateId();
  await pool.query(
    'INSERT INTO notifications (id, user_id, type, message) VALUES ($1, $2, $3, $4)',
    [id, data.user_id, data.type, data.message]
  );
  const res = await pool.query<NotificationType>('SELECT * FROM notifications WHERE id = $1', [
    id,
  ]);
  return res.rows[0];
}

export async function getById(id: string): Promise<NotificationType | null> {
  const res = await pool.query<NotificationType>('SELECT * FROM notifications WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function listByUserId(userId: string): Promise<NotificationType[]> {
  const res = await pool.query<NotificationType>(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return res.rows;
}

export async function markAsRead(id: string, userId: string): Promise<NotificationType | null> {
  await pool.query('UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ]);
  return getById(id);
}

export async function markAllAsRead(userId: string): Promise<void> {
  await pool.query('UPDATE notifications SET read = TRUE WHERE user_id = $1', [userId]);
}
