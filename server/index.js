import 'dotenv/config';
import './db.js';
import { createApp } from './app.js';
import { checkConnection, ensureBucketsExist } from './storage.js';
import { startScheduler } from './scheduler.js';
import { logger } from './logger.js';

const PORT = process.env.PORT || 4000;

let storageConnected = false;
const app = createApp({ storageConnected: () => storageConnected });

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled promise rejection:', reason);
});

async function start() {
  try {
    await checkConnection();
    await ensureBucketsExist();
    storageConnected = true;
    logger.info('Connected to MinIO and ensured tier buckets exist.');
  } catch (err) {
    logger.warn(
      `MinIO not reachable (${err.code || err.message || err}) — simulation will run on SQLite only; ` +
      'object tiers won\'t be mirrored to real storage until MinIO is available.'
    );
  }

  startScheduler();

  app.listen(PORT, () => {
    logger.info(`Cloud Storage Lifecycle Manager API listening on http://localhost:${PORT}`);
  });
}

start();
