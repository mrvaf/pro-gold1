import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../apps/web/app/api/v1/pricing/calculate/route.js';
import { getMarketDataContainer } from '../apps/web/lib/market-data/market-data-container.js';
import {
  MarketObservation,
  MarketPrice,
  createEntityId,
  type MarketObservationId,
  type MarketInstrumentId,
  type MarketDataSourceId,
} from '@v-gold/core';

describe('Pricing Web API (POST /api/v1/pricing/calculate)', () => {
  const seedObservation = async (symbol: string, amount: string, observedAt: Date = new Date()) => {
    const marketData = getMarketDataContainer();
    const inst = await marketData.instrumentRepo.findBySymbol(symbol);
    if (!inst) throw new Error(`Instrument ${symbol} not found`);

    const obs = MarketObservation.create({
      id: createEntityId<MarketObservationId>(`obs_api_test_${Date.now()}`),
      instrumentId: inst.id,
      sourceId: createEntityId<MarketDataSourceId>('src_unavailable'),
      price: MarketPrice.create({
        amount,
        currency: inst.quoteCurrency,
        unit: inst.unit,
      }).unwrap(),
      quality: 'REAL_TIME',
      observedAt,
    }).unwrap();

    await marketData.observationRepo.save(obs);
    return obs;
  };

  it('returns HTTP 200 and detailed breakdown for valid pricing request with explicit rule', async () => {
    await seedObservation('XAU/USD', '2650.00');

    const body = {
      weight: { grams: '10.0' },
      purity: { karat: '18' },
      targetCurrency: 'USD',
      instrumentSymbol: 'XAU/USD',
      ruleId: 'rule_iran_bazaar_18k_v1',
    };

    const req = new NextRequest('http://localhost:3000/api/v1/pricing/calculate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.finalPrice).toBeDefined();
    expect(json.data.finalPrice.currency).toBe('USD');
    expect(json.data.breakdown).toBeDefined();
    expect(json.data.breakdown.lineItems.length).toBeGreaterThan(0);
    expect(json.data.inputs.weightGrams).toBe('10');
    expect(json.data.ruleReference.ruleId).toBe('rule_iran_bazaar_18k_v1');
    expect(json.data.ruleReference.effectiveConfig).toBeDefined();
  });

  it('returns HTTP 422 EXPLICIT_RULE_REQUIRED when ruleId is omitted and no tenant rule is configured', async () => {
    await seedObservation('XAU/USD', '2650.00');

    const body = {
      weight: { grams: '10.0' },
      purity: { karat: '18' },
      targetCurrency: 'USD',
      instrumentSymbol: 'XAU/USD',
      // ruleId explicitly omitted
    };

    const req = new NextRequest('http://localhost:3000/api/v1/pricing/calculate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('EXPLICIT_RULE_REQUIRED');
  });

  it('rejects gemstone carats as gold body mass with explicit error', async () => {
    await seedObservation('XAU/USD', '2650.00');

    const body = {
      weight: { carats: '5.0' }, // Gemstone carats passed as gold weight!
      purity: { karat: '18' },
      targetCurrency: 'USD',
      instrumentSymbol: 'XAU/USD',
      ruleId: 'rule_iran_bazaar_18k_v1',
    };

    const req = new NextRequest('http://localhost:3000/api/v1/pricing/calculate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_WEIGHT');
    expect(json.error.message).toContain('Carats (ct) are reserved exclusively for gemstone mass');
  });

  it('returns HTTP 400 when request body fails Zod validation', async () => {
    // Missing both weight and purity
    const body = {
      targetCurrency: 'USD',
      instrumentSymbol: 'XAU/USD',
    };

    const req = new NextRequest('http://localhost:3000/api/v1/pricing/calculate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns HTTP 503 when market data is unavailable', async () => {
    // Unknown instrument symbol
    const body = {
      weight: { grams: '5.0' },
      purity: { fineness: '750' },
      targetCurrency: 'USD',
      instrumentSymbol: 'NON_EXISTENT/USD',
      ruleId: 'rule_iran_bazaar_18k_v1',
    };

    const req = new NextRequest('http://localhost:3000/api/v1/pricing/calculate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('MARKET_DATA_UNAVAILABLE');
  });

  it('returns HTTP 422 when market observation is stale without override', async () => {
    // Seed 1 hour old observation on XAU/EUR
    const oldDate = new Date(Date.now() - 60 * 60 * 1000);
    await seedObservation('XAU/EUR', '2450.00', oldDate);

    const body = {
      weight: { grams: '5.0' },
      purity: { karat: '18' },
      targetCurrency: 'EUR',
      instrumentSymbol: 'XAU/EUR',
      ruleId: 'rule_iran_bazaar_18k_v1',
      allowStaleMarketData: false,
    };

    const req = new NextRequest('http://localhost:3000/api/v1/pricing/calculate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('MARKET_DATA_STALE');
  });
});
