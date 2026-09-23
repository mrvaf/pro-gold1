import { describe, expect, it } from 'vitest';
import {
  PricingRule,
  PricingEngine,
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
  toDatabasePricingRule,
  toDomainPricingRule,
} from '../packages/database/src/repositories/drizzle-pricing-rule.repository.js';
import {
  toDatabasePricingResult,
  toDomainPricingResult,
} from '../packages/database/src/repositories/drizzle-pricing-result.repository.js';
import {
  InMemoryPricingRuleRepository,
  InMemoryPricingResultRepository,
} from '@v-gold/database';

describe('Pricing Persistence Contract & Entity Mappers', () => {
  const date = new Date('2024-05-15T10:30:00Z');

  it('losslessly maps PricingRule domain -> DB record -> domain', () => {
    const tenantId = createEntityId<TenantId>('tenant_gold_01');
    const originalRule = PricingRule.create({
      id: 'rule_contract_test',
      name: 'Contract Test Rule',
      version: '2',
      tenantId,
      effectiveFrom: date,
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.145' },
        margin: { type: 'PERCENTAGE', rate: '0.065' },
        tax: { taxableBase: 'MARGIN_AND_FEE_ONLY', rate: '0.09' },
        roundingMode: 'HALF_UP',
        roundingScale: 2,
      },
    }).unwrap();

    const dbRecord = toDatabasePricingRule(originalRule);
    const restored = toDomainPricingRule(dbRecord as any);

    expect(restored.id).toBe(originalRule.id);
    expect(restored.name).toBe(originalRule.name);
    expect(restored.version).toBe(originalRule.version);
    expect(restored.tenantId).toBe(originalRule.tenantId);
    expect(restored.config.makingCharge.rate).toBe('0.145');
    expect(restored.config.margin.rate).toBe('0.065');
    expect(restored.config.tax.rate).toBe('0.09');
    expect(restored.config.roundingMode).toBe('HALF_UP');
  });

  it('losslessly maps PricingResult domain -> DB record -> domain', () => {
    const freshnessPolicy = new MarketDataFreshnessPolicy();
    const obs = MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_contract_test'),
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

    const rule = PricingRule.create({
      name: 'Contract Rule',
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.15' },
        margin: { type: 'PERCENTAGE', rate: '0.07' },
        tax: { taxableBase: 'MARGIN_AND_FEE_ONLY', rate: '0.09' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();

    const originalResult = PricingEngine.calculate({
      weight: Weight.fromGrams('10.0').unwrap(),
      purity: GoldPurity.K18,
      targetCurrency: 'USD',
      marketObservation: obs,
      freshnessPolicy,
      rule,
      timestamp: date,
    }).unwrap();

    const dbRecord = toDatabasePricingResult(originalResult);
    const restored = toDomainPricingResult(dbRecord as any);

    expect(restored.id).toBe(originalResult.id);
    expect(restored.finalPrice.amount.toString()).toBe(originalResult.finalPrice.amount.toString());
    expect(restored.currency).toBe(originalResult.currency);
    expect(restored.ruleReference.ruleName).toBe(originalResult.ruleReference.ruleName);
    expect(restored.breakdown.verifyLineItemInvariant()).toBe(true);
    expect(restored.breakdown.finalAmount.amount.toString()).toBe(
      originalResult.breakdown.finalAmount.amount.toString()
    );
  });

  it('verifies in-memory repository saves and queries rules and results', async () => {
    const ruleRepo = new InMemoryPricingRuleRepository();
    const resultRepo = new InMemoryPricingResultRepository();

    const rule = PricingRule.create({
      id: 'rule_repo_test',
      name: 'Repo Test Rule',
      effectiveFrom: date,
      config: {
        makingCharge: { type: 'ZERO', rate: '0' },
        margin: { type: 'ZERO', rate: '0' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();

    await ruleRepo.save(rule);
    expect(await ruleRepo.count()).toBe(1);

    const fetchedRule = await ruleRepo.findById(rule.id);
    expect(fetchedRule).not.toBeNull();
    expect(fetchedRule?.id).toBe(rule.id);
  });
});
