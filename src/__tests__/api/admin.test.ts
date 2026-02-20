import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../app';

const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
let clientToken: string;
let adminToken: string;

describe('Admin API', () => {
  beforeAll(async () => {
    const base = unique();
    const [clientRes, adminRes] = await Promise.all([
      request(app).post('/api/auth/register').send({
        email: `admin-test-client-${base}@test.local`,
        password: 'Password123!',
        role: 'client',
        first_name: 'AdminTest',
        last_name: 'Client',
      }),
      request(app).post('/api/auth/register').send({
        email: `admin-test-admin-${base}@test.local`,
        password: 'Password123!',
        role: 'admin',
        first_name: 'AdminTest',
        last_name: 'Admin',
      }),
    ]);
    clientToken = clientRes.body.token;
    adminToken = adminRes.body.token;
  });

  describe('GET /api/admin/users', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('returns 403 for client', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 with data, total, page, limit for admin', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.total).toBe('number');
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBeDefined();
      if (res.body.data.length > 0) {
        const user = res.body.data[0];
        expect(user).toMatchObject({
          id: expect.any(String),
          email: expect.any(String),
          role: expect.stringMatching(/^(client|partner|admin)$/),
          first_name: expect.any(String),
          last_name: expect.any(String),
        });
      }
    });

    it('respects pagination params page and limit', async () => {
      const res = await request(app)
        .get('/api/admin/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('filters by role when role query is provided', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=client&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach((u: { role: string }) => expect(u.role).toBe('client'));
    });
  });
});
