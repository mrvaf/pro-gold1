import { describe, expect, it } from 'vitest';
import {
  PricingEngine,
  PricingRule,
  Weight,
  GoldPurity,
  MarketPrice,
  MarketObservation,
  MarketInstrument,
  MarketDataFreshnessPolicy,
  Money,
  createEntityId,
  type MarketObservationId,
  type MarketInstrumentId,
  type MarketDataSourceId,
  type TenantId,
} from '@v-gold/core';
import {
  InMemoryPricingRuleRepository,
  InMemoryPricingResultRepository,
  InMemoryMarketInstrumentRepository,
  InMemoryMarketObservationRepository,
  InMemoryFxRateRepository,
} from '@v-gold/database';
import { PricingService } from '../apps/web/lib/pricing/pricing-service.js';
import { Decimal } from 'decimal.js';

describe('Pricing Specification Audit & Correction Suite', () => {
  const freshnessPolicy = new MarketDataFreshnessPolicy();
  const evaluationDate = new Date('2024-06-01T12:00:00Z');

  const createObs = () =>
    MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_spec_audit'),
      instrumentId: createEntityId<MarketInstrumentId>('inst_xau_usd'),
      sourceId: createEntityId<MarketDataSourceId>('src_lbma'),
      price: MarketPrice.create({
        amount: '2650.00',
        currency: 'USD',
        unit: 'TROY_OUNCE',
      }).unwrap(),
      quality: 'REAL_TIME',
      observedAt: evaluationDate,
    }).unwrap();

  // Test 1: Reference Rule cannot become silent production default
  it('1. Reference Rule cannot become silent production default', async () => {
    const ruleRepo = new InMemoryPricingRuleRepository();

    // Save a reference sample rule
    const sampleRule = PricingRule.create({
      id: 'rule_iran_bazaar_sample',
      name: '[REFERENCE_SAMPLE_ONLY] Bazaar 18K Model',
      isReferenceSample: true,
      specificationSource: 'REFERENCE_SAMPLE_NON_AUTHORITATIVE',
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.15' },
        margin: { type: 'PERCENTAGE', rate: '0.07' },
        tax: { taxableBase: 'MARGIN_AND_FEE_ONLY', rate: '0.09' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();
    await ruleRepo.save(sampleRule);

    // Standard query without explicit ruleId must NOT return the reference sample
    const effective = await ruleRepo.findEffective({
      atDate: evaluationDate,
      includeReferenceSamples: false,
    });
    expect(effective).toBeNull();
  });

  // Test 2: Missing explicit rule with no tenant configuration returns explicit error
  it('2. Missing explicit rule with no tenant configuration returns EXPLICIT_RULE_REQUIRED', async () => {
    const ruleRepo = new InMemoryPricingRuleRepository();
    const resultRepo = new InMemoryPricingResultRepository();
    const obsRepo = new InMemoryMarketObservationRepository();
    const instRepo = new InMemoryMarketInstrumentRepository();
    const fxRepo = new InMemoryFxRateRepository();

    const inst = MarketInstrument.create({
      id: 'inst_xau_usd',
      symbol: 'XAU/USD',
      baseAsset: 'XAU',
      quoteCurrency: 'USD',
      unit: 'TROY_OUNCE',
      displayName: 'Gold Spot USD',
    }).unwrap();
    await instRepo.save(inst);

    const obs = createObs();
    await obsRepo.save(obs);

    const service = new PricingService(ruleRepo, resultRepo, obsRepo, instRepo, fxRepo, freshnessPolicy);

    const result = await service.calculateQuote({
      weightInput: { grams: '10.0' },
      purityInput: { karat: '18' },
      targetCurrency: 'USD',
      instrumentSymbol: 'XAU/USD',
      // ruleId is omitted and no tenant rule exists
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error.code).toBe('EXPLICIT_RULE_REQUIRED');
      expect(result.error.httpStatus).toBe(422);
      expect(result.error.message).toContain('No explicit ruleId provided');
    }
  });

  // Test 3: No hidden commercial percentage exists in PricingEngine
  it('3. No hidden commercial percentage exists in PricingEngine', () => {
    // When rule configures 0% making charge, 0% margin, and EXEMPT tax,
    // the final price must equal pure metal value exactly with zero hidden markups
    const zeroRule = PricingRule.create({
      name: 'Zero Commercial Markup Rule',
      config: {
        makingCharge: { type: 'ZERO', rate: '0.00' },
        margin: { type: 'ZERO', rate: '0.00' },
        tax: { taxableBase: 'EXEMPT', rate: '0.00' },
        roundingMode: 'HALF_UP',
        roundingScale: 4,
      },
    }).unwrap();

    const weight = Weight.fromGrams('10.0').unwrap();
    const purity = GoldPurity.fromKarat('24').unwrap(); // pure gold
    const obs = createObs();

    const result = PricingEngine.calculate({
      weight,
      purity,
      targetCurrency: 'USD',
      marketObservation: obs,
      freshnessPolicy,
      rule: zeroRule,
      timestamp: evaluationDate,
    }).unwrap();

    expect(result.breakdown.makingChargeAmount.isZero()).toBe(true);
    expect(result.breakdown.sellerMarginAmount.isZero()).toBe(true);
    expect(result.breakdown.taxAmount.isZero()).toBe(true);
    expect(result.finalPrice.amount.toString()).toBe(result.breakdown.baseMetalValue.amount.toDecimalPlaces(4).toString());
  });

  // Test 4: Reference rules are distinguishable from authoritative rules
  it('4. Reference rules are distinguishable from authoritative rules', () => {
    const refRule = PricingRule.create({
      id: 'rule_ref_sample',
      name: 'Sample Model',
      isReferenceSample: true,
      specificationSource: 'SAMPLE_SPECIFICATION_NON_PROD',
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.12' },
        margin: { type: 'PERCENTAGE', rate: '0.05' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();

    const authRule = PricingRule.create({
      id: 'rule_auth_tenant_01',
      name: 'Store Agreement 2024 Rule',
      tenantId: createEntityId<TenantId>('tenant_store_01'),
      isReferenceSample: false,
      specificationSource: 'STORE_AGREEMENT_2024_SIGNED',
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.12' },
        margin: { type: 'PERCENTAGE', rate: '0.05' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();

    expect(refRule.isReferenceSample).toBe(true);
    expect(refRule.specificationSource).toBe('SAMPLE_SPECIFICATION_NON_PROD');

    expect(authRule.isReferenceSample).toBe(false);
    expect(authRule.specificationSource).toBe('STORE_AGREEMENT_2024_SIGNED');
  });

  // Test 5: Gemstone carat cannot become gold mass
  it('5. Gemstone carat cannot become gold mass', async () => {
    const ruleRepo = new InMemoryPricingRuleRepository();
    const resultRepo = new InMemoryPricingResultRepository();
    const obsRepo = new InMemoryMarketObservationRepository();
    const instRepo = new InMemoryMarketInstrumentRepository();
    const fxRepo = new InMemoryFxRateRepository();

    const obs = createObs();
    await obsRepo.save(obs);

    const rule = PricingRule.create({
      id: 'rule_auth',
      name: 'Auth Rule',
      config: {
        makingCharge: { type: 'ZERO', rate: '0' },
        margin: { type: 'ZERO', rate: '0' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();
    await ruleRepo.save(rule);

    const service = new PricingService(ruleRepo, resultRepo, obsRepo, instRepo, fxRepo, freshnessPolicy);

    const result = await service.calculateQuote({
      weightInput: { carats: '5.0' }, // Carats passed as gold weight!
      purityInput: { karat: '18' },
      targetCurrency: 'USD',
      instrumentSymbol: 'inst_xau_usd',
      ruleId: 'rule_auth',
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error.code).toBe('INVALID_WEIGHT');
      expect(result.error.message).toContain('Carats (ct) are reserved exclusively for gemstone mass');
    }
  });

  // Test 6 & 7: Historical PricingResult survives PricingRule modification; Rule snapshot is sufficient for reproducibility
  it('6 & 7. Historical PricingResult survives PricingRule modification and rule snapshot is sufficient', () => {
    const originalRule = PricingRule.create({
      id: 'rule_mutable_test',
      name: 'Initial 10% Making Rule',
      version: '1',
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.10' },
        margin: { type: 'PERCENTAGE', rate: '0.05' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
        roundingScale: 2,
      },
    }).unwrap();

    const weight = Weight.fromGrams('10.0').unwrap();
    const purity = GoldPurity.K18;
    const obs = createObs();

    const historicalResult = PricingEngine.calculate({
      weight,
      purity,
      targetCurrency: 'USD',
      marketObservation: obs,
      freshnessPolicy,
      rule: originalRule,
      timestamp: evaluationDate,
    }).unwrap();

    const historicalFinalPrice = historicalResult.finalPrice.amount.toString();
    const historicalMakingCharge = historicalResult.breakdown.makingChargeAmount.amount.toString();

    // Now, simulate rule update to version 2 with 25% making charge
    const updatedRuleV2 = PricingRule.create({
      id: 'rule_mutable_test',
      name: 'Updated 25% Making Rule',
      version: '2',
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.25' }, // Changed to 25%!
        margin: { type: 'PERCENTAGE', rate: '0.05' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
        roundingScale: 2,
      },
    }).unwrap();

    // The historical result's snapshotted effectiveConfig must remain completely unchanged!
    expect(historicalResult.ruleReference.ruleVersion).toBe('1');
    expect(historicalResult.ruleReference.effectiveConfig.makingCharge.rate).toBe('0.10');
    expect(historicalResult.finalPrice.amount.toString()).toBe(historicalFinalPrice);
    expect(historicalResult.breakdown.makingChargeAmount.amount.toString()).toBe(historicalMakingCharge);

    // Calculating with the new rule V2 produces different future pricing without altering historicalResult
    const newResult = PricingEngine.calculate({
      weight,
      purity,
      targetCurrency: 'USD',
      marketObservation: obs,
      freshnessPolicy,
      rule: updatedRuleV2,
      timestamp: evaluationDate,
    }).unwrap();

    expect(newResult.finalPrice.amount.toString()).not.toBe(historicalFinalPrice);
    expect(newResult.ruleReference.ruleVersion).toBe('2');
  });

  // Test 8: Statutory tax configuration is separated from commercial making/margin
  it('8. Statutory tax configuration (MARGIN_AND_FEE_ONLY) is separated from commercial making/margin', () => {
    // Iranian Article 26 VAT rule combined with an arbitrary custom commercial making charge (e.g. 23.5% ojrat, 4.2% margin)
    const customCommercialRule = PricingRule.create({
      name: 'Custom Artisan Making with Statutory VAT',
      specificationSource: 'VAT_ARTICLE_26_LAW_1400',
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.235' }, // 23.5% custom artisan ojrat
        margin: { type: 'PERCENTAGE', rate: '0.042' }, // 4.2% negotiated margin
        tax: { taxableBase: 'MARGIN_AND_FEE_ONLY', rate: '0.09' }, // 9% statutory VAT on ojrat+margin
        roundingMode: 'HALF_UP',
        roundingScale: 2,
      },
    }).unwrap();

    const weight = Weight.fromGrams('10.0').unwrap();
    const purity = GoldPurity.K18;
    const obs = createObs();

    const result = PricingEngine.calculate({
      weight,
      purity,
      targetCurrency: 'USD',
      marketObservation: obs,
      freshnessPolicy,
      rule: customCommercialRule,
      timestamp: evaluationDate,
    }).unwrap();

    // Verify taxable base is exactly makingCharge + margin
    const expectedTaxableBase = result.breakdown.makingChargeAmount.add(result.breakdown.sellerMarginAmount).unwrap();
    expect(result.breakdown.taxableAmount.amount.toString()).toBe(expectedTaxableBase.amount.toString());

    // Verify tax is exactly 9% of taxable base
    const expectedTax = expectedTaxableBase.multiply('0.09').unwrap();
    expect(result.breakdown.taxAmount.amount.toString()).toBe(expectedTax.amount.toString());
    expect(result.breakdown.verifyLineItemInvariant()).toBe(true);
  });

  // Test 9: Breakdown invariant remains valid
  it('9. Breakdown invariant remains valid across diverse configurations', () => {
    const complexRule = PricingRule.create({
      name: 'Complex Invariant Test Rule',
      config: {
        makingCharge: { type: 'PER_GRAM', rate: '27.45' },
        margin: { type: 'PERCENTAGE', rate: '0.0825' },
        tax: { taxableBase: 'TOTAL_VALUE', rate: '0.19' }, // 19% VAT
        roundingMode: 'HALF_UP',
        roundingScale: 2,
      },
    }).unwrap();

    const result = PricingEngine.calculate({
      weight: Weight.fromGrams('14.872').unwrap(),
      purity: GoldPurity.K18,
      targetCurrency: 'USD',
      marketObservation: createObs(),
      freshnessPolicy,
      rule: complexRule,
      stoneValue: Money.create('340.50', 'USD').unwrap(),
      timestamp: evaluationDate,
    }).unwrap();

    expect(result.breakdown.verifyLineItemInvariant()).toBe(true);
  });

  // Test 10: Tenant isolation remains valid
  it('10. Tenant isolation remains valid', () => {
    const tenantAlpha = createEntityId<TenantId>('tenant_alpha_vault');
    const tenantBeta = createEntityId<TenantId>('tenant_beta_vault');

    const alphaRule = PricingRule.create({
      name: 'Alpha Secret Formula',
      tenantId: tenantAlpha,
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.05' },
        margin: { type: 'PERCENTAGE', rate: '0.02' },
        tax: { taxableBase: 'EXEMPT', rate: '0' },
        roundingMode: 'HALF_UP',
      },
    }).unwrap();

    const crossTenantAttempt = PricingEngine.calculate({
      weight: Weight.fromGrams('10.0').unwrap(),
      purity: GoldPurity.K18,
      targetCurrency: 'USD',
      marketObservation: createObs(),
      freshnessPolicy,
      rule: alphaRule,
      tenantId: tenantBeta, // Access attempt by Beta!
      timestamp: evaluationDate,
    });

    expect(crossTenantAttempt.isErr).toBe(true);
    if (crossTenantAttempt.isErr) {
      expect(crossTenantAttempt.error.code).toBe('IDOR_ACCESS_DENIED');
      expect(crossTenantAttempt.error.httpStatus).toBe(403);
    }
  });
});
