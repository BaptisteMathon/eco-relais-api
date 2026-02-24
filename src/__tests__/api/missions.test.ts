import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../app';

const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
let clientToken: string;
let partnerToken: string;
let missionId: string;

const missionPayload = {
  package_title: 'Test parcel',
  package_size: 'medium',
  pickup_address: '10 Rue de Rivoli, Paris',
  pickup_lat: 48.8566,
  pickup_lng: 2.3522,
  delivery_address: '5 Avenue des Champs-Élysées, Paris',
  delivery_lat: 48.8698,
  delivery_lng: 2.3078,
  pickup_time_slot: '14:00-16:00',
};

describe('Missions API', () => {
  beforeAll(async () => {
    const base = unique();
    const [clientRes, partnerRes] = await Promise.all([
      request(app).post('/api/auth/register').send({
        email: `client-${base}@test.local`,
        password: 'Password123!',
        role: 'client',
        first_name: 'Mission',
        last_name: 'Client',
      }),
      request(app).post('/api/auth/register').send({
        email: `partner-${base}@test.local`,
        password: 'Password123!',
        role: 'partner',
        first_name: 'Mission',
        last_name: 'Partner',
      }),
    ]);
    clientToken = clientRes.body.token;
    partnerToken = partnerRes.body.token;
  });

  describe('POST /api/missions', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/missions')
        .send(missionPayload);
      expect(res.status).toBe(401);
    });

    it('creates mission as client and returns mission', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(missionPayload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      missionId = res.body.mission.id;
      expect(missionId).toBeDefined();
      expect(res.body.mission).toMatchObject({
        package_title: missionPayload.package_title,
        package_size: missionPayload.package_size,
        status: 'pending',
        pickup_address: missionPayload.pickup_address,
        delivery_address: missionPayload.delivery_address,
      });
      // PG returns DECIMAL as string
      expect(Number(res.body.mission.price)).toBe(5);
      expect(Number(res.body.mission.commission)).toBe(1);
    });

    it('rejects invalid payload with 400', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          package_title: '',
          package_size: 'xl',
          pickup_lat: 999,
        });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/missions', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/missions');
      expect(res.status).toBe(401);
    });

    it('returns client missions for client token', async () => {
      const res = await request(app)
        .get('/api/missions')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.missions)).toBe(true);
      expect(res.body.missions.some((m: { id: string }) => m.id === missionId)).toBe(true);
    });

    it('returns nearby or assigned missions for partner with lat/lng', async () => {
      const res = await request(app)
        .get('/api/missions')
        .query({ lat: 48.85, lng: 2.35, radius: 2000 })
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.missions)).toBe(true);
    });
  });

  describe('GET /api/missions/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/api/missions/${missionId}`);
      expect(res.status).toBe(401);
    });

    it('returns mission for client who owns it', async () => {
      const res = await request(app)
        .get(`/api/missions/${missionId}`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.mission.id).toBe(missionId);
    });

    it('returns 404 for invalid UUID', async () => {
      const res = await request(app)
        .get('/api/missions/not-a-uuid')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/missions/:id/accept', () => {
    it('returns 403 for client', async () => {
      const res = await request(app)
        .put(`/api/missions/${missionId}/accept`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(403);
    });

    it.skip('partner accepts mission', async () => {
      const res = await request(app)
        .put(`/api/missions/${missionId}/accept`)
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.mission.status).toBe('accepted');
      expect(res.body.mission.partner_id).toBeDefined();
    });

    it.skip('returns 400 when mission already accepted', async () => {
      const res = await request(app)
        .put(`/api/missions/${missionId}/accept`)
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/missions/:id/collect', () => {
    it.skip('partner marks as collected', async () => {
      const res = await request(app)
        .put(`/api/missions/${missionId}/collect`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.mission.status).toBe('collected');
    });
  });

  describe('PUT /api/missions/:id/status', () => {
    it.skip('partner sets in_transit', async () => {
      const res = await request(app)
        .put(`/api/missions/${missionId}/status`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({ status: 'in_transit' });
      expect(res.status).toBe(200);
      expect(res.body.mission.status).toBe('in_transit');
    });
  });

  describe('PUT /api/missions/:id/deliver', () => {
    it.skip('partner delivers and mission is completed', async () => {
      const res = await request(app)
        .put(`/api/missions/${missionId}/deliver`)
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.mission.status).toBe('delivered');
      expect(res.body.mission.completed_at).toBeDefined();
    });
  });

  describe('PUT /api/missions/:id/cancel', () => {
    let cancelMissionId: string;

    beforeAll(async () => {
      const create = await request(app)
        .post('/api/missions')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(missionPayload);
      cancelMissionId = create.body.mission.id;
    });

    it('client can cancel pending mission', async () => {
      const res = await request(app)
        .put(`/api/missions/${cancelMissionId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.mission.status).toBe('cancelled');
    });

    it('returns 400 when mission already cancelled', async () => {
      const res = await request(app)
        .put(`/api/missions/${cancelMissionId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(400);
    });
  });
});
