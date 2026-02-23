import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../app';

const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
let clientToken: string;
let partnerToken: string;

describe('Payments API', () => {
  beforeAll(async () => {
    const base = unique();
    const [clientRes, partnerRes] = await Promise.all([
      request(app).post('/api/auth/register').send({
        email: `pay-client-${base}@test.local`,
        password: 'Password123!',
        role: 'client',
        first_name: 'Pay',
        last_name: 'Client',
      }),
      request(app).post('/api/auth/register').send({
        email: `pay-partner-${base}@test.local`,
        password: 'Password123!',
        role: 'partner',
        first_name: 'Pay',
        last_name: 'Partner',
      }),
    ]);
    clientToken = clientRes.body.token;
    partnerToken = partnerRes.body.token;
  });

  describe('POST /api/payments/create-checkout', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/payments/create-checkout')
        .send({ mission_id: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid mission_id', async () => {
      const res = await request(app)
        .post('/api/payments/create-checkout')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ mission_id: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/payments', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/payments');
      expect(res.status).toBe(401);
    });

    it('returns 200 and payment history shape for client', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 403 for partner', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/payments/earnings', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/payments/earnings');
      expect(res.status).toBe(401);
    });

    it('returns 200 and earnings shape for partner', async () => {
      const res = await request(app)
        .get('/api/payments/earnings')
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.total_earnings).toBe('number');
      expect(Array.isArray(res.body.transactions)).toBe(true);
    });

    it('returns 403 for client', async () => {
      const res = await request(app)
        .get('/api/payments/earnings')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(403);
    });
  });
});
