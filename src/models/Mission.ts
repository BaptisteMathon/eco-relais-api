/**
 * Mission model – CRUD and geospatial queries (PostGIS)
 */

import { pool } from '../config/db';
import { Mission as MissionType, MissionStatus, PackageSize } from '../types';
import { generateId } from '../utils/helpers';

export async function createMission(data: {
  client_id: string;
  package_photo_url?: string;
  package_title: string;
  package_size: PackageSize;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  pickup_time_slot: string;
  price: number;
  commission: number;
  qr_code?: string;
}): Promise<MissionType> {
  const id = generateId();
  await pool.query(
    `INSERT INTO missions (
      id, client_id, package_photo_url, package_title, package_size,
      pickup_address, pickup_lat, pickup_lng, delivery_address, delivery_lat, delivery_lng,
      pickup_time_slot, price, commission, qr_code
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      id,
      data.client_id,
      data.package_photo_url ?? null,
      data.package_title,
      data.package_size,
      data.pickup_address,
      data.pickup_lat,
      data.pickup_lng,
      data.delivery_address,
      data.delivery_lat,
      data.delivery_lng,
      data.pickup_time_slot,
      data.price,
      data.commission,
      data.qr_code ?? null,
    ]
  );
  return getById(id) as Promise<MissionType>;
}

export async function getById(id: string): Promise<MissionType | null> {
  const res = await pool.query<MissionType>(
    `SELECT m.*,
       c.first_name AS client_first_name,  c.last_name AS client_last_name,
       p.first_name AS partner_first_name, p.last_name AS partner_last_name
     FROM missions m
     LEFT JOIN users c ON c.id = m.client_id
     LEFT JOIN users p ON p.id = m.partner_id
     WHERE m.id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
}

/** List missions for a client — joins partner name when assigned */
export async function listByClientId(clientId: string): Promise<MissionType[]> {
  const res = await pool.query<MissionType>(
    `SELECT m.*,
       p.first_name AS partner_first_name, p.last_name AS partner_last_name
     FROM missions m
     LEFT JOIN users p ON p.id = m.partner_id
     WHERE m.client_id = $1
     ORDER BY m.created_at DESC`,
    [clientId]
  );
  return res.rows;
}

/** List nearby available missions for partners within radiusMeters (PostGIS when available, else approximate) */
export async function listNearbyAvailable(
  lat: number,
  lng: number,
  radiusMeters: number = 1000
): Promise<MissionType[]> {
  const degRadius = radiusMeters / 111000; // ~111km per degree
  const degRadiusSq = degRadius * degRadius;
  const radiusNum = Number(radiusMeters); // safe to interpolate (number)
  try {
    const res = await pool.query<MissionType>(
      `SELECT m.*,
         c.first_name AS client_first_name, c.last_name AS client_last_name
       FROM missions m
       LEFT JOIN users c ON c.id = m.client_id
       WHERE m.status = 'pending'
       AND ST_DWithin(
         ST_MakePoint(m.pickup_lng, m.pickup_lat)::geography,
         ST_MakePoint($2, $1)::geography,
         ${radiusNum}
       )
       ORDER BY ST_Distance(
         ST_MakePoint(m.pickup_lng, m.pickup_lat)::geography,
         ST_MakePoint($2, $1)::geography
       )
       LIMIT 50`,
      [lat, lng]
    );
    return res.rows;
  } catch {
    // Fallback when PostGIS is not installed: approximate distance (degrees)
    const res = await pool.query<MissionType>(
      `SELECT m.*,
         c.first_name AS client_first_name, c.last_name AS client_last_name
       FROM missions m
       LEFT JOIN users c ON c.id = m.client_id
       WHERE m.status = 'pending'
       AND (m.pickup_lat - $1) * (m.pickup_lat - $1) + (m.pickup_lng - $2) * (m.pickup_lng - $2) <= $3
       ORDER BY (m.pickup_lat - $1) * (m.pickup_lat - $1) + (m.pickup_lng - $2) * (m.pickup_lng - $2)
       LIMIT 50`,
      [lat, lng, degRadiusSq]
    );
    return res.rows;
  }
}

/** List missions assigned to a partner — joins client name */
export async function listByPartnerId(partnerId: string): Promise<MissionType[]> {
  const res = await pool.query<MissionType>(
    `SELECT m.*,
       c.first_name AS client_first_name, c.last_name AS client_last_name
     FROM missions m
     LEFT JOIN users c ON c.id = m.client_id
     WHERE m.partner_id = $1
     ORDER BY m.created_at DESC`,
    [partnerId]
  );
  return res.rows;
}

export async function updateMissionStatus(
  id: string,
  status: MissionStatus,
  partnerId?: string,
  completedAt?: Date
): Promise<MissionType | null> {
  const updates: string[] = ['status = $2'];
  const values: unknown[] = [id, status];
  let i = 3;
  if (partnerId !== undefined) {
    updates.push(`partner_id = $${i++}`);
    values.push(partnerId);
  }
  if (completedAt !== undefined) {
    updates.push(`completed_at = $${i++}`);
    values.push(completedAt);
  }
  await pool.query(
    `UPDATE missions SET ${updates.join(', ')} WHERE id = $1`,
    values
  );
  return getById(id);
}

export async function setPartner(id: string, partnerId: string): Promise<MissionType | null> {
  await pool.query(
    "UPDATE missions SET partner_id = $2, status = 'accepted' WHERE id = $1 AND status = 'pending'",
    [id, partnerId]
  );
  return getById(id);
}

export async function updateMissionQr(id: string, qr_code: string): Promise<MissionType | null> {
  await pool.query('UPDATE missions SET qr_code = $2 WHERE id = $1', [id, qr_code]);
  return getById(id);
}
