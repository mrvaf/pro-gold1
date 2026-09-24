import { describe, expect, it, beforeEach } from 'vitest';
import {
  MarketDataIngestionService,
  MarketInstrument,
  MarketDataSource,
} from '@v-gold/core';
import {
  InMemoryMarketDataSourceRepository,
  InMemoryMarketInstrumentRepository,
  InMemoryMarketObservationRepository,
  MockMarketDataProvider,
} from '@v-gold/database';

describe('MarketDataIngestionService', () => {
  let sourceRepo: InMemoryMarketDataSourceRepository;
  let instrumentRepo: InMemoryMarketInstrumentRepository;
  let observationRepo: InMemoryMarketObservationRepository;
  let ingestionService: MarketDataIngestionService;
  let mockProvider: MockMarketDataProvider;
  let testInstrument: MarketInstrument;
  let testSource: MarketDataSource;

  beforeEach(async () => {
    sourceRepo = new InMemoryMarketDataSourceRepository();
    instrumentRepo = new InMemoryMarketInstrumentRepository();
    observationRepo = new InMemoryMarketObservationRepository();
    mockProvider = new MockMarketDataProvider({ providerId: 'src_mock' });

    testSource = MarketDataSource.create({
      id: 'src_mock',
      name: 'Mock Exchange',
      code: 'MOCK_EX',
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

    ingestionService = new MarketDataIngestionService(
      observationRepo,
      instrumentRepo,
      sourceRepo
    );
  });

  it('successfully ingests valid provider observation into repository', async () => {
    const result = await ingestionService.ingestFromProvider(mockProvider, testInstrument);

    expect(result.isOk).toBe(true);
    if (!result.isOk) return;

    expect(result.value.isDuplicate).toBe(false);
    expect(result.value.observation.instrumentId).toBe(testInstrument.id);
    expect(result.value.observation.sourceId).toBe(testSource.id);
    expect(result.value.observation.price.amount.toString()).toBe('2650.5');

    // Confirm persisted in repository
    const count = await observationRepo.count();
    expect(count).toBe(1);

    const latest = await observationRepo.findLatestByInstrument(testInstrument.id);
    expect(latest).not.toBeNull();
    expect(latest?.id).toBe(result.value.observation.id);
  });

  it('enforces idempotency: does not duplicate identical (sourceId, instrumentId, observedAt)', async () => {
    const fixedTime = new Date('2026-09-23T10:00:00.000Z');
    mockProvider.setObservation('XAU/USD', {
      instrumentSymbol: 'XAU/USD',
      amount: '2655.00000000',
      currency: 'USD',
      unit: 'TROY_OUNCE',
      quality: 'REAL_TIME',
      observedAt: fixedTime,
    });

    // Ingest first time
    const res1 = await ingestionService.ingestFromProvider(mockProvider, testInstrument);
    expect(res1.isOk).toBe(true);
    if (res1.isOk) {
      expect(res1.value.isDuplicate).toBe(false);
    }
    expect(await observationRepo.count()).toBe(1);

    // Ingest second time with exact same observation time and source
    const res2 = await ingestionService.ingestFromProvider(mockProvider, testInstrument);
    expect(res2.isOk).toBe(true);
    if (res2.isOk) {
      expect(res2.value.isDuplicate).toBe(true);
    }

    // Repository count must remain 1
    expect(await observationRepo.count()).toBe(1);
  });

  it('rejects ingestion if instrument is not registered in the system', async () => {
    const unregistered = MarketInstrument.create({
      id: 'inst_unregistered',
      symbol: 'XAU/EUR',
      baseAsset: 'XAU',
      quoteCurrency: 'EUR',
      unit: 'TROY_OUNCE',
      displayName: 'Unregistered',
    }).unwrap();

    const result = await ingestionService.ingestFromProvider(mockProvider, unregistered);
    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error.code).toBe('INSTRUMENT_NOT_FOUND');
    }
  });

  it('rejects observation with mismatched currency or unit', async () => {
    const result = await ingestionService.ingestRawObservation({
      sourceId: testSource.id,
      instrument: testInstrument, // expects USD, TROY_OUNCE
      raw: {
        instrumentSymbol: 'XAU/USD',
        amount: '2650.0',
        currency: 'EUR', // Mismatched!
        unit: 'TROY_OUNCE',
        quality: 'REAL_TIME',
        observedAt: new Date(),
      },
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.message).toContain('currency mismatch');
    }
  });

  it('preserves historical observations when price updates arrive', async () => {
    const time1 = new Date('2026-09-23T10:00:00.000Z');
    const time2 = new Date('2026-09-23T10:05:00.000Z');

    mockProvider.setObservation('XAU/USD', {
      instrumentSymbol: 'XAU/USD',
      amount: '2650.00000000',
      currency: 'USD',
      unit: 'TROY_OUNCE',
      quality: 'REAL_TIME',
      observedAt: time1,
    });
    await ingestionService.ingestFromProvider(mockProvider, testInstrument);

    mockProvider.setObservation('XAU/USD', {
      instrumentSymbol: 'XAU/USD',
      amount: '2655.00000000',
      currency: 'USD',
      unit: 'TROY_OUNCE',
      quality: 'REAL_TIME',
      observedAt: time2,
    });
    await ingestionService.ingestFromProvider(mockProvider, testInstrument);

    // Both observations must be preserved
    expect(await observationRepo.count()).toBe(2);

    // Latest must be the newer observation
    const latest = await observationRepo.findLatestByInstrument(testInstrument.id);
    expect(latest?.price.amount.toString()).toBe('2655');
  });
});
