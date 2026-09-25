import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getInstruments } from '../apps/web/app/api/v1/market-data/instruments/route';
import { GET as getLatestByParam } from '../apps/web/app/api/v1/market-data/latest/[instrument]/route';
import { GET as getLatestByQuery } from '../apps/web/app/api/v1/market-data/latest/route';
import { getMarketDataContainer } from '../apps/web/lib/market-data/market-data-container';
import {
  MarketObservation,
  MarketPrice,
  createEntityId,
  type MarketObservationId,
} from '@v-gold/core';

describe('Market Data API Routes', () => {
  const container = getMarketDataContainer();

  beforeEach(async () => {
    // Clear observations before each test to ensure predictable state
    (container.observationRepo as unknown as { clear: () => void }).clear();
  });

  it('GET /api/v1/market-data/instruments returns active reference instruments', async () => {
    const response = await getInstruments();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.instruments).toBeDefined();
    expect(Array.isArray(json.instruments)).toBe(true);

    const symbols = json.instruments.map((i: any) => i.symbol);
    expect(symbols).toContain('XAU/USD');
    expect(symbols).toContain('XAU/EUR');
    expect(symbols).toContain('XAU/IRR');
    expect(symbols).toContain('XAG/USD');
  });

  it('GET /api/v1/market-data/latest/:instrument returns 503 UNAVAILABLE when no observations exist', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/market-data/latest/XAU-USD');
    const response = await getLatestByParam(req, {
      params: Promise.resolve({ instrument: 'XAU-USD' }),
    });

    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe('OBSERVATION_UNAVAILABLE');
    expect(json.error.message).toContain('No market observation currently available');
  });

  it('GET /api/v1/market-data/latest/:instrument returns FRESH observation when recently ingested', async () => {
    const goldInstrument = (await container.instrumentRepo.findBySymbol('XAU/USD'))!;
    const source = (await container.sourceRepo.findByCode('UNAVAILABLE_PROVIDER'))!;

    const now = new Date();
    const obs = MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_api_test_fresh'),
      instrumentId: goldInstrument.id,
      sourceId: source.id,
      price: MarketPrice.create({
        amount: '2655.25000000',
        currency: 'USD',
        unit: 'TROY_OUNCE',
        bid: '2655.00000000',
        ask: '2655.50000000',
      }).unwrap(),
      quality: 'REAL_TIME',
      observedAt: new Date(now.getTime() - 30 * 1000), // 30 seconds ago
    }).unwrap();

    await container.observationRepo.save(obs);

    const req = new NextRequest('http://localhost:3000/api/v1/market-data/latest/XAU-USD');
    const response = await getLatestByParam(req, {
      params: Promise.resolve({ instrument: 'XAU-USD' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.status).toBe('FRESH');
    expect(json.instrument.symbol).toBe('XAU/USD');
    expect(json.observation.amount).toBe('2655.25');
    expect(json.observation.currency).toBe('USD');
    expect(json.observation.unit).toBe('TROY_OUNCE');
    expect(json.observation.spread).toBe('0.5');

    // Asserts no provider API keys or credentials leaked
    expect(json.source.apiKey).toBeUndefined();
    expect(json.source.credentials).toBeUndefined();
  });

  it('GET /api/v1/market-data/latest/:instrument returns STALE status when observation is old', async () => {
    const goldInstrument = (await container.instrumentRepo.findBySymbol('XAU/USD'))!;
    const source = (await container.sourceRepo.findByCode('UNAVAILABLE_PROVIDER'))!;

    const now = new Date();
    const obs = MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_api_test_stale'),
      instrumentId: goldInstrument.id,
      sourceId: source.id,
      price: MarketPrice.create({
        amount: '2640.00000000',
        currency: 'USD',
        unit: 'TROY_OUNCE',
      }).unwrap(),
      quality: 'REAL_TIME',
      observedAt: new Date(now.getTime() - 15 * 60 * 1000), // 15 minutes ago (> 5m threshold)
    }).unwrap();

    await container.observationRepo.save(obs);

    const req = new NextRequest('http://localhost:3000/api/v1/market-data/latest/XAU-USD');
    const response = await getLatestByParam(req, {
      params: Promise.resolve({ instrument: 'XAU-USD' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.status).toBe('STALE');
    expect(json.observation.amount).toBe('2640');
  });

  it('GET /api/v1/market-data/latest?symbol=XAU/USD queries via search params', async () => {
    const goldInstrument = (await container.instrumentRepo.findBySymbol('XAU/USD'))!;
    const source = (await container.sourceRepo.findByCode('UNAVAILABLE_PROVIDER'))!;

    const now = new Date();
    const obs = MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_query_param'),
      instrumentId: goldInstrument.id,
      sourceId: source.id,
      price: MarketPrice.create({
        amount: '2650.00',
        currency: 'USD',
        unit: 'TROY_OUNCE',
      }).unwrap(),
      quality: 'REAL_TIME',
      observedAt: now,
    }).unwrap();
    await container.observationRepo.save(obs);

    const req = new NextRequest('http://localhost:3000/api/v1/market-data/latest?symbol=XAU/USD');
    const response = await getLatestByQuery(req);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.instrument.symbol).toBe('XAU/USD');
    expect(json.status).toBe('FRESH');
  });

  it('returns 404 for unknown instrument symbol', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/market-data/latest/UNKNOWN-COIN');
    const response = await getLatestByParam(req, {
      params: Promise.resolve({ instrument: 'UNKNOWN-COIN' }),
    });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error.code).toBe('INSTRUMENT_NOT_FOUND');
  });
});
