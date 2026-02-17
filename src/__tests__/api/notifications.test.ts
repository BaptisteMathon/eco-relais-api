import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../app';

const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
let clientToken: string;

describe('Notifications API', () => {
  beforeAll(async () => {
    const email = `${unique()}@test.local`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'Password123!',
        role: 'client',
        first_name: 'Notif',
        last_name: 'User',
      });
    clientToken = res.body.token;
  });

  describe('GET /api/notifications', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });

    it('returns list for authenticated user', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.notifications)).toBe(true);
    });
  });
});
