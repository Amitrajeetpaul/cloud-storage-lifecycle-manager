import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import authRouter from './routes/auth.js';
import objectsRouter from './routes/objects.js';
import rulesRouter from './routes/rules.js';
import simulationRouter from './routes/simulation.js';
import auditRouter from './routes/audit.js';
import { logger } from './logger.js';
import { requireAuth } from './authMiddleware.js';
import { runEvaluation } from './engine/lifecycleEngine.js';
import { asyncHandler } from './asyncHandler.js';

// Builds the Express app without starting anything (no MinIO connection, no
// scheduler, no listening socket) — kept separate from index.js so tests can
// import just the routing/middleware surface and exercise it with supertest.
export function createApp({ storageConnected = () => false } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/api/health', (req, res) => res.json({ ok: true, storage_connected: storageConnected() }));
  app.use('/api/auth', authRouter);

  // Production (Vercel) has no persistent process to run a setInterval
  // scheduler in, so a Vercel Cron Job hits this endpoint on a schedule
  // instead (see vercel.json). Protected by CRON_SECRET rather than the
  // admin JWT, since Vercel's cron invoker authenticates with
  // `Authorization: Bearer $CRON_SECRET`, not a login-derived token.
  app.post('/api/cron/evaluate', asyncHandler(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const summary = await runEvaluation();
    res.json(summary);
  }));

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

  return app;
}
