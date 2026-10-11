import { Router } from 'express';
import { query } from '../db.js';
import { runEvaluation, getLastEvaluatedAt } from '../engine/lifecycleEngine.js';
import { getSchedulerState } from '../scheduler.js';
import { getOptimizationSuggestions, applyOptimization } from '../engine/optimizer.js';
import { getForecast } from '../engine/forecast.js';
import { getProviderComparison } from '../engine/providerRates.js';
import { asyncHandler } from '../asyncHandler.js';

const router = Router();

router.post('/evaluate', asyncHandler(async (req, res) => {
  const summary = await runEvaluation();
  res.json(summary);
}));

router.get('/optimize', asyncHandler(async (req, res) => {
  const suggestions = await getOptimizationSuggestions();
  res.json({
    suggestions,
    total_potential_savings_per_day: suggestions.reduce((sum, s) => sum + s.potential_savings_per_day, 0),
  });
}));

router.post('/optimize/apply', asyncHandler(async (req, res) => {
  const summary = await applyOptimization();
  res.json(summary);
}));

router.get('/state', asyncHandler(async (req, res) => {
  const { interval_ms, next_run_at } = getSchedulerState();
  res.json({
    last_evaluated_at: await getLastEvaluatedAt(),
    next_evaluation_at: next_run_at,
    evaluation_interval_ms: interval_ms,
    server_time: Date.now(),
  });
}));

router.get('/forecast', asyncHandler(async (req, res) => {
  const forecast = await getForecast();
  res.json({ forecast });
}));

router.get('/provider-comparison', asyncHandler(async (req, res) => {
  const comparison = await getProviderComparison();
  res.json(comparison);
}));

router.get('/history', asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT recorded_at, tier, total_cost, hot_equivalent_cost FROM cost_history ORDER BY recorded_at ASC'
  );
  res.json(rows);
}));

export default router;
