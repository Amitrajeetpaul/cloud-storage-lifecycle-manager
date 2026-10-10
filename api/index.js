import 'dotenv/config';
import { ready } from '../server/db.js';
import { createApp } from '../server/app.js';
import { checkConnection, ensureBucketsExist } from '../server/storage.js';
import { logger } from '../server/logger.js';

let storageConnected = false;
const app = createApp({ storageConnected: () => storageConnected });

// Runs once per cold start (a warm container reuses this across requests —
// there's no setInterval scheduler here; see /api/cron/evaluate in app.js
// and the "crons" entry in vercel.json for how evaluation actually runs in
// production). Concurrent requests arriving during a cold start all await
// the same promise instead of racing separate schema-init/MinIO-connect calls.
let warmup = null;
async function ensureWarm() {
  await ready();
  try {
    await checkConnection();
    await ensureBucketsExist();
    storageConnected = true;
  } catch (err) {
    logger.warn(
      `MinIO not reachable on cold start (${err.code || err.message || err}) — ` +
      'serving from Postgres only until MinIO is reachable.'
    );
  }
}

export default async function handler(req, res) {
  if (!warmup) warmup = ensureWarm();
  await warmup;
  return app(req, res);
}
