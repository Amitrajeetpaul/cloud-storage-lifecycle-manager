import { query, withTransaction } from '../db.js';
import { TIER_ORDER, totalDailyCost, totalHotEquivalentCost, costByTier } from './costEngine.js';
import * as storage from '../storage.js';
import { logger } from '../logger.js';
import { classifyFileType } from './classification.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function getRules(client) {
  const { rows } = await client.query('SELECT * FROM rules ORDER BY sort_order ASC');
  return rows;
}

async function getActiveObjects(client) {
  const { rows } = await client.query("SELECT * FROM objects WHERE status = 'active'");
  return rows;
}

export function ageDays(object, now = Date.now()) {
  return (now - Number(object.last_accessed_at)) / DAY_MS;
}

/**
 * Evaluates one object against the ordered rule list; only the first
 * matching rule applies per run, mirroring MinIO's "first match wins"
 * lifecycle policy evaluation semantics.
 */
export function findMatchingRule(object, rules, now = Date.now()) {
  const idleDays = ageDays(object, now);
  for (const rule of rules) {
    if (rule.from_tier !== 'Any' && rule.from_tier !== object.tier) continue;
    if (rule.file_type && rule.file_type !== classifyFileType(object.name)) continue;
    if (idleDays < rule.condition_days) continue;
    return rule;
  }
  return null;
}

/**
 * Runs one real-time evaluation pass: checks every active object against
 * the current rule set using the real wall-clock elapsed time since its
 * last access, applies the first matching rule, and snapshots today's cost.
 * Called both by the scheduler (local dev, server/scheduler.js) and the
 * Vercel cron endpoint in production, plus manually via
 * POST /api/simulation/evaluate for on-demand/demo use.
 */
export async function runEvaluation(nowFn = () => Date.now()) {
  const now = nowFn();
  const transitions = [];
  const storageOps = [];
  let purgedCount = 0;

  await withTransaction(async (client) => {
    const rules = await getRules(client);
    const objects = await getActiveObjects(client);

    for (const object of objects) {
      const rule = findMatchingRule(object, rules, now);
      if (!rule) continue;

      if (rule.action === 'delete') {
        await client.query("UPDATE objects SET status = 'purged' WHERE id = $1", [object.id]);
        purgedCount += 1;
        storageOps.push({ type: 'delete', objectId: object.id, tier: object.tier });
        await client.query(
          `INSERT INTO audit_log (object_id, object_name, from_tier, to_tier, action, reason, created_at)
           VALUES ($1, $2, $3, NULL, 'delete', $4, $5)`,
          [object.id, object.name, object.tier, rule.name, now]
        );
      } else if (rule.action === 'transition' && rule.to_tier && rule.to_tier !== object.tier) {
        await client.query('UPDATE objects SET tier = $1 WHERE id = $2', [rule.to_tier, object.id]);
        transitions.push({ id: object.id, from: object.tier, to: rule.to_tier });
        storageOps.push({ type: 'move', objectId: object.id, fromTier: object.tier, toTier: rule.to_tier });
        await client.query(
          `INSERT INTO audit_log (object_id, object_name, from_tier, to_tier, action, reason, created_at)
           VALUES ($1, $2, $3, $4, 'transition', $5, $6)`,
          [object.id, object.name, object.tier, rule.to_tier, rule.name, now]
        );
      }
    }

    const activeAfter = await getActiveObjects(client);
    const perTier = costByTier(activeAfter);
    const hotEquivalent = totalHotEquivalentCost(activeAfter);
    for (const tier of TIER_ORDER) {
      await client.query(
        `INSERT INTO cost_history (recorded_at, tier, total_cost, hot_equivalent_cost)
         VALUES ($1, $2, $3, $4)`,
        [now, tier, perTier[tier] ?? 0, tier === 'Hot' ? hotEquivalent : 0]
      );
    }

    await client.query('UPDATE engine_state SET last_evaluated_at = $1 WHERE id = 1', [now]);
  });

  // MinIO calls run after the transaction commits — the database is the
  // source of truth, so a MinIO hiccup logs a warning rather than rolling
  // back the evaluation (this is a demo backend, not the system of record).
  // A rejection here must never escape to the scheduler's setInterval
  // callback (local dev) or the cron handler (production), neither of which
  // has a caller to catch it.
  await Promise.all(
    storageOps.map((op) =>
      (op.type === 'delete'
        ? storage.removeObject(op.objectId, op.tier)
        : storage.moveObject(op.objectId, op.fromTier, op.toTier)
      ).catch((err) => logger.warn(`[storage] ${op.type} failed for ${op.objectId}:`, err.code || err.message || err))
    )
  );

  const { rows: finalObjects } = await query("SELECT * FROM objects WHERE status = 'active'");
  return {
    evaluated_at: now,
    transitions_applied: transitions.length,
    purged: purgedCount,
    total_daily_cost: totalDailyCost(finalObjects),
    cost_by_tier: costByTier(finalObjects),
  };
}

export async function getLastEvaluatedAt() {
  const { rows } = await query('SELECT last_evaluated_at FROM engine_state WHERE id = 1');
  return rows[0]?.last_evaluated_at ? Number(rows[0].last_evaluated_at) : null;
}
