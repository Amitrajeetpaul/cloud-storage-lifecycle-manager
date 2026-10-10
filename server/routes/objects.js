import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../db.js';
import { TIER_ORDER } from '../engine/costEngine.js';
import * as storage from '../storage.js';
import { logger } from '../logger.js';
import { asyncHandler } from '../asyncHandler.js';
import { enrichObjects } from '../engine/enrichment.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB — a reasonable cap for a demo backend buffering uploads in memory

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

function warnOnStorageFailure(label) {
  return (err) => logger.warn(`[storage] ${label} failed:`, err.code || err.message || err);
}

const router = Router();

const SAMPLE_NAMES = [
  'invoice', 'backup', 'video-render', 'log-archive', 'photo-batch',
  'db-snapshot', 'user-upload', 'report', 'dataset', 'audio-track',
  'email-export', 'contract', 'presentation', 'firmware-image', 'telemetry-dump',
  'thumbnail-set', 'ml-checkpoint', 'session-recording', 'config-bundle', 'source-tarball',
];

function randomObjectPayload(now) {
  const name = `${SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)]}-${Math.floor(Math.random() * 9000 + 1000)}.dat`;
  const sizeMb = Math.round((Math.random() * 4990 + 10) * 10) / 10;
  const tier = TIER_ORDER[Math.floor(Math.random() * TIER_ORDER.length)];
  const ageDays = Math.floor(Math.random() * 120);
  return {
    id: uuidv4(),
    name,
    size_mb: sizeMb,
    tier,
    created_at: now - ageDays * DAY_MS,
    last_accessed_at: now - Math.floor(Math.random() * ageDays) * DAY_MS,
    status: 'active',
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM objects ORDER BY created_at DESC');
  res.json(await enrichObjects(rows));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, size_mb, tier } = req.body;
  if (!name || typeof size_mb !== 'number' || size_mb <= 0) {
    return res.status(400).json({ error: 'name and positive size_mb are required' });
  }
  const validTier = TIER_ORDER.includes(tier) ? tier : 'Hot';
  const now = Date.now();
  const obj = {
    id: uuidv4(),
    name,
    size_mb,
    tier: validTier,
    created_at: now,
    last_accessed_at: now,
    status: 'active',
  };
  await query(
    `INSERT INTO objects (id, name, size_mb, tier, created_at, last_accessed_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [obj.id, obj.name, obj.size_mb, obj.tier, obj.created_at, obj.last_accessed_at, obj.status]
  );
  await storage.putObject(obj).catch(warnOnStorageFailure(`putObject ${obj.id}`));
  res.status(201).json(obj);
}));

// Real file upload — unlike POST / above (which creates a simulated object
// with a typed-in size and a placeholder blob), this stores the actual
// uploaded bytes in MinIO and derives size_mb from the real file size.
router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  const { tier } = req.body;
  const validTier = TIER_ORDER.includes(tier) ? tier : 'Hot';
  const name = (req.body.name || req.file.originalname || 'untitled').trim();
  const now = Date.now();
  const obj = {
    id: uuidv4(),
    name,
    size_mb: req.file.size / (1024 * 1024),
    tier: validTier,
    created_at: now,
    last_accessed_at: now,
    status: 'active',
    content_type: req.file.mimetype || null,
    is_real_upload: true,
  };
  await query(
    `INSERT INTO objects (id, name, size_mb, tier, created_at, last_accessed_at, status, content_type, is_real_upload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [obj.id, obj.name, obj.size_mb, obj.tier, obj.created_at, obj.last_accessed_at, obj.status, obj.content_type, obj.is_real_upload]
  );
  await storage.putObject(obj, req.file).catch(warnOnStorageFailure(`putObject ${obj.id}`));
  res.status(201).json(obj);
}));

