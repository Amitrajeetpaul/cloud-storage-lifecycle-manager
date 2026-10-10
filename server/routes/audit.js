import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM audit_log ORDER BY id DESC LIMIT 500');
  res.json(rows);
}));

export default router;
