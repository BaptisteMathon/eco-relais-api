import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app';

const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    it('registers a new client and returns token + user', async () => {
      const email = `${unique()}@test.local`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123!',
          role: 'client',
          first_name: 'Test',
          last_name: 'Client',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toMatchObject({
        email,
        role: 'client',
        first_name: 'Test',
        last_name: 'Client',
        verified: false,
      });
      expect(res.body.user.id).toBeDefined();
    });

    it('registers a partner', async () => {
      const email = `${unique()}@test.local`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123!',
          role: 'partner',
          first_name: 'Test',
          last_name: 'Partner',
        });
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('partner');
    });

    it('rejects duplicate email with 400', async () => {
      const email = `${unique()}@test.local`;
      await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123!',
          role: 'client',
          first_name: 'A',
          last_name: 'B',
        });
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'Other456!',
          role: 'client',
          first_name: 'A',
          last_name: 'B',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already registered/i);
    });

    it('rejects invalid payload with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'short',
          role: 'invalid',
          first_name: '',
          last_name: '',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    const email = `${unique()}@test.local`;
    const password = 'Password123!';

    it('returns 201 and token after registering', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password,
          role: 'client',
          first_name: 'Login',
          last_name: 'Test',
        });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(email);
    });

    it('rejects wrong password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPass1!' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unknown email with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.local', password: 'AnyPass1!' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('rejects missing token with 400', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
