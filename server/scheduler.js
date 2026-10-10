import { runEvaluation } from './engine/lifecycleEngine.js';
import { logger } from './logger.js';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — override with EVALUATION_INTERVAL_MS

let intervalMs = DEFAULT_INTERVAL_MS;
let nextRunAt = null;
let timer = null;

async function tick() {
  try {
    const summary = await runEvaluation();
    if (summary.transitions_applied || summary.purged) {
      logger.info(
        `scheduled evaluation: ${summary.transitions_applied} transition(s), ${summary.purged} purge(s)`
      );
    }
  } catch (err) {
    logger.error('scheduled evaluation failed:', err);
  } finally {
    nextRunAt = Date.now() + intervalMs;
  }
}

export function startScheduler(customIntervalMs) {
  intervalMs = customIntervalMs ?? (Number(process.env.EVALUATION_INTERVAL_MS) || DEFAULT_INTERVAL_MS);
  nextRunAt = Date.now() + intervalMs;
  timer = setInterval(tick, intervalMs);
  logger.info(`lifecycle evaluation scheduler started — running every ${Math.round(intervalMs / 1000)}s`);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function getSchedulerState() {
  return { interval_ms: intervalMs, next_run_at: nextRunAt };
}
