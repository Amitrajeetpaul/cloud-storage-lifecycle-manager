import { describe, it, expect } from 'vitest';
import { classifyTrend, findUpcomingRule } from './forecast.js';

describe('classifyTrend', () => {
  it('detects rising access', () => {
    expect(classifyTrend(5, 2)).toBe('Rising');
  });
  it('detects declining access', () => {
    expect(classifyTrend(1, 4)).toBe('Declining');
  });
  it('detects stable access', () => {
    expect(classifyTrend(2, 2)).toBe('Stable');
    expect(classifyTrend(0, 0)).toBe('Stable');
  });
});

describe('findUpcomingRule', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const rules = [
    { from_tier: 'Hot', condition_days: 7, action: 'transition', to_tier: 'Warm', name: 'Hot to Warm', file_type: null },
    { from_tier: 'Warm', condition_days: 30, action: 'transition', to_tier: 'Cold', name: 'Warm to Cold', file_type: null },
  ];

  it('finds the next rule not yet matched, with days remaining', () => {
    const now = Date.now();
    const object = { tier: 'Hot', name: 'x.dat', last_accessed_at: now - 4 * DAY_MS };
    const result = findUpcomingRule(object, rules, now);
    expect(result.rule.name).toBe('Hot to Warm');
    expect(result.daysUntilThreshold).toBeCloseTo(3, 0);
  });

  it('returns null once a rule already matches (not "upcoming" anymore)', () => {
    const now = Date.now();
    const object = { tier: 'Hot', name: 'x.dat', last_accessed_at: now - 10 * DAY_MS };
    expect(findUpcomingRule(object, rules, now)).toBeNull();
  });

  it('returns null when no rule applies to this tier at all', () => {
    const now = Date.now();
    const object = { tier: 'Archive', name: 'x.dat', last_accessed_at: now - 1 * DAY_MS };
    expect(findUpcomingRule(object, rules, now)).toBeNull();
  });

  it('picks the closest upcoming rule when multiple could eventually apply', () => {
    const now = Date.now();
    const multiRules = [
      ...rules,
      { from_tier: 'Any', condition_days: 5, action: 'delete', to_tier: null, name: 'Any-tier soon', file_type: null },
    ];
    const object = { tier: 'Hot', name: 'x.dat', last_accessed_at: now - 1 * DAY_MS };
    const result = findUpcomingRule(object, multiRules, now);
    // "Any-tier soon" (5d) is closer than "Hot to Warm" (7d)
    expect(result.rule.name).toBe('Any-tier soon');
  });
});
