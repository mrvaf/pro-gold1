import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  BudgetAwarePricingEngine,
  Money,
  Weight,
  GoldPurity,
  PricingRule,
  MarketObservation,
  MarketPrice,
  MarketDataFreshnessPolicy,
  createEntityId,
  type PricingRuleId,
  type MarketObservationId,
  type MarketInstrumentId,
  type MarketDataSourceId,
  InsufficientBudgetError,
} from '@v-gold/core';

describe('Stage 12 Budget-Aware Pricing Engine Unit Tests', () => {
  const freshnessPolicy = new MarketDataFreshnessPolicy();

  // Spot gold price: 2000 USD per troy ounce
  const obs = MarketObservation.create({
    id: createEntityId<MarketObservationId>('obs-gold-1'),
    instrumentId: createEntityId<MarketInstrumentId>('XAU/USD'),
    sourceId: createEntityId<MarketDataSourceId>('src_mock'),
    price: MarketPrice.create({
      amount: '2000',
      currency: 'USD',
      unit: 'TROY_OUNCE',
    }).unwrap(),
    quality: 'REAL_TIME',
    observedAt: new Date(),
  }).unwrap();

  // Standard pricing rule: 10% making charge, 5% margin, 0% tax for simplicity
  const rule = PricingRule.create({
    id: createEntityId<PricingRuleId>('rule-budget-1'),
    name: 'Standard Budget Test Rule',
    config: {
      makingCharge: { type: 'PERCENTAGE', rate: '0.10' },
      margin: { type: 'PERCENTAGE', rate: '0.05' },
      tax: { taxableBase: 'EXEMPT', rate: '0.0' },
      roundingScale: 2,
      roundingMode: 'HALF_UP',
    },
    effectiveFrom: new Date('2020-01-01'),
  }).unwrap();

  it('calculates optimal viable weight and ensures calculated price never exceeds target budget ceiling', () => {
    const budgetCeiling = Money.create('1500.00', 'USD').unwrap();

    const result = BudgetAwarePricingEngine.solveViableConfigurations({
      budgetCeiling,
      targetKarats: [18, 24],
      marketObservation: obs,
      freshnessPolicy,
      rule,
      minWeightGrams: new Decimal('1.0'),
      maxWeightGrams: new Decimal('50.0'),
    });

    expect(result.isOk).toBe(true);
    if (result.isOk) {
      expect(result.value.length).toBe(2);

      for (const config of result.value) {
        expect(config.estimatedCost.amount.lte(budgetCeiling.amount)).toBe(true);
        expect(config.remainingBudget.amount.gte(0)).toBe(true);
        expect(config.weightGrams.gte(1.0)).toBe(true);
      }

      // 18K gold is 75% pure gold, while 24K is 99.9% pure gold
      // For the same budget, 18K piece should allow more total metal weight than 24K!
      const config18K = result.value.find((c) => c.karat === 18);
      const config24K = result.value.find((c) => c.karat === 24);

      expect(config18K).toBeDefined();
      expect(config24K).toBeDefined();
      if (config18K && config24K) {
        expect(config18K.weightGrams.gt(config24K.weightGrams)).toBe(true);
      }
    }
  });

  it('rejects budget when even the minimum weight exceeds budget ceiling', () => {
    const tinyBudget = Money.create('10.00', 'USD').unwrap(); // $10 cannot buy 1.0g gold

    const result = BudgetAwarePricingEngine.solveViableConfigurations({
      budgetCeiling: tinyBudget,
      targetKarats: [18, 24],
      marketObservation: obs,
      freshnessPolicy,
      rule,
      minWeightGrams: new Decimal('1.0'),
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toBeInstanceOf(InsufficientBudgetError);
    }
  });

  it('deducts stone allowance from budget and solves remaining gold metal weight accurately', () => {
    const totalBudget = Money.create('2000.00', 'USD').unwrap();
    const stoneAllowance = Money.create('500.00', 'USD').unwrap();

    const withStoneRes = BudgetAwarePricingEngine.solveViableConfigurations({
      budgetCeiling: totalBudget,
      stoneAllowance,
      targetKarats: [18],
      marketObservation: obs,
      freshnessPolicy,
      rule,
    });

    const withoutStoneRes = BudgetAwarePricingEngine.solveViableConfigurations({
      budgetCeiling: totalBudget,
      targetKarats: [18],
      marketObservation: obs,
      freshnessPolicy,
      rule,
    });

    expect(withStoneRes.isOk).toBe(true);
    expect(withoutStoneRes.isOk).toBe(true);

    if (withStoneRes.isOk && withoutStoneRes.isOk) {
      const configWithStone = withStoneRes.value[0];
      const configWithoutStone = withoutStoneRes.value[0];

      // Configuration with stone should have less gold metal weight due to stone cost deduction
      expect(configWithStone!.weightGrams.lt(configWithoutStone!.weightGrams)).toBe(true);
      expect(configWithStone!.estimatedCost.amount.lte(totalBudget.amount)).toBe(true);
    }
  });
});
