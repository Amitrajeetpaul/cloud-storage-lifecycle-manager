import { describe, it, expect } from 'vitest';
import {
  dailyCostForObject,
  dailyHotEquivalentCost,
  costByTier,
  totalDailyCost,
  totalHotEquivalentCost,
  sizeGb,
} from './costEngine.js';

describe('sizeGb', () => {
  it('converts MB to GB', () => {
    expect(sizeGb(1024)).toBe(1);
    expect(sizeGb(512)).toBe(0.5);
  });
});

describe('dailyCostForObject', () => {
  it('applies the tier rate per GB', () => {
    expect(dailyCostForObject(1024, 'Hot')).toBeCloseTo(4.0);
    expect(dailyCostForObject(1024, 'Archive')).toBeCloseTo(0.05);
  });

  it('returns 0 for an unknown tier', () => {
    expect(dailyCostForObject(1024, 'Nonexistent')).toBe(0);
  });
});

describe('dailyHotEquivalentCost', () => {
  it('always uses the Hot rate regardless of actual tier', () => {
    expect(dailyHotEquivalentCost(1024)).toBeCloseTo(4.0);
  });
});

describe('costByTier / totalDailyCost', () => {
  const objects = [
    { status: 'active', tier: 'Hot', size_mb: 1024 },
    { status: 'active', tier: 'Cold', size_mb: 1024 },
    { status: 'purged', tier: 'Hot', size_mb: 1024 },
  ];

  it('sums cost per tier, ignoring purged objects', () => {
    const totals = costByTier(objects);
    expect(totals.Hot).toBeCloseTo(4.0);
    expect(totals.Cold).toBeCloseTo(0.4);
    expect(totals.Warm).toBe(0);
    expect(totals.Archive).toBe(0);
  });

  it('totals across all tiers', () => {
    expect(totalDailyCost(objects)).toBeCloseTo(4.4);
  });
});

describe('totalHotEquivalentCost', () => {
  it('sums the Hot-rate cost of every active object regardless of its real tier', () => {
    const objects = [
      { status: 'active', tier: 'Archive', size_mb: 1024 },
      { status: 'active', tier: 'Cold', size_mb: 1024 },
      { status: 'purged', tier: 'Hot', size_mb: 1024 },
    ];
    expect(totalHotEquivalentCost(objects)).toBeCloseTo(8.0);
  });
});
