import { describe, it, expect, beforeAll } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

// Isolated DB + predictable credentials, set before any module that reads
// them is imported (db.js and auth.js both read process.env at module-load
// time) — same pattern as engine/lifecycleEngine.test.js.
process.env.DB_PATH = path.join(os.tmpdir(), `cslm-test-auth-${Date.now()}.db`);
process.env.ADMIN_USERNAME = 'testadmin';
process.env.ADMIN_PASSWORD = 'testpass123';
process.env.JWT_SECRET = 'test-secret-not-for-production';

let app;
beforeAll(async () => {
  const { createApp } = await import('../app.js');
  app = createApp();
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
