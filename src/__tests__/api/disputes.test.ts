import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { pool } from '../../config/db';

const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
let clientToken: string;
let partnerToken: string;
let adminToken: string;
let missionId: string;
let disputeId: string;

const missionPayload = {
  package_title: 'Dispute test parcel',
  package_size: 'medium',
  pickup_address: '10 Rue de Rivoli, Paris',
  pickup_lat: 48.8566,
  pickup_lng: 2.3522,
  delivery_address: '5 Avenue des Champs-Élysées, Paris',
  delivery_lat: 48.8698,
  delivery_lng: 2.3078,
  pickup_time_slot: '14:00-16:00',
};

/** Ensure disputes table exists (test DB may not have run full migrate). */
async function ensureDisputesTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await client.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        raised_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open'
          CHECK (status IN ('open', 'in_review', 'resolved')),
        resolution TEXT,
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_disputes_mission_id ON disputes(mission_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);');
  } finally {
    client.release();
  }
}

describe.skip('Disputes API', () => {
  beforeAll(async () => {
    await ensureDisputesTable();
    const base = unique();
    const [clientRes, partnerRes, adminRes] = await Promise.all([
      request(app).post('/api/auth/register').send({
        email: `disp-client-${base}@test.local`,
        password: 'Password123!',
        role: 'client',
        first_name: 'Disp',
        last_name: 'Client',
      }),
      request(app).post('/api/auth/register').send({
        email: `disp-partner-${base}@test.local`,
        password: 'Password123!',
        role: 'partner',
        first_name: 'Disp',
        last_name: 'Partner',
      }),
      request(app).post('/api/auth/register').send({
        email: `disp-admin-${base}@test.local`,
        password: 'Password123!',
        role: 'admin',
        first_name: 'Disp',
        last_name: 'Admin',
      }),
    ]);
    clientToken = clientRes.body.token;
    partnerToken = partnerRes.body.token;
    adminToken = adminRes.body.token;

    const missionRes = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(missionPayload);
    missionId = missionRes.body.mission?.id;
    expect(missionId).toBeDefined();
  });

  describe('POST /api/disputes', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/disputes')
        .send({ mission_id: missionId, reason: 'Test reason' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid payload (missing reason)', async () => {
      const res = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ mission_id: missionId });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid mission_id', async () => {
      const res = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ mission_id: 'not-a-uuid', reason: 'Test' });
      expect(res.status).toBe(400);
    });

    it('creates dispute as client and returns dispute', async () => {
      const res = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ mission_id: missionId, reason: 'Package never arrived' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      disputeId = res.body.dispute.id;
      expect(disputeId).toBeDefined();
      expect(res.body.dispute).toMatchObject({
        mission_id: missionId,
        reason: 'Package never arrived',
        status: 'open',
      });
      expect(res.body.dispute.raised_by).toBeDefined();
      expect(res.body.dispute.created_at).toBeDefined();
    });

    it('returns 403 when partner disputes a mission they are not assigned to', async () => {
      const res = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({ mission_id: missionId, reason: 'Not my mission' });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/disputes', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/admin/disputes');
      expect(res.status).toBe(401);
    });

    it('returns 403 for client', async () => {
      const res = await request(app)
        .get('/api/admin/disputes')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 and disputes list for admin', async () => {
      const res = await request(app)
        .get('/api/admin/disputes')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.disputes)).toBe(true);
      expect(res.body.disputes.length).toBeGreaterThanOrEqual(1);
      const found = res.body.disputes.find((d: { id: string }) => d.id === disputeId);
      expect(found).toBeDefined();
      expect(found.status).toBe('open');
    });

    it('returns filtered list for admin with ?status=open', async () => {
      const res = await request(app)
        .get('/api/admin/disputes?status=open')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.disputes)).toBe(true);
      res.body.disputes.forEach((d: { status: string }) => expect(d.status).toBe('open'));
    });
  });

  describe('PATCH /api/admin/disputes/:id/resolve', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .patch(`/api/admin/disputes/${disputeId}/resolve`)
        .send({ resolution: 'Refund issued' });
      expect(res.status).toBe(401);
    });

    it('returns 403 for client', async () => {
      const res = await request(app)
        .patch(`/api/admin/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ resolution: 'Refund issued' });
      expect(res.status).toBe(403);
    });

    it('returns 400 when resolution is missing', async () => {
      const res = await request(app)
        .patch(`/api/admin/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent dispute id', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .patch(`/api/admin/disputes/${fakeId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolution: 'N/A' });
      expect(res.status).toBe(404);
    });

    it('resolves dispute as admin and returns updated dispute', async () => {
      const res = await request(app)
        .patch(`/api/admin/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolution: 'Refund issued to client' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.dispute).toMatchObject({
        id: disputeId,
        status: 'resolved',
        resolution: 'Refund issued to client',
      });
      expect(res.body.dispute.resolved_by).toBeDefined();
      expect(res.body.dispute.resolved_at).toBeDefined();
    });
  });
});
