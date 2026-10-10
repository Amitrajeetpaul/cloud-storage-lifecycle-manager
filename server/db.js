import pg from 'pg';

const { Pool } = pg;

// node-postgres returns BIGINT (OID 20) as a string by default, since JS
// numbers can't safely represent the full 64-bit range. Our BIGINT columns
// are all millisecond timestamps, which stay well within
// Number.MAX_SAFE_INTEGER for centuries, so parse them as numbers — avoids
// every timestamp field silently becoming a quoted string in JSON responses
// and in equality checks against client-side Date.now() values.
pg.types.setTypeParser(20, (val) => parseInt(val, 10));

// DATABASE_URL works with any standard Postgres provider — Vercel Postgres,
// Neon, Supabase, Railway, or a local instance for dev. SSL is required by
// most hosted providers but not by a local/self-hosted Postgres, so it's
// configurable rather than hardcoded.
const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/cslm_dev';
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;

export const pool = new Pool({ connectionString, ssl });

export async function query(text, params) {
  return pool.query(text, params);
}

// Replaces better-sqlite3's synchronous db.transaction(fn) — checks out a
// dedicated client so BEGIN/COMMIT/ROLLBACK apply atomically to the queries
// run inside fn, which receives that client instead of using the pool
// directly (using the pool inside a transaction would spread the queries
// across different connections and defeat the transaction entirely).
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

let readyPromise = null;

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS objects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size_mb DOUBLE PRECISION NOT NULL,
      tier TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      last_accessed_at BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      content_type TEXT,
      is_real_upload BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      from_tier TEXT NOT NULL,
      to_tier TEXT,
      condition_days INTEGER NOT NULL,
      action TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      file_type TEXT
    );

    CREATE TABLE IF NOT EXISTS engine_state (
      id INTEGER PRIMARY KEY,
      last_evaluated_at BIGINT,
      CONSTRAINT engine_state_singleton CHECK (id = 1)
    );

    CREATE TABLE IF NOT EXISTS cost_history (
      id SERIAL PRIMARY KEY,
      recorded_at BIGINT NOT NULL,
      tier TEXT NOT NULL,
      total_cost DOUBLE PRECISION NOT NULL,
      hot_equivalent_cost DOUBLE PRECISION NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      object_id TEXT NOT NULL,
      object_name TEXT NOT NULL,
      from_tier TEXT,
      to_tier TEXT,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
  `);

  await pool.query(
    `INSERT INTO engine_state (id, last_evaluated_at) VALUES (1, NULL) ON CONFLICT (id) DO NOTHING`
  );

  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM rules');
  if (rows[0].c === 0) {
    const defaultRules = [
      { id: 'rule-hot-warm', name: 'Hot to Warm', from_tier: 'Hot', to_tier: 'Warm', condition_days: 7, action: 'transition', sort_order: 0 },
      { id: 'rule-warm-cold', name: 'Warm to Cold', from_tier: 'Warm', to_tier: 'Cold', condition_days: 30, action: 'transition', sort_order: 1 },
      { id: 'rule-cold-archive', name: 'Cold to Archive', from_tier: 'Cold', to_tier: 'Archive', condition_days: 90, action: 'transition', sort_order: 2 },
      { id: 'rule-archive-delete', name: 'Archive Expiry Delete', from_tier: 'Archive', to_tier: null, condition_days: 365, action: 'delete', sort_order: 3 },
    ];
    for (const r of defaultRules) {
      await pool.query(
        `INSERT INTO rules (id, name, from_tier, to_tier, condition_days, action, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [r.id, r.name, r.from_tier, r.to_tier, r.condition_days, r.action, r.sort_order]
      );
    }
  }
}

// Schema setup is async (unlike the old synchronous better-sqlite3 version),
// so every entry point awaits this once before handling its first request —
// index.js awaits it before listening, and the Vercel cron handler /
// serverless function awaits it on cold start. Subsequent calls reuse the
// same promise instead of re-running the CREATE TABLE statements.
export function ready() {
  if (!readyPromise) readyPromise = initSchema();
  return readyPromise;
}
