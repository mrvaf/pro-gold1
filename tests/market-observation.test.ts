import { describe, expect, it } from 'vitest';
import {
  MarketObservation,
  MarketPrice,
  createMarketObservationId,
  createMarketInstrumentId,
  createMarketDataSourceId,
} from '@v-gold/core';

describe('MarketObservation Domain Model', () => {
  const instrumentId = createMarketInstrumentId('inst_xau_usd').unwrap();
  const sourceId = createMarketDataSourceId('src_test').unwrap();
  const price = MarketPrice.create({
    amount: '2650.50',
    currency: 'USD',
    unit: 'TROY_OUNCE',
  }).unwrap();

  it('creates a valid market observation preserving distinct observedAt and ingestedAt', () => {
    const observedAt = new Date(Date.now() - 30 * 1000); // 30 seconds ago
    const ingestedAt = new Date();

    const obsResult = MarketObservation.create({
      id: 'obs_001',
      instrumentId,
      sourceId,
      price,
      quality: 'REAL_TIME',
      observedAt,
      ingestedAt,
      externalId: 'ext_tick_99',
    });

    expect(obsResult.isOk).toBe(true);
    if (!obsResult.isOk) return;

    const obs = obsResult.value;
    expect(obs.id).toBe('obs_001');
    expect(obs.instrumentId).toBe('inst_xau_usd');
    expect(obs.sourceId).toBe('src_test');
    expect(obs.observedAt.getTime()).toBe(observedAt.getTime());
    expect(obs.ingestedAt.getTime()).toBe(ingestedAt.getTime());
    expect(obs.externalId).toBe('ext_tick_99');
    expect(obs.quality).toBe('REAL_TIME');
  });

  it('rejects timestamps significantly in the future', () => {
    const farFuture = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes in the future (> 5 min skew)

    const futureObs = MarketObservation.create({
      id: 'obs_future',
      instrumentId,
      sourceId,
      price,
      quality: 'REAL_TIME',
      observedAt: farFuture,
    });

    expect(futureObs.isErr).toBe(true);
    if (futureObs.isErr) {
      expect(futureObs.error.message).toContain('future');
    }
  });

  it('serializes safe DTO without leaking internal secrets', () => {
    const observedAt = new Date();
    const obs = MarketObservation.create({
      id: 'obs_dto_test',
      instrumentId,
      sourceId,
      price,
      quality: 'REAL_TIME',
      observedAt,
    }).unwrap();

    const dto = obs.toDto();
    expect(dto.id).toBe('obs_dto_test');
    expect(dto.instrumentId).toBe('inst_xau_usd');
    expect(dto.price.amount).toBe('2650.5');
    expect(dto.price.currency).toBe('USD');
    expect(dto.price.unit).toBe('TROY_OUNCE');
    expect(dto.observedAt).toBe(observedAt.toISOString());
  });
});
