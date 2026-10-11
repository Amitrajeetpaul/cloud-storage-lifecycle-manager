import { query } from '../db.js';
import { costByTier } from './costEngine.js';

// Approximate, illustrative published US-region list prices (USD/GB/month,
// standard LRS/no-discount tier), converted to INR/GB/day for comparison
// against this app's own rates. These are NOT live pricing-API figures —
// real prices vary by region, change over time, and ignore reserved/
// committed-use discounts. Treat as "roughly what this would cost
// elsewhere," not a quote. Conversion: USD/month ÷ 30 days × ~83 INR/USD.
const USD_TO_INR = 83;
function usdPerGbMonthToInrPerGbDay(usd) {
  return (usd / 30) * USD_TO_INR;
}

const RAW_USD_RATES = {
  aws: { Hot: 0.023, Warm: 0.0125, Cold: 0.0036, Archive: 0.00099 }, // S3 Standard / Standard-IA / Glacier Flexible / Glacier Deep Archive
  azure: { Hot: 0.0184, Warm: 0.01, Cold: 0.0036, Archive: 0.00099 }, // Blob Hot / Cool / Cold / Archive
  gcp: { Hot: 0.02, Warm: 0.01, Cold: 0.004, Archive: 0.0012 }, // Standard / Nearline / Coldline / Archive
};

export const PROVIDER_LABELS = {
  app: 'This app',
  aws: 'AWS S3 (approx.)',
  azure: 'Azure Blob (approx.)',
  gcp: 'Google Cloud Storage (approx.)',
};

export const PROVIDER_TIER_NAMES = {
  aws: { Hot: 'Standard', Warm: 'Standard-IA', Cold: 'Glacier Flexible', Archive: 'Glacier Deep Archive' },
  azure: { Hot: 'Hot', Warm: 'Cool', Cold: 'Cold', Archive: 'Archive' },
  gcp: { Hot: 'Standard', Warm: 'Nearline', Cold: 'Coldline', Archive: 'Archive' },
};

export const PROVIDER_RATES_INR_PER_GB_DAY = Object.fromEntries(
  Object.entries(RAW_USD_RATES).map(([provider, tiers]) => [
    provider,
    Object.fromEntries(Object.entries(tiers).map(([tier, usd]) => [tier, usdPerGbMonthToInrPerGbDay(usd)])),
  ])
);

function costWithRates(perTierGb, rates) {
  return Object.entries(perTierGb).reduce((sum, [tier, gb]) => sum + gb * (rates[tier] ?? 0), 0);
}

/**
 * Applies the exact current tier distribution of real objects (same
 * objects, same sizes, same tier assignments) against each provider's
 * approximate rate card — an apples-to-apples "what would this storage
 * layout cost elsewhere" comparison, not a hypothetical.
 */
export async function getProviderComparison() {
  const { rows: objects } = await query("SELECT * FROM objects WHERE status = 'active'");
  const ourCostByTier = costByTier(objects);

  const gbByTier = {};
  for (const obj of objects) {
    gbByTier[obj.tier] = (gbByTier[obj.tier] ?? 0) + obj.size_mb / 1024;
  }

  const results = {
    app: { total: Object.values(ourCostByTier).reduce((a, b) => a + b, 0), by_tier: ourCostByTier },
  };
  for (const provider of Object.keys(RAW_USD_RATES)) {
    const rates = PROVIDER_RATES_INR_PER_GB_DAY[provider];
    const byTier = Object.fromEntries(
      Object.entries(gbByTier).map(([tier, gb]) => [tier, gb * (rates[tier] ?? 0)])
    );
    results[provider] = { total: costWithRates(gbByTier, rates), by_tier: byTier };
  }

  return {
    providers: results,
    labels: PROVIDER_LABELS,
    provider_tier_names: PROVIDER_TIER_NAMES,
    note: 'Approximate list prices for illustration only — not live pricing, excludes regional/discount variation.',
  };
}
