import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import './db.js';
import authRouter from './routes/auth.js';
import objectsRouter from './routes/objects.js';
import rulesRouter from './routes/rules.js';
import simulationRouter from './routes/simulation.js';
import auditRouter from './routes/audit.js';
import { checkConnection, ensureBucketsExist } from './storage.js';
import { startScheduler } from './scheduler.js';
import { logger } from './logger.js';
import { requireAuth } from './authMiddleware.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

let storageConnected = false;
app.get('/api/health', (req, res) => res.json({ ok: true, storage_connected: storageConnected }));
app.use('/api/auth', authRouter);

app.use('/api/objects', requireAuth, objectsRouter);
app.use('/api/rules', requireAuth, rulesRouter);
app.use('/api/simulation', requireAuth, simulationRouter);
app.use('/api/audit', requireAuth, auditRouter);

// Centralized error handler — any route that calls next(err), or any
// synchronous throw inside a route, lands here instead of crashing the
// process or hanging the request. Must be registered last, after all routes.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'file is too large' : err.message;
    return res.status(400).json({ error: message });
  }
  logger.error(`unhandled error on ${req.method} ${req.path}:`, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'internal server error' });
});

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
