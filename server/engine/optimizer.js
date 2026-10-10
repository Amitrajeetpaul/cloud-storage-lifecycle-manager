import { query, withTransaction } from '../db.js';
import { dailyCostForObject } from './costEngine.js';
import { enrichObjects } from './enrichment.js';
import { recommendTierForFrequency, isColderTier } from './classification.js';
import * as storage from '../storage.js';
import { logger } from '../logger.js';

async function getActiveObjects() {
  const { rows } = await query("SELECT * FROM objects WHERE status = 'active'");
  return rows;
}

/**
 * Cost-optimization recommendations, independent of the fixed-threshold
 * rule engine: classifies each object's real access frequency (observed
 * audit activity, not a timer) and recommends the cheapest tier that still
 * fits that frequency's retrieval-latency needs. Only ever recommends
 * moving to a *colder* (cheaper) tier — an under-tiered frequently-accessed
 * object (e.g. "Frequent" but sitting in Cold) is a performance concern,
 * not a cost-saving opportunity, and is intentionally out of scope here.
 */
export async function getOptimizationSuggestions(now = Date.now()) {
  const enriched = await enrichObjects(await getActiveObjects(), now);
  const suggestions = [];
  for (const obj of enriched) {
    const recommended = recommendTierForFrequency(obj.access_frequency);
    if (!isColderTier(recommended, obj.tier)) continue;
    const currentCost = dailyCostForObject(obj.size_mb, obj.tier);
    const recommendedCost = dailyCostForObject(obj.size_mb, recommended);
    suggestions.push({
      id: obj.id,
      name: obj.name,
      current_tier: obj.tier,
      recommended_tier: recommended,
      access_frequency: obj.access_frequency,
      access_count_30d: obj.access_count_30d,
      potential_savings_per_day: currentCost - recommendedCost,
    });
  }
  return suggestions;
}

export async function applyOptimization(now = Date.now()) {
  const suggestions = await getOptimizationSuggestions(now);
  const storageOps = [];

  await withTransaction(async (client) => {
    for (const s of suggestions) {
      await client.query('UPDATE objects SET tier = $1 WHERE id = $2', [s.recommended_tier, s.id]);
      storageOps.push({ objectId: s.id, fromTier: s.current_tier, toTier: s.recommended_tier });
      await client.query(
        `INSERT INTO audit_log (object_id, object_name, from_tier, to_tier, action, reason, created_at)
         VALUES ($1, $2, $3, $4, 'transition', 'Cost optimization (low access frequency)', $5)`,
        [s.id, s.name, s.current_tier, s.recommended_tier, now]
      );
    }
  });

  await Promise.all(
    storageOps.map((op) =>
      storage.moveObject(op.objectId, op.fromTier, op.toTier)
        .catch((err) => logger.warn(`[storage] optimization move failed for ${op.objectId}:`, err.code || err.message || err))
    )
  );

  return {
    applied: suggestions.length,
    total_savings_per_day: suggestions.reduce((sum, s) => sum + s.potential_savings_per_day, 0),
  };
}
