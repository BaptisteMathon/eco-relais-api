import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../app';

const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
let clientToken: string;

describe('Users API', () => {
  beforeAll(async () => {
    const email = `${unique()}@test.local`;
    const register = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'Password123!',
        role: 'client',
        first_name: 'Profile',
        last_name: 'User',
      });
    clientToken = register.body.token;
  });

  describe('GET /api/users/profile', () => {
    it('returns 401 without Authorization', async () => {
      const res = await request(app).get('/api/users/profile');
      expect(res.status).toBe(401);
    });

    it('returns 200 and user with valid token', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toMatchObject({
        role: 'client',
        first_name: 'Profile',
        last_name: 'User',
      });
      expect(res.body.user.email).toBeDefined();
      expect(res.body.user.id).toBeDefined();
    });
  });

  describe('PUT /api/users/profile', () => {
    it('returns 401 without Authorization', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .send({ first_name: 'Updated' });
      expect(res.status).toBe(401);
    });

    it('updates profile and returns user', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          first_name: 'UpdatedFirst',
          last_name: 'UpdatedLast',
          phone: '+33600000000',
          address_lat: 48.85,
          address_lng: 2.35,
        });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        first_name: 'UpdatedFirst',
        last_name: 'UpdatedLast',
        phone: '+33600000000',
        address_lat: 48.85,
        address_lng: 2.35,
      });
    });
  });
});
