import { describe, it, expect, beforeAll } from 'vitest';
import os from 'node:os';
import path from 'node:path';

// lifecycleEngine.js imports db.js, which opens a SQLite file as a
// module-level side effect — point it at a throwaway file so running the
// test suite never touches (or races with) the real dev database.
process.env.DB_PATH = path.join(os.tmpdir(), `cslm-test-${Date.now()}.db`);

let ageDays, findMatchingRule;
beforeAll(async () => {
  ({ ageDays, findMatchingRule } = await import('./lifecycleEngine.js'));
});

const DAY_MS = 24 * 60 * 60 * 1000;

describe('ageDays', () => {
  it('computes real elapsed days since last_accessed_at', () => {
    const now = Date.now();
    const object = { last_accessed_at: now - 7 * DAY_MS };
    expect(ageDays(object, now)).toBeCloseTo(7);
  });
});

describe('findMatchingRule', () => {
  const rules = [
    { from_tier: 'Hot', condition_days: 7, action: 'transition', to_tier: 'Warm', name: 'Hot to Warm' },
    { from_tier: 'Warm', condition_days: 30, action: 'transition', to_tier: 'Cold', name: 'Warm to Cold' },
    { from_tier: 'Any', condition_days: 365, action: 'delete', to_tier: null, name: 'Expire anything' },
  ];

  it('matches the first rule whose tier and idle threshold are satisfied', () => {
    const now = Date.now();
    const object = { tier: 'Hot', last_accessed_at: now - 10 * DAY_MS };
    expect(findMatchingRule(object, rules, now).name).toBe('Hot to Warm');
  });

  it('does not match a rule whose idle threshold has not been reached', () => {
    const now = Date.now();
    const object = { tier: 'Hot', last_accessed_at: now - 3 * DAY_MS };
    expect(findMatchingRule(object, rules, now)).toBeNull();
  });

  it('matches an "Any" tier rule regardless of the object tier', () => {
    const now = Date.now();
    const object = { tier: 'Cold', last_accessed_at: now - 400 * DAY_MS };
    expect(findMatchingRule(object, rules, now).name).toBe('Expire anything');
  });

  it('only applies the first matching rule, not a later one that also matches', () => {
    const now = Date.now();
    // Idle 400 days in Hot: matches "Hot to Warm" (7d) AND "Expire anything"
    // (365d, Any tier) — the first rule in order must win.
    const object = { tier: 'Hot', last_accessed_at: now - 400 * DAY_MS };
    expect(findMatchingRule(object, rules, now).name).toBe('Hot to Warm');
  });
});

describe('findMatchingRule with a file_type filter', () => {
  const typedRules = [
    { from_tier: 'Hot', condition_days: 3, action: 'transition', to_tier: 'Archive', file_type: 'Logs', name: 'Logs expire fast' },
    { from_tier: 'Hot', condition_days: 7, action: 'transition', to_tier: 'Warm', file_type: null, name: 'Everything else' },
  ];

  it('only matches a typed rule for objects of that file type', () => {
    const now = Date.now();
    const logObject = { tier: 'Hot', name: 'log-archive-1.dat', last_accessed_at: now - 5 * DAY_MS };
    expect(findMatchingRule(logObject, typedRules, now).name).toBe('Logs expire fast');
  });

  it('skips a typed rule for an object of a different file type', () => {
    const now = Date.now();
    const backupObject = { tier: 'Hot', name: 'db-snapshot-1.dat', last_accessed_at: now - 5 * DAY_MS };
    // Doesn't match the Logs-only rule even though idle (5d < 3d threshold is irrelevant here —
    // it fails the type check first), and doesn't yet meet the untyped rule's 7d threshold.
    expect(findMatchingRule(backupObject, typedRules, now)).toBeNull();
  });

  it('falls through to an untyped (file_type: null) rule for any type', () => {
    const now = Date.now();
    const backupObject = { tier: 'Hot', name: 'db-snapshot-1.dat', last_accessed_at: now - 10 * DAY_MS };
    expect(findMatchingRule(backupObject, typedRules, now).name).toBe('Everything else');
  });
});
