import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, 'lifecycle.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS objects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    size_mb REAL NOT NULL,
    tier TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    content_type TEXT,
    is_real_upload INTEGER NOT NULL DEFAULT 0
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
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_evaluated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS cost_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at INTEGER NOT NULL,
    tier TEXT NOT NULL,
    total_cost REAL NOT NULL,
    hot_equivalent_cost REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_id TEXT NOT NULL,
    object_name TEXT NOT NULL,
    from_tier TEXT,
    to_tier TEXT,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

const engineRow = db.prepare('SELECT * FROM engine_state WHERE id = 1').get();
if (!engineRow) {
  db.prepare('INSERT INTO engine_state (id, last_evaluated_at) VALUES (1, NULL)').run();
}

const ruleCount = db.prepare('SELECT COUNT(*) AS c FROM rules').get().c;
if (ruleCount === 0) {
  const insertRule = db.prepare(`
    INSERT INTO rules (id, name, from_tier, to_tier, condition_days, action, sort_order)
    VALUES (@id, @name, @from_tier, @to_tier, @condition_days, @action, @sort_order)
  `);
  const defaultRules = [
    { id: 'rule-hot-warm', name: 'Hot to Warm', from_tier: 'Hot', to_tier: 'Warm', condition_days: 7, action: 'transition', sort_order: 0 },
    { id: 'rule-warm-cold', name: 'Warm to Cold', from_tier: 'Warm', to_tier: 'Cold', condition_days: 30, action: 'transition', sort_order: 1 },
    { id: 'rule-cold-archive', name: 'Cold to Archive', from_tier: 'Cold', to_tier: 'Archive', condition_days: 90, action: 'transition', sort_order: 2 },
    { id: 'rule-archive-delete', name: 'Archive Expiry Delete', from_tier: 'Archive', to_tier: null, condition_days: 365, action: 'delete', sort_order: 3 },
  ];
  const insertMany = db.transaction((rules) => {
    for (const r of rules) insertRule.run(r);
  });
  insertMany(defaultRules);
}

export default db;
