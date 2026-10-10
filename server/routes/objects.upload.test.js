import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Readable } from 'node:stream';
import request from 'supertest';
import { createTestDatabase } from '../testUtils.js';

process.env.ADMIN_USERNAME = 'testadmin';
process.env.ADMIN_PASSWORD = 'testpass123';
process.env.JWT_SECRET = 'test-secret-not-for-production';

// Real MinIO isn't available in a test environment — mock the storage layer
// so these tests exercise the route/DB logic (real file bytes in, real
// size_mb computed, real download round trip through Express) without a
// real MinIO server. The mock keeps an in-memory map so putObject/
// getObjectStream behave consistently with each other within a test.
const fakeBucket = new Map();
vi.mock('../storage.js', () => ({
  putObject: vi.fn(async (object, file) => {
    fakeBucket.set(object.id, { buffer: file ? file.buffer : Buffer.from('placeholder'), contentType: file?.mimetype });
  }),
  getObjectStream: vi.fn(async (objectId) => {
    const entry = fakeBucket.get(objectId);
    if (!entry) throw Object.assign(new Error('not found'), { code: 'NoSuchKey' });
    return Readable.from(entry.buffer);
  }),
  moveObject: vi.fn(async () => {}),
  removeObject: vi.fn(async () => {}),
}));

let app;
let token;
let cleanupDb;
beforeAll(async () => {
  cleanupDb = await createTestDatabase();
  const { ready } = await import('../db.js');
  await ready();
  const { createApp } = await import('../app.js');
  app = createApp();
  const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  token = login.body.token;
});

afterAll(async () => {
  await cleanupDb();
});

function auth(req) {
  return req.set('Authorization', `Bearer ${token}`);
}

describe('POST /api/objects/upload', () => {
  it('rejects a request with no file', async () => {
    const res = await auth(request(app).post('/api/objects/upload')).field('tier', 'Hot');
    expect(res.status).toBe(400);
  });

  it('stores the real file bytes and computes size_mb from the actual size', async () => {
    const buffer = Buffer.alloc(2 * 1024 * 1024, 'x'); // exactly 2 MiB
    const res = await auth(request(app).post('/api/objects/upload'))
      .field('tier', 'Hot')
      .attach('file', buffer, { filename: 'test-report.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('test-report.pdf');
    expect(res.body.size_mb).toBeCloseTo(2, 5);
    expect(res.body.content_type).toBe('application/pdf');
    expect(res.body.is_real_upload).toBe(true);
  });

  it('defaults to the Hot tier when an invalid tier is given', async () => {
    const res = await auth(request(app).post('/api/objects/upload'))
      .field('tier', 'NotARealTier')
      .attach('file', Buffer.from('hello'), 'note.txt');
    expect(res.status).toBe(201);
    expect(res.body.tier).toBe('Hot');
  });
});

describe('GET /api/objects/:id/download', () => {
  it('returns the exact uploaded bytes', async () => {
    const original = Buffer.from('the quick brown fox jumps over the lazy dog');
    const uploadRes = await auth(request(app).post('/api/objects/upload'))
      .field('tier', 'Hot')
      .attach('file', original, { filename: 'fox.txt', contentType: 'text/plain' });

    const downloadRes = await auth(request(app).get(`/api/objects/${uploadRes.body.id}/download`));
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toContain('text/plain');
    expect(downloadRes.text).toBe(original.toString());
  });

  it('rejects downloading a simulated (non-uploaded) object', async () => {
    const createRes = await auth(request(app).post('/api/objects'))
      .send({ name: 'fake.pdf', size_mb: 500, tier: 'Hot' });
    const res = await auth(request(app).get(`/api/objects/${createRes.body.id}/download`));
    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent object', async () => {
    const res = await auth(request(app).get('/api/objects/00000000-0000-0000-0000-000000000000/download'));
    expect(res.status).toBe(404);
  });
});
