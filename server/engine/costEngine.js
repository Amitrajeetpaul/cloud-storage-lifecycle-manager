export const TIERS = {
  Hot:     { costPerGbPerDay: 4.0,  retrievalDelay: 'instant' },
  Warm:    { costPerGbPerDay: 1.5,  retrievalDelay: 'seconds' },
  Cold:    { costPerGbPerDay: 0.4,  retrievalDelay: 'minutes' },
  Archive: { costPerGbPerDay: 0.05, retrievalDelay: 'hours' },
};

export const TIER_ORDER = ['Hot', 'Warm', 'Cold', 'Archive'];

export function sizeGb(sizeMb) {
  return sizeMb / 1024;
}

export function dailyCostForObject(sizeMb, tier) {
  const rate = TIERS[tier]?.costPerGbPerDay ?? 0;
  return sizeGb(sizeMb) * rate;
}

export function dailyHotEquivalentCost(sizeMb) {
  return sizeGb(sizeMb) * TIERS.Hot.costPerGbPerDay;
}

export function costByTier(objects) {
  const totals = { Hot: 0, Warm: 0, Cold: 0, Archive: 0 };
  for (const obj of objects) {
    if (obj.status !== 'active') continue;
    totals[obj.tier] = (totals[obj.tier] ?? 0) + dailyCostForObject(obj.size_mb, obj.tier);
  }
  return totals;
}

export function totalDailyCost(objects) {
  const totals = costByTier(objects);
  return Object.values(totals).reduce((a, b) => a + b, 0);
}

export function totalHotEquivalentCost(objects) {
  return objects
    .filter((o) => o.status === 'active')
    .reduce((sum, o) => sum + dailyHotEquivalentCost(o.size_mb), 0);
}
