import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDatabase } from '../testUtils.js';

// Predictable credentials, set before auth.js (which reads them at
// module-load time) is imported via app.js below.
process.env.ADMIN_USERNAME = 'testadmin';
process.env.ADMIN_PASSWORD = 'testpass123';
process.env.JWT_SECRET = 'test-secret-not-for-production';

let app;
let cleanupDb;
beforeAll(async () => {
  cleanupDb = await createTestDatabase();
  const { ready } = await import('../db.js');
  await ready();
  const { createApp } = await import('../app.js');
  app = createApp();
});

afterAll(async () => {
  await cleanupDb();
});

describe('POST /api/auth/login', () => {
  it('rejects a request with missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('rejects an incorrect password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown username', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'testpass123' });
    expect(res.status).toBe(401);
  });

  it('issues a token for correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.token.split('.')).toHaveLength(3); // JWT shape
  });
});

describe('route protection', () => {
  it('rejects a protected route with no token', async () => {
    const res = await request(app).get('/api/objects');
    expect(res.status).toBe(401);
  });

  it('rejects a protected route with a garbage token', async () => {
    const res = await request(app).get('/api/objects').set('Authorization', 'Bearer garbage.not.valid');
    expect(res.status).toBe(401);
  });

  it('allows a protected route with a valid token', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
    const res = await request(app).get('/api/objects').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
  });

  it('does not require auth for the health endpoint', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
