import { describe, it, expect } from 'vitest';
import { PROVIDER_RATES_INR_PER_GB_DAY, PROVIDER_LABELS, PROVIDER_TIER_NAMES } from './providerRates.js';
import { TIER_ORDER } from './costEngine.js';

describe('PROVIDER_RATES_INR_PER_GB_DAY', () => {
  const providers = Object.keys(PROVIDER_RATES_INR_PER_GB_DAY);

  it('has rates for every tier, for every provider', () => {
    for (const provider of providers) {
      for (const tier of TIER_ORDER) {
        expect(PROVIDER_RATES_INR_PER_GB_DAY[provider][tier]).toBeGreaterThan(0);
      }
    }
  });

  it('is monotonically decreasing Hot > Warm > Cold > Archive for every provider, same as this app', () => {
    for (const provider of providers) {
      const rates = PROVIDER_RATES_INR_PER_GB_DAY[provider];
      expect(rates.Hot).toBeGreaterThan(rates.Warm);
      expect(rates.Warm).toBeGreaterThan(rates.Cold);
      expect(rates.Cold).toBeGreaterThan(rates.Archive);
    }
  });

  it('has a label and tier-name mapping for every rated provider', () => {
    for (const provider of providers) {
      expect(PROVIDER_LABELS[provider]).toBeTruthy();
      for (const tier of TIER_ORDER) {
        expect(PROVIDER_TIER_NAMES[provider][tier]).toBeTruthy();
      }
    }
  });
});
