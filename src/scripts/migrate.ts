/**
 * Run database migrations (PostGIS + tables)
 * Usage: npm run migrate
 */

import 'dotenv/config';
import { pool } from '../config/db';

const migrations = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'partner', 'admin')),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    address_lat DOUBLE PRECISION,
    address_lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verified BOOLEAN DEFAULT FALSE,
    stripe_account_id VARCHAR(255)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    package_photo_url TEXT,
    package_title VARCHAR(255) NOT NULL,
    package_size VARCHAR(20) NOT NULL CHECK (package_size IN ('small', 'medium', 'large')),
    pickup_address TEXT NOT NULL,
    pickup_lat DOUBLE PRECISION NOT NULL,
    pickup_lng DOUBLE PRECISION NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_lat DOUBLE PRECISION NOT NULL,
    delivery_lng DOUBLE PRECISION NOT NULL,
    pickup_time_slot VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'collected', 'in_transit', 'delivered', 'cancelled')),
    price DECIMAL(10,2) NOT NULL,
    commission DECIMAL(10,2) NOT NULL,
    qr_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    stripe_payment_intent VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS idx_missions_client_id ON missions(client_id);`,
  `CREATE INDEX IF NOT EXISTS idx_missions_partner_id ON missions(partner_id);`,
  `CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`,
];

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      console.log('PostGIS extension enabled.');
    } catch {
      console.warn('PostGIS not available; nearby missions will use approximate distance.');
    }
    for (const sql of migrations) {
      const s = sql.trim();
      if (s) await client.query(s);
    }
    console.log('Migrations completed successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
