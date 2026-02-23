/**
 * PostgreSQL + PostGIS connection pool
 * Ensure PostGIS extension is enabled: CREATE EXTENSION IF NOT EXISTS postgis;
 */

import { Pool, PoolConfig } from 'pg';

const sslMode = process.env.PGSSLMODE || process.env.SSLMODE;
const useSsl = sslMode === 'require' || sslMode === 'verify-full' || sslMode === 'verify-ca';

const config: PoolConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'eco_relais',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(useSsl && { ssl: true }),
};

export const pool = new Pool(config);

pool.on('error', (err: Error) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

/**
 * Test database connectivity; optionally report PostGIS if available.
 */
export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('PostgreSQL connected.');
    try {
      const res = await client.query('SELECT PostGIS_Version()');
      console.log('PostGIS available:', res.rows[0]?.postgis_version);
    } catch {
      console.warn('PostGIS not installed; nearby missions will use approximate distance.');
    }
  } finally {
    client.release();
  }
}

export default pool;
