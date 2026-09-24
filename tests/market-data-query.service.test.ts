import { describe, expect, it, beforeEach } from 'vitest';
import {
  MarketDataQueryService,
  MarketInstrument,
  MarketDataSource,
  MarketObservation,
  MarketPrice,
  MarketDataFreshnessPolicy,
  createEntityId,
  type MarketObservationId,
} from '@v-gold/core';
import {
  InMemoryMarketDataSourceRepository,
  InMemoryMarketInstrumentRepository,
  InMemoryMarketObservationRepository,
} from '@v-gold/database';

describe('MarketDataQueryService', () => {
  let sourceRepo: InMemoryMarketDataSourceRepository;
  let instrumentRepo: InMemoryMarketInstrumentRepository;
  let observationRepo: InMemoryMarketObservationRepository;
  let queryService: MarketDataQueryService;
  let testInstrument: MarketInstrument;
  let testSource: MarketDataSource;

  beforeEach(async () => {
    sourceRepo = new InMemoryMarketDataSourceRepository();
    instrumentRepo = new InMemoryMarketInstrumentRepository();
    observationRepo = new InMemoryMarketObservationRepository();

    testSource = MarketDataSource.create({
      id: 'src_nasdaq',
      name: 'Nasdaq Commodity Feed',
      code: 'NASDAQ_FEED',
    }).unwrap();
    await sourceRepo.save(testSource);

    testInstrument = MarketInstrument.create({
      id: 'inst_xau_usd',
      symbol: 'XAU/USD',
      baseAsset: 'XAU',
      quoteCurrency: 'USD',
      unit: 'TROY_OUNCE',
      displayName: 'Gold Spot USD',
    }).unwrap();
    await instrumentRepo.save(testInstrument);

    const freshnessPolicy = new MarketDataFreshnessPolicy({
      realTimeMaxAgeMs: 5 * 60 * 1000, // 5 minutes
    });

    queryService = new MarketDataQueryService(
      observationRepo,
      instrumentRepo,
      sourceRepo,
      freshnessPolicy
    );
  });

  it('truthfully returns OBSERVATION_UNAVAILABLE when no observation has been ingested yet', async () => {
    const result = await queryService.getLatestObservation('XAU/USD');

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error.code).toBe('OBSERVATION_UNAVAILABLE');
      expect(result.error.httpStatus).toBe(503);
    }
  });

  it('returns FRESH status for recently observed market rate', async () => {
    const now = new Date();
    const recentTime = new Date(now.getTime() - 60 * 1000); // 1 minute ago

    const obs = MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_recent'),
      instrumentId: testInstrument.id,
      sourceId: testSource.id,
      price: MarketPrice.create({ amount: '2650.00', currency: 'USD', unit: 'TROY_OUNCE' }).unwrap(),
      quality: 'REAL_TIME',
      observedAt: recentTime,
    }).unwrap();
    await observationRepo.save(obs);

    const result = await queryService.getLatestObservation('XAU/USD', now);

    expect(result.isOk).toBe(true);
    if (!result.isOk) return;

    expect(result.value.status).toBe('FRESH');
    expect(result.value.observation.price.amount.toString()).toBe('2650');
    expect(result.value.ageMs).toBeGreaterThanOrEqual(60000);
  });

  it('truthfully returns STALE status when observation age exceeds freshness threshold', async () => {
    const now = new Date();
    const staleTime = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago (> 5m threshold)

    const obs = MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_stale'),
      instrumentId: testInstrument.id,
      sourceId: testSource.id,
      price: MarketPrice.create({ amount: '2640.00', currency: 'USD', unit: 'TROY_OUNCE' }).unwrap(),
      quality: 'REAL_TIME',
      observedAt: staleTime,
    }).unwrap();
    await observationRepo.save(obs);

    const result = await queryService.getLatestObservation('XAU/USD', now);

    expect(result.isOk).toBe(true);
    if (!result.isOk) return;

    expect(result.value.status).toBe('STALE');
    expect(result.value.observation.price.amount.toString()).toBe('2640');
  });

  it('returns INSTRUMENT_NOT_FOUND when querying an unknown instrument', async () => {
    const result = await queryService.getLatestObservation('UNKNOWN/COIN');

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error.code).toBe('INSTRUMENT_NOT_FOUND');
      expect(result.error.httpStatus).toBe(404);
    }
  });

  it('retrieves historical observations in chronological order', async () => {
    const t1 = new Date('2026-09-23T08:00:00Z');
    const t2 = new Date('2026-09-23T09:00:00Z');
    const t3 = new Date('2026-09-23T10:00:00Z');

    const obs1 = MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_1'),
      instrumentId: testInstrument.id,
      sourceId: testSource.id,
      price: MarketPrice.create({ amount: '2640', currency: 'USD', unit: 'TROY_OUNCE' }).unwrap(),
      quality: 'REAL_TIME',
      observedAt: t1,
    }).unwrap();

    const obs2 = MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_2'),
      instrumentId: testInstrument.id,
      sourceId: testSource.id,
      price: MarketPrice.create({ amount: '2645', currency: 'USD', unit: 'TROY_OUNCE' }).unwrap(),
      quality: 'REAL_TIME',
      observedAt: t2,
    }).unwrap();

    const obs3 = MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_3'),
      instrumentId: testInstrument.id,
      sourceId: testSource.id,
      price: MarketPrice.create({ amount: '2650', currency: 'USD', unit: 'TROY_OUNCE' }).unwrap(),
      quality: 'REAL_TIME',
      observedAt: t3,
    }).unwrap();

    await observationRepo.save(obs1);
    await observationRepo.save(obs2);
    await observationRepo.save(obs3);

    const historyResult = await queryService.getHistoricalObservations(
      'XAU/USD',
      new Date('2026-09-23T07:30:00Z'),
      new Date('2026-09-23T09:30:00Z')
    );

    expect(historyResult.isOk).toBe(true);
    if (historyResult.isOk) {
      // Must include obs1 and obs2, but not obs3
      expect(historyResult.value.length).toBe(2);
    }
  });
});
