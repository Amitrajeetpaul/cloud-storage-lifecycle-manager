import db from '../db.js';
import { TIER_ORDER, totalDailyCost, totalHotEquivalentCost, costByTier } from './costEngine.js';
import * as storage from '../storage.js';
import { logger } from '../logger.js';
import { classifyFileType } from './classification.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function getRules() {
  return db.prepare('SELECT * FROM rules ORDER BY sort_order ASC').all();
}

function getActiveObjects() {
  return db.prepare("SELECT * FROM objects WHERE status = 'active'").all();
}

const updateTierStmt = db.prepare('UPDATE objects SET tier = ? WHERE id = ?');
const purgeStmt = db.prepare("UPDATE objects SET status = 'purged' WHERE id = ?");
const insertAuditStmt = db.prepare(`
  INSERT INTO audit_log (object_id, object_name, from_tier, to_tier, action, reason, created_at)
  VALUES (@object_id, @object_name, @from_tier, @to_tier, @action, @reason, @created_at)
`);
const insertCostHistoryStmt = db.prepare(`
  INSERT INTO cost_history (recorded_at, tier, total_cost, hot_equivalent_cost)
  VALUES (@recorded_at, @tier, @total_cost, @hot_equivalent_cost)
`);

export function ageDays(object, now = Date.now()) {
  return (now - object.last_accessed_at) / DAY_MS;
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
 * Called both by the periodic scheduler (server/index.js) and manually via
 * POST /api/simulation/evaluate for on-demand/demo use.
 */
export async function runEvaluation(nowFn = () => Date.now()) {
  const now = nowFn();
  const transitions = [];
  const storageOps = [];
  let purgedCount = 0;

  const applyEvaluation = db.transaction(() => {
    const rules = getRules();
    const objects = getActiveObjects();

    for (const object of objects) {
      const rule = findMatchingRule(object, rules, now);
      if (!rule) continue;

      if (rule.action === 'delete') {
        purgeStmt.run(object.id);
        purgedCount += 1;
        storageOps.push({ type: 'delete', objectId: object.id, tier: object.tier });
        insertAuditStmt.run({
          object_id: object.id,
          object_name: object.name,
          from_tier: object.tier,
          to_tier: null,
          action: 'delete',
          reason: rule.name,
          created_at: now,
        });
      } else if (rule.action === 'transition' && rule.to_tier && rule.to_tier !== object.tier) {
        updateTierStmt.run(rule.to_tier, object.id);
        transitions.push({ id: object.id, from: object.tier, to: rule.to_tier });
        storageOps.push({ type: 'move', objectId: object.id, fromTier: object.tier, toTier: rule.to_tier });
        insertAuditStmt.run({
          object_id: object.id,
          object_name: object.name,
          from_tier: object.tier,
          to_tier: rule.to_tier,
          action: 'transition',
          reason: rule.name,
          created_at: now,
        });
      }
    }

    const activeAfter = getActiveObjects();
    const perTier = costByTier(activeAfter);
    const hotEquivalent = totalHotEquivalentCost(activeAfter);
    for (const tier of TIER_ORDER) {
      insertCostHistoryStmt.run({
        recorded_at: now,
        tier,
        total_cost: perTier[tier] ?? 0,
        hot_equivalent_cost: tier === 'Hot' ? hotEquivalent : 0,
      });
    }

    db.prepare('UPDATE engine_state SET last_evaluated_at = ? WHERE id = 1').run(now);
  });

  applyEvaluation();

  // MinIO calls run after the SQLite transaction commits — the database is
  // the source of truth, so a MinIO hiccup logs a warning rather than
  // rolling back the evaluation (this is a demo backend, not the system of
  // record). A rejection here must never escape to the scheduler's
  // setInterval callback, which has no caller to catch it.
  await Promise.all(
    storageOps.map((op) =>
      (op.type === 'delete'
        ? storage.removeObject(op.objectId, op.tier)
        : storage.moveObject(op.objectId, op.fromTier, op.toTier)
      ).catch((err) => logger.warn(`[storage] ${op.type} failed for ${op.objectId}:`, err.code || err.message || err))
    )
  );

  const finalObjects = getActiveObjects();
  return {
    evaluated_at: now,
    transitions_applied: transitions.length,
    purged: purgedCount,
    total_daily_cost: totalDailyCost(finalObjects),
    cost_by_tier: costByTier(finalObjects),
  };
}

export function getLastEvaluatedAt() {
  return db.prepare('SELECT last_evaluated_at FROM engine_state WHERE id = 1').get().last_evaluated_at;
}
