import { describe, expect, it } from 'vitest';
import {
  PricingEngine,
  PricingRule,
  Weight,
  GoldPurity,
  MarketPrice,
  MarketObservation,
  MarketDataFreshnessPolicy,
  createEntityId,
  type MarketObservationId,
  type MarketInstrumentId,
  type MarketDataSourceId,
  type TenantId,
} from '@v-gold/core';
import {
  InMemoryPricingRuleRepository,
  InMemoryPricingResultRepository,
} from '@v-gold/database';

describe('Pricing Tenant Isolation & IDOR Protection', () => {
  const freshnessPolicy = new MarketDataFreshnessPolicy();
  const date = new Date();

  const obs = MarketObservation.create({
    id: createEntityId<MarketObservationId>('obs_tenant_iso'),
    instrumentId: createEntityId<MarketInstrumentId>('inst_xau_usd'),
    sourceId: createEntityId<MarketDataSourceId>('src_lbma'),
    price: MarketPrice.create({
      amount: '2650.00',
      currency: 'USD',
      unit: 'TROY_OUNCE',
    }).unwrap(),
    quality: 'REAL_TIME',
    observedAt: date,
  }).unwrap();

  const tenantA = createEntityId<TenantId>('tenant_alpha');
  const tenantB = createEntityId<TenantId>('tenant_beta');

  it('rejects cross-tenant rule execution with IDOR_ACCESS_DENIED', () => {
    // Tenant A custom rule
    const ruleTenantA = PricingRule.create({
      name: 'Tenant Alpha Proprietary Rule',
      tenantId: tenantA,
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.10' },
        margin: { type: 'PERCENTAGE', rate: '0.05' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();

    // Tenant B attempts to price using Tenant A's rule
    const res = PricingEngine.calculate({
      weight: Weight.fromGrams('10.0').unwrap(),
      purity: GoldPurity.K18,
      targetCurrency: 'USD',
      marketObservation: obs,
      freshnessPolicy,
      rule: ruleTenantA,
      tenantId: tenantB, // MISMATCH
      timestamp: date,
    });

    expect(res.isErr).toBe(true);
    if (res.isErr) {
      expect(res.error.code).toBe('IDOR_ACCESS_DENIED');
      expect(res.error.httpStatus).toBe(403);
    }
  });

  it('allows system rules to be used by any tenant', () => {
    // System rule (no tenantId)
    const systemRule = PricingRule.create({
      name: 'System Global Rule',
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.15' },
        margin: { type: 'PERCENTAGE', rate: '0.07' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();

    const resA = PricingEngine.calculate({
      weight: Weight.fromGrams('10.0').unwrap(),
      purity: GoldPurity.K18,
      targetCurrency: 'USD',
      marketObservation: obs,
      freshnessPolicy,
      rule: systemRule,
      tenantId: tenantA,
      timestamp: date,
    });
    expect(resA.isOk).toBe(true);

    const resB = PricingEngine.calculate({
      weight: Weight.fromGrams('10.0').unwrap(),
      purity: GoldPurity.K18,
      targetCurrency: 'USD',
      marketObservation: obs,
      freshnessPolicy,
      rule: systemRule,
      tenantId: tenantB,
      timestamp: date,
    });
    expect(resB.isOk).toBe(true);
  });

  it('strictly isolates persisted pricing results between tenants in repository queries', async () => {
    const resultRepo = new InMemoryPricingResultRepository();

    const systemRule = PricingRule.create({
      name: 'System Global Rule',
      config: {
        makingCharge: { type: 'ZERO', rate: '0' },
        margin: { type: 'ZERO', rate: '0' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();

    const quoteA = PricingEngine.calculate({
      weight: Weight.fromGrams('10.0').unwrap(),
      purity: GoldPurity.K18,
      targetCurrency: 'USD',
      marketObservation: obs,
      freshnessPolicy,
      rule: systemRule,
      tenantId: tenantA,
      timestamp: date,
    }).unwrap();

    const quoteB = PricingEngine.calculate({
      weight: Weight.fromGrams('20.0').unwrap(),
      purity: GoldPurity.K18,
      targetCurrency: 'USD',
      marketObservation: obs,
      freshnessPolicy,
      rule: systemRule,
      tenantId: tenantB,
      timestamp: date,
    }).unwrap();

    await resultRepo.save(quoteA);
    await resultRepo.save(quoteB);

    const listA = await resultRepo.findByTenant(tenantA);
    expect(listA.length).toBe(1);
    expect(listA[0].id).toBe(quoteA.id);

    const listB = await resultRepo.findByTenant(tenantB);
    expect(listB.length).toBe(1);
    expect(listB[0].id).toBe(quoteB.id);

    // Cross-tenant findById check
    const crossFetch = await resultRepo.findById(quoteA.id, tenantB);
    expect(crossFetch).toBeNull();
  });
});