router.get('/:id/download', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM objects WHERE id = $1', [req.params.id]);
  const existing = rows[0];
  if (!existing || existing.status !== 'active') return res.status(404).json({ error: 'object not found' });
  if (!existing.is_real_upload) {
    return res.status(400).json({ error: 'this object is simulated and has no real file content to download' });
  }
  const stream = await storage.getObjectStream(existing.id, existing.tier);
  res.setHeader('Content-Type', existing.content_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(existing.name)}"`);
  stream.on('error', (err) => {
    logger.error(`[storage] download stream failed for ${existing.id}:`, err.code || err.message || err);
    if (!res.headersSent) res.status(502).end();
  });
  stream.pipe(res);
}));

router.post('/seed', asyncHandler(async (req, res) => {
  const count = Number.isInteger(req.body?.count) ? req.body.count : 20;
  const now = Date.now();
  const created = [];
  await withTransaction(async (client) => {
    for (let i = 0; i < count; i++) {
      const obj = randomObjectPayload(now);
      await client.query(
        `INSERT INTO objects (id, name, size_mb, tier, created_at, last_accessed_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [obj.id, obj.name, obj.size_mb, obj.tier, obj.created_at, obj.last_accessed_at, obj.status]
      );
      created.push(obj);
    }
  });
  await Promise.all(
    created.map((obj) => storage.putObject(obj).catch(warnOnStorageFailure(`putObject ${obj.id}`)))
  );
  res.status(201).json(created);
}));

router.patch('/:id/tier', asyncHandler(async (req, res) => {
  const { tier } = req.body;
  if (!TIER_ORDER.includes(tier)) {
    return res.status(400).json({ error: `tier must be one of ${TIER_ORDER.join(', ')}` });
  }
  const { rows } = await query('SELECT * FROM objects WHERE id = $1', [req.params.id]);
  const existing = rows[0];
  if (!existing) return res.status(404).json({ error: 'object not found' });

  await query('UPDATE objects SET tier = $1 WHERE id = $2', [tier, req.params.id]);
  await query(
    `INSERT INTO audit_log (object_id, object_name, from_tier, to_tier, action, reason, created_at)
     VALUES ($1, $2, $3, $4, 'transition', 'Manual override', $5)`,
    [existing.id, existing.name, existing.tier, tier, Date.now()]
  );

  if (tier !== existing.tier) {
    await storage.moveObject(existing.id, existing.tier, tier).catch(warnOnStorageFailure(`moveObject ${existing.id}`));
  }

  const { rows: updatedRows } = await query('SELECT * FROM objects WHERE id = $1', [req.params.id]);
  res.json(updatedRows[0]);
}));

router.patch('/:id/access', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM objects WHERE id = $1', [req.params.id]);
  const existing = rows[0];
  if (!existing) return res.status(404).json({ error: 'object not found' });
  if (existing.status !== 'active') return res.status(400).json({ error: 'object is not active' });

  const now = Date.now();
  await query('UPDATE objects SET last_accessed_at = $1 WHERE id = $2', [now, req.params.id]);
  await query(
    `INSERT INTO audit_log (object_id, object_name, from_tier, to_tier, action, reason, created_at)
     VALUES ($1, $2, $3, $4, 'access', 'Manual access', $5)`,
    [existing.id, existing.name, existing.tier, existing.tier, now]
  );

  const { rows: updatedRows } = await query('SELECT * FROM objects WHERE id = $1', [req.params.id]);
  res.json(updatedRows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM objects WHERE id = $1', [req.params.id]);
  const existing = rows[0];
  if (!existing) return res.status(404).json({ error: 'object not found' });

  await query("UPDATE objects SET status = 'purged' WHERE id = $1", [req.params.id]);
  await query(
    `INSERT INTO audit_log (object_id, object_name, from_tier, to_tier, action, reason, created_at)
     VALUES ($1, $2, $3, NULL, 'delete', 'Manual delete', $4)`,
    [existing.id, existing.name, existing.tier, Date.now()]
  );

  await storage.removeObject(existing.id, existing.tier).catch(warnOnStorageFailure(`removeObject ${existing.id}`));

  res.status(204).send();
}));

export default router;
