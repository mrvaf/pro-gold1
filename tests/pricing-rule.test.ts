import { describe, expect, it } from 'vitest';
import {
  PricingRule,
  createEntityId,
  type TenantId,
} from '@v-gold/core';

describe('PricingRule Entity & Rule Configuration', () => {
  it('successfully instantiates a valid PricingRule', () => {
    const rule = PricingRule.create({
      id: 'rule_test_18k',
      name: 'Test 18K Standard Rule',
      version: '1',
      effectiveFrom: new Date('2024-01-01T00:00:00Z'),
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.15' },
        margin: { type: 'PERCENTAGE', rate: '0.07' },
        tax: { taxableBase: 'MARGIN_AND_FEE_ONLY', rate: '0.09' },
        roundingMode: 'HALF_UP',
        roundingScale: 0,
      },
    }).unwrap();

    expect(rule.id).toBe('rule_test_18k');
    expect(rule.name).toBe('Test 18K Standard Rule');
    expect(rule.version).toBe('1');
    expect(rule.isSystemRule()).toBe(true);
    expect(rule.config.makingCharge.rate).toBe('0.15');
    expect(rule.config.margin.rate).toBe('0.07');
    expect(rule.config.tax.taxableBase).toBe('MARGIN_AND_FEE_ONLY');
  });

  it('evaluates effective dates accurately', () => {
    const rule = PricingRule.create({
      name: 'Time Bounded Rule',
      effectiveFrom: new Date('2024-01-01T00:00:00Z'),
      effectiveTo: new Date('2024-12-31T23:59:59Z'),
      config: {
        makingCharge: { type: 'ZERO', rate: '0' },
        margin: { type: 'ZERO', rate: '0' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();

    // Before effective date
    expect(rule.isEffectiveAt(new Date('2023-12-31T23:59:59Z'))).toBe(false);
    // During effective window
    expect(rule.isEffectiveAt(new Date('2024-06-15T12:00:00Z'))).toBe(true);
    // After expiration
    expect(rule.isEffectiveAt(new Date('2025-01-01T00:00:00Z'))).toBe(false);
  });

  it('rejects invalid configurations (negative rates, invalid rounding modes, invalid dates)', () => {
    // Negative making charge
    const negCharge = PricingRule.create({
      name: 'Invalid',
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '-0.05' },
        margin: { type: 'PERCENTAGE', rate: '0.07' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    });
    expect(negCharge.isErr).toBe(true);

    // Negative margin
    const negMargin = PricingRule.create({
      name: 'Invalid',
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.10' },
        margin: { type: 'PERCENTAGE', rate: '-0.02' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    });
    expect(negMargin.isErr).toBe(true);

    // Invalid rounding mode
    const badMode = PricingRule.create({
      name: 'Invalid',
      config: {
        makingCharge: { type: 'ZERO', rate: '0' },
        margin: { type: 'ZERO', rate: '0' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'INVALID_ROUNDING_MODE' as any,
      },
    });
    expect(badMode.isErr).toBe(true);

    // effectiveTo before effectiveFrom
    const badDates = PricingRule.create({
      name: 'Invalid',
      effectiveFrom: new Date('2024-10-01'),
      effectiveTo: new Date('2024-05-01'),
      config: {
        makingCharge: { type: 'ZERO', rate: '0' },
        margin: { type: 'ZERO', rate: '0' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    });
    expect(badDates.isErr).toBe(true);
  });

  it('binds rule to a specific tenant when tenantId is provided', () => {
    const tenantId = createEntityId<TenantId>('tenant_gold_bazaar_01');
    const rule = PricingRule.create({
      name: 'Store Custom Rule',
      tenantId,
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.12' },
        margin: { type: 'PERCENTAGE', rate: '0.05' },
        tax: { taxableBase: 'MARGIN_AND_FEE_ONLY', rate: '0.09' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();

    expect(rule.isSystemRule()).toBe(false);
    expect(rule.tenantId).toBe(tenantId);
  });
});
