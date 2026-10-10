import { Router } from 'express';
import db from '../db.js';
import { runEvaluation, getLastEvaluatedAt } from '../engine/lifecycleEngine.js';
import { getSchedulerState } from '../scheduler.js';
import { getOptimizationSuggestions, applyOptimization } from '../engine/optimizer.js';

const router = Router();

router.post('/evaluate', async (req, res, next) => {
  try {
    const summary = await runEvaluation();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/optimize', (req, res) => {
  const suggestions = getOptimizationSuggestions();
  res.json({
    suggestions,
    total_potential_savings_per_day: suggestions.reduce((sum, s) => sum + s.potential_savings_per_day, 0),
  });
});

router.post('/optimize/apply', async (req, res, next) => {
  try {
    const summary = await applyOptimization();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/state', (req, res) => {
  const { interval_ms, next_run_at } = getSchedulerState();
  res.json({
    last_evaluated_at: getLastEvaluatedAt(),
    next_evaluation_at: next_run_at,
    evaluation_interval_ms: interval_ms,
    server_time: Date.now(),
  });
});

router.get('/history', (req, res) => {
  const rows = db.prepare(
    'SELECT recorded_at, tier, total_cost, hot_equivalent_cost FROM cost_history ORDER BY recorded_at ASC'
  ).all();
  res.json(rows);
});

export default router;
