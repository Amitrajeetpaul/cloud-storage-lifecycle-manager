import { describe, it, expect, beforeAll, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

process.env.DB_PATH = path.join(os.tmpdir(), `cslm-test-optimize-${Date.now()}.db`);
process.env.ADMIN_USERNAME = 'testadmin';
process.env.ADMIN_PASSWORD = 'testpass123';
process.env.JWT_SECRET = 'test-secret-not-for-production';

const moveObject = vi.fn(async () => {});
vi.mock('../storage.js', () => ({
  putObject: vi.fn(async () => {}),
  getObjectStream: vi.fn(async () => { throw new Error('not used in this test'); }),
  moveObject,
  removeObject: vi.fn(async () => {}),
}));

let app;
let token;
beforeAll(async () => {
  const { createApp } = await import('../app.js');
  app = createApp();
  const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  token = login.body.token;
});

function auth(req) {
  return req.set('Authorization', `Bearer ${token}`);
}

async function createObject(overrides = {}) {
  const res = await auth(request(app).post('/api/objects')).send({
    name: 'dataset.dat',
    size_mb: 1024,
    tier: 'Hot',
    ...overrides,
  });
  return res.body;
}

describe('GET /api/simulation/optimize', () => {
  it('suggests moving a never-accessed (Rare) object to a colder tier', async () => {
    const obj = await createObject({ size_mb: 1024, tier: 'Hot' });
    const res = await auth(request(app).get('/api/simulation/optimize'));
    expect(res.status).toBe(200);
    const suggestion = res.body.suggestions.find((s) => s.id === obj.id);
    expect(suggestion).toBeDefined();
    expect(suggestion.access_frequency).toBe('Rare');
    expect(suggestion.recommended_tier).toBe('Archive');
    expect(suggestion.potential_savings_per_day).toBeGreaterThan(0);
  });

  it('excludes an object accessed frequently enough to need a fast tier', async () => {
    const obj = await createObject({ size_mb: 1024, tier: 'Cold' });
    await auth(request(app).patch(`/api/objects/${obj.id}/access`));
    await auth(request(app).patch(`/api/objects/${obj.id}/access`));
    await auth(request(app).patch(`/api/objects/${obj.id}/access`));

    const res = await auth(request(app).get('/api/simulation/optimize'));
    const suggestion = res.body.suggestions.find((s) => s.id === obj.id);
    expect(suggestion).toBeUndefined();
  });

  it('never suggests a hotter (more expensive) tier', async () => {
    const obj = await createObject({ size_mb: 1024, tier: 'Archive' });
    const res = await auth(request(app).get('/api/simulation/optimize'));
    const suggestion = res.body.suggestions.find((s) => s.id === obj.id);
    // Already in the cheapest tier — nothing colder to recommend.
    expect(suggestion).toBeUndefined();
  });
});

describe('POST /api/simulation/optimize/apply', () => {
  it('moves suggested objects, logs the audit entry, and reports total savings', async () => {
    const obj = await createObject({ name: 'cold-data.dat', size_mb: 2048, tier: 'Hot' });

    const applyRes = await auth(request(app).post('/api/simulation/optimize/apply'));
    expect(applyRes.status).toBe(200);
    expect(applyRes.body.applied).toBeGreaterThan(0);
    expect(applyRes.body.total_savings_per_day).toBeGreaterThan(0);
    expect(moveObject).toHaveBeenCalled();

    const objectsRes = await auth(request(app).get('/api/objects'));
    const moved = objectsRes.body.find((o) => o.id === obj.id);
    expect(moved.tier).toBe('Archive');

    const auditRes = await auth(request(app).get('/api/audit'));
    const entry = auditRes.body.find((a) => a.object_id === obj.id);
    expect(entry.reason).toContain('Cost optimization');
  });
});
