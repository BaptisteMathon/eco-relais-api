/**
 * User model – CRUD and auth helpers
 */

import { pool } from '../config/db';
import { User as UserType, UserRole } from '../types';
import { generateId } from '../utils/helpers';

export async function createUser(data: {
  email: string;
  password_hash: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone?: string;
  address_lat?: number;
  address_lng?: number;
  stripe_account_id?: string;
}): Promise<UserType> {
  const id = generateId();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone, address_lat, address_lng, stripe_account_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      data.email,
      data.password_hash,
      data.role,
      data.first_name,
      data.last_name,
      data.phone ?? null,
      data.address_lat ?? null,
      data.address_lng ?? null,
      data.stripe_account_id ?? null,
    ]
  );
  return getById(id) as Promise<UserType>;
}

export async function getById(id: string): Promise<UserType | null> {
  const res = await pool.query<UserType>(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return res.rows[0] ?? null;
}

export async function getByEmail(email: string): Promise<UserType | null> {
  const res = await pool.query<UserType>(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return res.rows[0] ?? null;
}

export async function updateUser(
  id: string,
  data: Partial<{
    first_name: string;
    last_name: string;
    phone: string;
    address: string;
    address_lat: number;
    address_lng: number;
    verified: boolean;
    stripe_account_id: string;
  }>
): Promise<UserType | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.first_name !== undefined) {
    fields.push(`first_name = $${i++}`);
    values.push(data.first_name);
  }
  if (data.last_name !== undefined) {
    fields.push(`last_name = $${i++}`);
    values.push(data.last_name);
  }
  if (data.phone !== undefined) {
    fields.push(`phone = $${i++}`);
    values.push(data.phone);
  }
  if (data.address !== undefined) {
    fields.push(`address = $${i++}`);
    values.push(data.address);
  }
  if (data.address_lat !== undefined) {
    fields.push(`address_lat = $${i++}`);
    values.push(data.address_lat);
  }
  if (data.address_lng !== undefined) {
    fields.push(`address_lng = $${i++}`);
    values.push(data.address_lng);
  }
  if (data.verified !== undefined) {
    fields.push(`verified = $${i++}`);
    values.push(data.verified);
  }
  if (data.stripe_account_id !== undefined) {
    fields.push(`stripe_account_id = $${i++}`);
    values.push(data.stripe_account_id);
  }
  if (fields.length === 0) return getById(id);

  values.push(id);
  await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}`,
    values
  );
  return getById(id);
}
