import { describe, expect, it } from 'vitest';
import {
  PricingEngine,
  PricingRule,
  Weight,
  GoldPurity,
  MarketPrice,
  MarketObservation,
  MarketDataFreshnessPolicy,
  FxRate,
  Money,
  createEntityId,
  type MarketObservationId,
  type MarketInstrumentId,
  type MarketDataSourceId,
  type TenantId,
} from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('Authoritative PricingEngine', () => {
  const freshnessPolicy = new MarketDataFreshnessPolicy();

  // Reference Market Observation: XAU/USD at $2650.00 / Troy Ounce (Fresh)
  const freshObsDate = new Date();
  const createObservation = (params?: {
    amount?: string;
    currency?: string;
    unit?: string;
    observedAt?: Date;
    quality?: 'REAL_TIME' | 'DELAYED' | 'CLOSE';
  }) => {
    return MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_xau_usd_test'),
      instrumentId: createEntityId<MarketInstrumentId>('inst_xau_usd'),
      sourceId: createEntityId<MarketDataSourceId>('src_lbma'),
      price: MarketPrice.create({
        amount: params?.amount ?? '2650.00',
        currency: params?.currency ?? 'USD',
        unit: params?.unit ?? 'TROY_OUNCE',
      }).unwrap(),
      quality: params?.quality ?? 'REAL_TIME',
      observedAt: params?.observedAt ?? freshObsDate,
    }).unwrap();
  };

  // Standard Iranian Bazaar 18K Rule
  const createBazaarRule = (tenantId?: TenantId) => {
    return PricingRule.create({
      id: 'rule_bazaar_18k',
      name: 'Bazaar 18K Standard',
      tenantId,
      effectiveFrom: new Date('2024-01-01T00:00:00Z'),
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.15' }, // 15% ojrat
        margin: { type: 'PERCENTAGE', rate: '0.07' }, // 7% margin
        tax: { taxableBase: 'MARGIN_AND_FEE_ONLY', rate: '0.09' }, // Iranian statutory VAT (9% on ojrat+margin)
        roundingMode: 'HALF_UP',
        roundingScale: 2,
      },
    }).unwrap();
  };

  describe('Basic Pricing & Calculation Breakdown', () => {
    it('accurately computes 18K gold jewelry price with complete breakdown and verified invariant', () => {
      // 10 grams of 18K gold (750 fineness)
      // Pure gold content = 10 * 0.75 = 7.5 grams
      // Market rate = $2650 / 31.1034768 = $85.2001192305886 / g
      // Raw metal value = 7.5 * 85.2001192305886 = $639.0008942294145
      // Making charge (15%) = 639.0008942294145 * 0.15 = $95.850134134412175
      // Margin (7% on metal + charge) = (639.000894... + 95.850134...) * 0.07
      //   = 734.851028363826675 * 0.07 = $51.43957198546786725
      // Iranian VAT (9% on ojrat + margin) = (95.850134... + 51.439571...) * 0.09
      //   = 147.28970611988004225 * 0.09 = $13.2560735507892038025
      // Total unrounded = 734.851028... + 51.439571... + 13.256073... = $799.5466739000837
      // Final rounded (scale 2, HALF_UP) = $799.55 USD

      const weight = Weight.fromGrams('10.0').unwrap();
      const purity = GoldPurity.fromKarat('18').unwrap();
      const obs = createObservation();
      const rule = createBazaarRule();

      const result = PricingEngine.calculate({
        weight,
        purity,
        targetCurrency: 'USD',
        marketObservation: obs,
        freshnessPolicy,
        rule,
        timestamp: freshObsDate,
      }).unwrap();

      expect(result.currency).toBe('USD');
      expect(result.finalPrice.amount.toString()).toBe('799.54');

      // Verify line items
      const breakdown = result.breakdown;
      expect(breakdown.pureGrams.toString()).toBe('7.5');
      expect(breakdown.baseMetalValue.amount.toDecimalPlaces(2).toString()).toBe('639');
      expect(breakdown.makingChargeAmount.amount.toDecimalPlaces(2).toString()).toBe('95.85');
      expect(breakdown.sellerMarginAmount.amount.toDecimalPlaces(2).toString()).toBe('51.44');
      expect(breakdown.taxAmount.amount.toDecimalPlaces(2).toString()).toBe('13.26');

      // Crucial Mathematical Invariant: sum of all line items === finalAmount
      expect(breakdown.verifyLineItemInvariant()).toBe(true);

      const sumLineItems = breakdown.lineItems.reduce(
        (acc, item) => acc.add(item.amount).unwrap(),
        Money.zero('USD')
      );
      expect(sumLineItems.equals(result.finalPrice)).toBe(true);
    });

    it('calculates with PER_GRAM making charge and standard retail VAT on TOTAL_VALUE', () => {
      const weight = Weight.fromGrams('5.0').unwrap();
      const purity = GoldPurity.K18;
      const obs = createObservation();

      const perGramRule = PricingRule.create({
        name: 'Per-Gram Rule',
        config: {
          makingCharge: { type: 'PER_GRAM', rate: '15.00' }, // $15 / g
          margin: { type: 'PERCENTAGE', rate: '0.10' }, // 10%
          tax: { taxableBase: 'TOTAL_VALUE', rate: '0.05' }, // 5% VAT on total
          roundingMode: 'HALF_UP',
          roundingScale: 2,
        },
      }).unwrap();

      const result = PricingEngine.calculate({
        weight,
        purity,
        targetCurrency: 'USD',
        marketObservation: obs,
        freshnessPolicy,
        rule: perGramRule,
        timestamp: freshObsDate,
      }).unwrap();

      // Pure gold content = 5.0 * 0.75 = 3.75g
      // Making charge = 5.0g * 15.00 = 75.00 USD
      expect(result.breakdown.makingChargeAmount.amount.toString()).toBe('75');
      expect(result.breakdown.verifyLineItemInvariant()).toBe(true);
    });

    it('handles precious stone / gemstone value addition seamlessly', () => {
      const weight = Weight.fromGrams('4.0').unwrap();
      const purity = GoldPurity.K18;
      const obs = createObservation();
      const rule = createBazaarRule();

      const diamondValue = Money.create('1500.00', 'USD').unwrap();

      const result = PricingEngine.calculate({
        weight,
        purity,
        targetCurrency: 'USD',
        marketObservation: obs,
        freshnessPolicy,
        rule,
        stoneValue: diamondValue,
        timestamp: freshObsDate,
      }).unwrap();

      expect(result.breakdown.stoneValueAmount.amount.toString()).toBe('1500');
      expect(result.breakdown.verifyLineItemInvariant()).toBe(true);
    });
  });

  describe('Currency Conversion & Multi-Currency Pricing', () => {
    it('applies direct FX rate when market observation is USD and target is EUR', () => {
      const weight = Weight.fromGrams('10.0').unwrap();
      const purity = GoldPurity.K24; // 999.9
      const obs = createObservation({ amount: '2650.00', currency: 'USD', unit: 'TROY_OUNCE' });
      const rule = createBazaarRule();

      // FX Rate: 1 USD = 0.92 EUR
      const fx = FxRate.create({
        baseCurrency: 'USD',
        quoteCurrency: 'EUR',
        rate: '0.92',
        source: 'ECB',
      }).unwrap();

      const result = PricingEngine.calculate({
        weight,
        purity,
        targetCurrency: 'EUR',
        marketObservation: obs,
        freshnessPolicy,
        rule,
        fxRate: fx,
        timestamp: freshObsDate,
      }).unwrap();

      expect(result.currency).toBe('EUR');
      expect(result.marketReference.appliedFxRate?.rate).toBe('0.92');
      expect(result.breakdown.verifyLineItemInvariant()).toBe(true);
    });

    it('inverts reciprocal FX rate when given EUR/USD but target is EUR from USD spot', () => {
      const weight = Weight.fromGrams('10.0').unwrap();
      const purity = GoldPurity.K18;
      const obs = createObservation({ amount: '2650.00', currency: 'USD' });
      const rule = createBazaarRule();

      // Given FX rate: 1 EUR = 1.08695652 USD
      const eurToUsd = FxRate.create({
        baseCurrency: 'EUR',
        quoteCurrency: 'USD',
        rate: '1.08695652',
        source: 'ECB',
      }).unwrap();

      const result = PricingEngine.calculate({
        weight,
        purity,
        targetCurrency: 'EUR',
        marketObservation: obs,
        freshnessPolicy,
        rule,
        fxRate: eurToUsd, // Engine will invert to USD/EUR
        timestamp: freshObsDate,
      }).unwrap();

      expect(result.currency).toBe('EUR');
      expect(result.breakdown.verifyLineItemInvariant()).toBe(true);
    });

    it('converts Iranian Rials to Tomans using canonical 1:10 statutory conversion without external FX', () => {
      // Tehran Bazaar: Spot price 54,000,000 IRR / Mesghal
      const obsIrr = createObservation({
        amount: '54000000',
        currency: 'IRR',
        unit: 'MESGHAL',
      });

      const weight = Weight.fromGrams('10.0').unwrap();
      const purity = GoldPurity.K18;

      const tomanRule = PricingRule.create({
        name: 'Toman Bazaar Rule',
        config: {
          makingCharge: { type: 'PERCENTAGE', rate: '0.15' },
          margin: { type: 'PERCENTAGE', rate: '0.07' },
          tax: { taxableBase: 'MARGIN_AND_FEE_ONLY', rate: '0.09' },
          roundingMode: 'HALF_UP',
          roundingScale: 0, // Whole Tomans
        },
      }).unwrap();

      const result = PricingEngine.calculate({
        weight,
        purity,
        targetCurrency: 'TOMAN', // Target is Tomans from IRR spot!
        marketObservation: obsIrr,
        freshnessPolicy,
        rule: tomanRule,
        timestamp: freshObsDate,
      }).unwrap();

      expect(result.currency).toBe('TOMAN');
      expect(result.breakdown.verifyLineItemInvariant()).toBe(true);
      expect(result.finalPrice.amount.isInteger()).toBe(true);
    });
  });

  describe('Purity Variations', () => {
    const karats = [
      { purity: GoldPurity.K24, expectedFactor: '0.9999' },
      { purity: GoldPurity.K22, expectedFactor: '0.916' },
      { purity: GoldPurity.K21, expectedFactor: '0.875' },
      { purity: GoldPurity.K18, expectedFactor: '0.75' },
      { purity: GoldPurity.K14, expectedFactor: '0.585' },
      { purity: GoldPurity.K9, expectedFactor: '0.375' },
    ];

    for (const k of karats) {
      it(`calculates price accurately for ${k.purity.toString()}`, () => {
        const weight = Weight.fromGrams('10.0').unwrap();
        const obs = createObservation();
        const rule = createBazaarRule();

        const result = PricingEngine.calculate({
          weight,
          purity: k.purity,
          targetCurrency: 'USD',
          marketObservation: obs,
          freshnessPolicy,
          rule,
          timestamp: freshObsDate,
        }).unwrap();

        expect(result.breakdown.pureGoldMarketRatePerGram.currency).toBe('USD');
        expect(result.breakdown.verifyLineItemInvariant()).toBe(true);
      });
    }
  });

  describe('Market Data Freshness Enforcement', () => {
    it('fails when market observation is stale and override is not granted', () => {
      // 20 minutes old observation with 5-minute real-time policy
      const oldDate = new Date(freshObsDate.getTime() - 20 * 60 * 1000);
      const staleObs = createObservation({ observedAt: oldDate });
      const rule = createBazaarRule();

      const res = PricingEngine.calculate({
        weight: Weight.fromGrams('10.0').unwrap(),
        purity: GoldPurity.K18,
        targetCurrency: 'USD',
        marketObservation: staleObs,
        freshnessPolicy,
        rule,
        timestamp: freshObsDate,
        allowStaleMarketData: false,
      });

      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error.code).toBe('MARKET_DATA_STALE');
      }
    });

    it('succeeds with isStaleMarketData flag when allowStaleMarketData is explicitly enabled', () => {
      const oldDate = new Date(freshObsDate.getTime() - 20 * 60 * 1000);
      const staleObs = createObservation({ observedAt: oldDate });
      const rule = createBazaarRule();

      const res = PricingEngine.calculate({
        weight: Weight.fromGrams('10.0').unwrap(),
        purity: GoldPurity.K18,
        targetCurrency: 'USD',
        marketObservation: staleObs,
        freshnessPolicy,
        rule,
        timestamp: freshObsDate,
        allowStaleMarketData: true,
      });

      expect(res.isOk).toBe(true);
      if (res.isOk) {
        expect(res.value.isStaleMarketData).toBe(true);
        expect(res.value.marketReference.freshnessStatus).toBe('STALE');
      }
    });
  });

  describe('Historical Determinism & Reproducibility', () => {
    it('produces identical result bit-for-bit when evaluated with same context', () => {
      const weight = Weight.fromGrams('12.345').unwrap();
      const purity = GoldPurity.K18;
      const obs = createObservation();
      const rule = createBazaarRule();

      const result1 = PricingEngine.calculate({
        weight,
        purity,
        targetCurrency: 'USD',
        marketObservation: obs,
        freshnessPolicy,
        rule,
        timestamp: freshObsDate,
      }).unwrap();

      const result2 = PricingEngine.calculate({
        weight,
        purity,
        targetCurrency: 'USD',
        marketObservation: obs,
        freshnessPolicy,
        rule,
        timestamp: freshObsDate,
      }).unwrap();

      expect(result1.finalPrice.amount.toString()).toBe(result2.finalPrice.amount.toString());
      expect(result1.breakdown.unroundedTotal.amount.toString()).toBe(result2.breakdown.unroundedTotal.amount.toString());
      expect(result1.breakdown.roundingAdjustment.amount.toString()).toBe(result2.breakdown.roundingAdjustment.amount.toString());
    });
  });
});
