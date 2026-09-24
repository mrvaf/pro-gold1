import { describe, expect, it } from 'vitest';
import {
  MarketObservation,
  MarketPrice,
  MarketDataFreshnessPolicy,
  createMarketObservationId,
  createMarketInstrumentId,
  createMarketDataSourceId,
} from '@v-gold/core';

describe('MarketDataFreshnessPolicy', () => {
  const instrumentId = createMarketInstrumentId('inst_xau_usd').unwrap();
  const sourceId = createMarketDataSourceId('src_test').unwrap();
  const price = MarketPrice.create({
    amount: '2650.50',
    currency: 'USD',
    unit: 'TROY_OUNCE',
  }).unwrap();

  const policy = new MarketDataFreshnessPolicy({
    realTimeMaxAgeMs: 5 * 60 * 1000, // 5 minutes
    delayedMaxAgeMs: 30 * 60 * 1000, // 30 minutes
  });

  it('classifies recent observation as FRESH', () => {
    const now = new Date();
    const observedAt = new Date(now.getTime() - 2 * 60 * 1000); // 2 minutes ago

    const obs = MarketObservation.create({
      id: 'obs_fresh',
      instrumentId,
      sourceId,
      price,
      quality: 'REAL_TIME',
      observedAt,
    }).unwrap();

    const status = policy.evaluate(obs, now);
    expect(status).toBe('FRESH');
    expect(obs.isStale(5 * 60 * 1000, now)).toBe(false);
  });

  it('classifies older observation as STALE when exceeding max age threshold', () => {
    const now = new Date();
    const observedAt = new Date(now.getTime() - 6 * 60 * 1000); // 6 minutes ago (> 5 min threshold)

    const obs = MarketObservation.create({
      id: 'obs_stale',
      instrumentId,
      sourceId,
      price,
      quality: 'REAL_TIME',
      observedAt,
    }).unwrap();

    const status = policy.evaluate(obs, now);
    expect(status).toBe('STALE');
    expect(obs.isStale(5 * 60 * 1000, now)).toBe(true);
  });

  it('respects quality-specific freshness windows (DELAYED allows up to 30 mins)', () => {
    const now = new Date();
    const observedAt = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago

    const obs = MarketObservation.create({
      id: 'obs_delayed',
      instrumentId,
      sourceId,
      price,
      quality: 'DELAYED',
      observedAt,
    }).unwrap();

    // Under REAL_TIME it would be stale (15m > 5m), but for DELAYED it is fresh (15m <= 30m)
    expect(policy.evaluate(obs, now)).toBe('FRESH');
  });

  it('supports instrument-specific override thresholds', () => {
    const customPolicy = new MarketDataFreshnessPolicy({
      realTimeMaxAgeMs: 5 * 60 * 1000,
      instrumentOverrides: {
        'inst_xau_irr': 10 * 60 * 1000, // 10 minutes for Iranian bazaar rate
      },
    });

    const maxAgeDefault = customPolicy.getMaxAgeForInstrument('inst_xau_usd', 'REAL_TIME');
    const maxAgeIrr = customPolicy.getMaxAgeForInstrument('inst_xau_irr', 'REAL_TIME');

    expect(maxAgeDefault).toBe(300000);
    expect(maxAgeIrr).toBe(600000);
  });
});
