import { describe, expect, it, beforeAll } from 'vitest';
import {
  Tenant,
  Store,
  User,
  Email,
  PasswordHash,
  TenantMembership,
  Session,
  createEntityId,
  type TenantId,
  type StoreId,
} from '@v-gold/core';
import { getDefaultAuthService } from '../apps/web/lib/auth/auth.service.js';
import { getCatalogContainer } from '../apps/web/lib/catalog/catalog-container.js';
import { SESSION_COOKIE_NAME } from '../apps/web/lib/auth/session-cookie.js';
import { NextRequest } from 'next/server';
import { POST } from '../apps/web/app/api/v1/pricing/calculate/route.js';
import { getMarketDataContainer } from '../apps/web/lib/market-data/market-data-container.js';
import {
  MarketObservation,
  MarketPrice,
  type MarketObservationId,
  type MarketInstrumentId,
  type MarketDataSourceId,
} from '@v-gold/core';

describe('Pricing Web API (POST /api/v1/pricing/calculate)', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    const authService = getDefaultAuthService();
    const catalogContainer = getCatalogContainer();

    const tId = createEntityId<TenantId>('tenant_api_pricing_test');
    const tenant = Tenant.create({ id: tId, name: 'API Pricing Test Tenant', slug: 'api-pricing-test' }).unwrap();
    await authService.tenantRepository.save(tenant);

    const sId = createEntityId<StoreId>('store_api_pricing_test');
    const store = Store.create({ id: sId, tenantId: tId, name: 'API Pricing Test Store', code: 'PRC01' }).unwrap();
    await catalogContainer.storeRepo.save(tId, store);

    const owner = User.create({
      email: Email.create('owner@api-pricing-test.vgold').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'API Pricing Owner',
    }).unwrap();
    await authService.userRepository.save(owner);

    const membership = TenantMembership.create({ tenantId: tId, userId: owner.id, role: 'OWNER' }).unwrap();
    await authService.membershipRepository.save(membership);

    const session = Session.create({ id: 'a1'.repeat(32), userId: owner.id }).unwrap();
    await authService.sessionRepository.save(session);
    sessionCookie = `${SESSION_COOKIE_NAME}=${session.id}`;
  });
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
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
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
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
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
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
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
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
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
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
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
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('MARKET_DATA_STALE');
  });
});
