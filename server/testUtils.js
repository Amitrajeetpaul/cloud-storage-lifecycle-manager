import pg from 'pg';

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL || 'postgres://localhost:5432/postgres';

// Gives each test file its own throwaway Postgres database, mirroring the
// old SQLite "temp file per test file" isolation — necessary because
// vitest runs test files in parallel by default, and sharing one Postgres
// database across files risks races on the default-rules seed insert
// (duplicate key on the fixed 'rule-hot-warm' etc. ids) and cross-file data
// bleed. Sets DATABASE_URL before any test imports db.js/app.js, then
// returns a cleanup function to drop the database afterwards.
export async function createTestDatabase() {
  const dbName = `cslm_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  process.env.DATABASE_URL = `postgres://localhost:5432/${dbName}`;

  return async function cleanup() {
    const { pool } = await import('./db.js');
    await pool.end();
    const dropAdmin = new pg.Client({ connectionString: ADMIN_URL });
    await dropAdmin.connect();
    await dropAdmin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await dropAdmin.end();
  };
}
