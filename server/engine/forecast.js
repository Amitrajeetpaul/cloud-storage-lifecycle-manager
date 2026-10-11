import { query } from '../db.js';
import { classifyFileType } from './classification.js';
import { ageDays } from './lifecycleEngine.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_WINDOW_DAYS = 15; // compares the last 15 days of access activity to the 15 before that

/**
 * Lightweight, deterministic trend detection — not ML. Compares real
 * 'access' audit-event counts in two consecutive 15-day windows to say
 * whether an object's usage is picking up or tailing off, instead of only
 * looking at the most recent 30 days as one flat number (which is what
 * engine/enrichment.js's access_frequency does).
 */
async function getAccessCounts(now) {
  const { rows } = await query(
    `SELECT object_id, created_at FROM audit_log WHERE action = 'access' AND created_at >= $1`,
    [now - 2 * TREND_WINDOW_DAYS * DAY_MS]
  );
  const recentCutoff = now - TREND_WINDOW_DAYS * DAY_MS;
  const counts = new Map(); // object_id -> { recent, prior }
  for (const row of rows) {
    const entry = counts.get(row.object_id) ?? { recent: 0, prior: 0 };
    if (row.created_at >= recentCutoff) entry.recent += 1;
    else entry.prior += 1;
    counts.set(row.object_id, entry);
  }
  return counts;
}

export function classifyTrend(recent, prior) {
  if (recent > prior) return 'Rising';
  if (recent < prior) return 'Declining';
  return 'Stable';
}

/**
 * For one object, finds the next rule that WOULD apply once enough more
 * idle time passes (first rule matching tier/file_type whose
 * condition_days is still ahead of the object's current idle streak) —
 * the mirror image of lifecycleEngine's findMatchingRule, which only
 * returns a rule that already matches *now*.
 */
export function findUpcomingRule(object, rules, now = Date.now()) {
  const idleDays = ageDays(object, now);
  const fileType = classifyFileType(object.name);
  let best = null;
  for (const rule of rules) {
    if (rule.from_tier !== 'Any' && rule.from_tier !== object.tier) continue;
    if (rule.file_type && rule.file_type !== fileType) continue;
    if (rule.condition_days <= idleDays) continue; // already matches now, not "upcoming"
    if (!best || rule.condition_days < best.condition_days) best = rule;
  }
  if (!best) return null;
  return { rule: best, daysUntilThreshold: best.condition_days - idleDays };
}

/**
 * Forecast list: every active object's access trend plus, if applicable,
 * how many real days remain until it crosses its next lifecycle rule
 * threshold — sorted soonest-first so the dashboard can show "what's about
 * to happen" instead of only "what already happened."
 */
export async function getForecast(now = Date.now()) {
  const { rows: objects } = await query("SELECT * FROM objects WHERE status = 'active'");
  const { rows: rules } = await query('SELECT * FROM rules ORDER BY sort_order ASC');
  const accessCounts = await getAccessCounts(now);

  const forecast = objects.map((obj) => {
    const { recent, prior } = accessCounts.get(obj.id) ?? { recent: 0, prior: 0 };
    const upcoming = findUpcomingRule(obj, rules, now);
    return {
      id: obj.id,
      name: obj.name,
      tier: obj.tier,
      file_type: classifyFileType(obj.name),
      idle_days: Math.floor(ageDays(obj, now)),
      access_trend: classifyTrend(recent, prior),
      next_rule_name: upcoming?.rule.name ?? null,
      next_action: upcoming?.rule.action ?? null,
      next_tier: upcoming?.rule.to_tier ?? null,
      days_until_threshold: upcoming ? Math.ceil(upcoming.daysUntilThreshold) : null,
    };
  });

  return forecast
    .filter((f) => f.days_until_threshold !== null)
    .sort((a, b) => a.days_until_threshold - b.days_until_threshold);
}
