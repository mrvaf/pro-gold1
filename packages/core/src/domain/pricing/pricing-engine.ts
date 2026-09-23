import { Decimal } from 'decimal.js';
import { err, ok, type Result } from '../../common/result.js';
import { Money } from '../finance/money.js';
import { CURRENCY_METADATA, type CurrencyCode } from '../finance/currency.js';
import { ROUNDING_MODES } from '../finance/rounding-policy.js';
import type { FxRate } from '../finance/fx-rate.js';
import type { Weight } from '../material/weight.js';
import type { GoldPurity } from '../material/gold-purity.js';
import type { MarketObservation } from '../market-data/market-observation.js';
import type { MarketDataFreshnessPolicy } from '../market-data/market-data-freshness.policy.js';
import type { TenantId } from '../tenant/tenant.js';
import type { StoreId } from '../tenant/store.js';
import { PricingError } from './pricing-error.js';
import { PricingUnitConverter } from './pricing-unit-converter.js';
import type { PricingRule } from './pricing-rule.js';
import { PricingBreakdown } from './pricing-breakdown.js';
import {
  PricingResult,
  type PricingResultId,
  type MarketReferenceSnapshot,
} from './pricing-result.js';
import { createEntityId } from '../../common/id.js';
import crypto from 'node:crypto';

export interface PricingContext {
  readonly weight: Weight;
  readonly purity: GoldPurity;
  readonly targetCurrency: CurrencyCode;
  readonly marketObservation: MarketObservation;
  readonly freshnessPolicy: MarketDataFreshnessPolicy;
  readonly rule: PricingRule;
  readonly timestamp?: Date | undefined;
  readonly allowStaleMarketData?: boolean | undefined;
  readonly fxRate?: FxRate | undefined;
  readonly stoneValue?: Money | undefined;
  readonly tenantId?: TenantId | undefined;
  readonly storeId?: StoreId | undefined;
  readonly resultId?: string | undefined;
}

/**
 * Authoritative Pricing Engine.
 *
 * Core Mandates:
 * 1. Pure, deterministic, Decimal-safe, and auditable calculation.
 * 2. Intermediate formulas NEVER round prematurely; explicit rounding is performed strictly at the final boundary.
 * 3. Market data freshness is evaluated and enforced (UNAVAILABLE always fails; STALE fails unless explicit override).
 * 4. Breakdown line items strictly sum to finalAmount (verified by invariant test).
 * 5. Supports standard Iranian bazaar formulas (VAT on ojrat + margin only) and international luxury formulas.
 */
export class PricingEngine {
  /**
   * Executes authoritative precious metal jewelry pricing for a given context.
   */
  static calculate(context: PricingContext): Result<PricingResult, PricingError> {
    const evaluationDate = context.timestamp ?? new Date();

    // 1. Validate Tenant Isolation for Rule (Checked first to prevent IDOR leaks)
    if (context.rule.tenantId !== undefined) {
      if (!context.tenantId || context.rule.tenantId !== context.tenantId) {
        return err(
          PricingError.idorAccessDenied(
            `pricing rule "${context.rule.id}" configured for tenant "${context.rule.tenantId}"`
          )
        );
      }
    }

    // 2. Validate Pricing Rule Effectiveness
    if (!context.rule.isEffectiveAt(evaluationDate)) {
      if (
        context.rule.effectiveTo &&
        evaluationDate.getTime() > context.rule.effectiveTo.getTime()
      ) {
        return err(PricingError.ruleExpired(context.rule.id, context.rule.effectiveTo));
      }
      return err(
        PricingError.configurationError(
          `Pricing rule "${context.rule.id}" is not yet effective at evaluation date ${evaluationDate.toISOString()}.`
        )
      );
    }

    // 3. Evaluate Market Observation Freshness
    const freshnessStatus = context.freshnessPolicy.evaluate(
      context.marketObservation,
      evaluationDate
    );

    if (freshnessStatus === 'UNAVAILABLE') {
      return err(PricingError.marketDataUnavailable(context.marketObservation.instrumentId));
    }

    let isStaleMarketData = false;
    if (freshnessStatus === 'STALE') {
      if (!context.allowStaleMarketData) {
        const ageMinutes =
          context.freshnessPolicy.getAgeMs(context.marketObservation, evaluationDate) / (60 * 1000);
        return err(
          PricingError.marketDataStale(
            context.marketObservation.instrumentId,
            context.marketObservation.observedAt,
            ageMinutes
          )
        );
      }
      isStaleMarketData = true;
    }

    // 4. Convert Market Quoted Price to Canonical Price Per Gram
    const unitConversion = PricingUnitConverter.getPricePerGram(context.marketObservation.price);
    if (unitConversion.isErr) {
      return err(unitConversion.error);
    }
    const rawPricePerGramInMarketCurrency = unitConversion.value.pricePerGram;
    const marketCurrency = context.marketObservation.price.currency;

    // 5. Currency Alignment & Conversion
    let pureGoldMarketRatePerGram: Money;
    let appliedFxRateSnapshot: MarketReferenceSnapshot['appliedFxRate'] = undefined;

    if (marketCurrency === context.targetCurrency) {
      pureGoldMarketRatePerGram = Money.fromDecimal(
        rawPricePerGramInMarketCurrency,
        context.targetCurrency
      );
    } else if (marketCurrency === 'TOMAN' && context.targetCurrency === 'IRR') {
      // Deterministic 1 Toman = 10 Rials
      pureGoldMarketRatePerGram = Money.fromDecimal(
        rawPricePerGramInMarketCurrency.times(10),
        'IRR'
      );
    } else if (marketCurrency === 'IRR' && context.targetCurrency === 'TOMAN') {
      // Deterministic 10 Rials = 1 Toman
      pureGoldMarketRatePerGram = Money.fromDecimal(
        rawPricePerGramInMarketCurrency.times('0.1'),
        'TOMAN'
      );
    } else {
      // External FX Rate Required
      if (!context.fxRate) {
        return err(PricingError.fxRateMissing(marketCurrency, context.targetCurrency));
      }

      const fx = context.fxRate;
      if (fx.baseCurrency === marketCurrency && fx.quoteCurrency === context.targetCurrency) {
        pureGoldMarketRatePerGram = Money.fromDecimal(
          rawPricePerGramInMarketCurrency.times(fx.rate),
          context.targetCurrency
        );
        appliedFxRateSnapshot = {
          baseCurrency: fx.baseCurrency,
          quoteCurrency: fx.quoteCurrency,
          rate: fx.rate.toString(),
        };
      } else if (
        fx.baseCurrency === context.targetCurrency &&
        fx.quoteCurrency === marketCurrency
      ) {
        // Reciprocal rate inversion
        const inverted = fx.invert();
        pureGoldMarketRatePerGram = Money.fromDecimal(
          rawPricePerGramInMarketCurrency.times(inverted.rate),
          context.targetCurrency
        );
        appliedFxRateSnapshot = {
          baseCurrency: inverted.baseCurrency,
          quoteCurrency: inverted.quoteCurrency,
          rate: inverted.rate.toString(),
        };
      } else {
        return err(
          new PricingError(
            'CURRENCY_MISMATCH',
            `Provided FX rate (${fx.baseCurrency}/${fx.quoteCurrency}) does not bridge ${marketCurrency} to ${context.targetCurrency}.`
          )
        );
      }
    }

    // 6. Base Metal Value Calculation
    const itemWeightGrams = context.weight.grams;
    const purityFineness = context.purity.fineness;
    const pureGoldFraction = context.purity.pureGoldFraction; // e.g. 750 / 1000 = 0.75
    const pureGrams = itemWeightGrams.times(pureGoldFraction);

    // Exact raw metal value: pureGrams * pureGoldMarketRatePerGram
    const baseMetalValueAmount = pureGrams.times(pureGoldMarketRatePerGram.amount);
    const baseMetalValue = Money.fromDecimal(baseMetalValueAmount, context.targetCurrency);

    // 7. Making Charge (Labor / Ojrat)
    const makingConfig = context.rule.config.makingCharge;
    let makingChargeRate: Decimal;
    let makingChargeAmount: Money;

    switch (makingConfig.type) {
      case 'PERCENTAGE': {
        makingChargeRate = new Decimal(makingConfig.rate);
        makingChargeAmount = baseMetalValue.multiply(makingChargeRate).unwrap();
        break;
      }
      case 'PER_GRAM': {
        makingChargeRate = new Decimal(makingConfig.rate);
        const perGramTotal = itemWeightGrams.times(makingChargeRate);
        makingChargeAmount = Money.fromDecimal(perGramTotal, context.targetCurrency);
        break;
      }
      case 'FIXED': {
        makingChargeRate = new Decimal(makingConfig.rate);
        makingChargeAmount = Money.fromDecimal(makingChargeRate, context.targetCurrency);
        break;
      }
      case 'ZERO': {
        makingChargeRate = new Decimal(0);
        makingChargeAmount = Money.zero(context.targetCurrency);
        break;
      }
    }

    // 8. Seller / Store Margin (Sood)
    const marginConfig = context.rule.config.margin;
    let sellerMarginRate: Decimal;
    let sellerMarginAmount: Money;

    switch (marginConfig.type) {
      case 'PERCENTAGE': {
        sellerMarginRate = new Decimal(marginConfig.rate);
        // Margin applies to (baseMetalValue + makingChargeAmount)
        const marginableBase = baseMetalValue.add(makingChargeAmount).unwrap();
        sellerMarginAmount = marginableBase.multiply(sellerMarginRate).unwrap();
        break;
      }
      case 'FIXED': {
        sellerMarginRate = new Decimal(marginConfig.rate);
        sellerMarginAmount = Money.fromDecimal(sellerMarginRate, context.targetCurrency);
        break;
      }
      case 'ZERO': {
        sellerMarginRate = new Decimal(0);
        sellerMarginAmount = Money.zero(context.targetCurrency);
        break;
      }
    }

    // 9. Stone / Component Value
    let stoneValueAmount = Money.zero(context.targetCurrency);
    if (context.stoneValue !== undefined) {
      if (context.stoneValue.currency !== context.targetCurrency) {
        return err(
          new PricingError(
            'CURRENCY_MISMATCH',
            `Stone value currency "${context.stoneValue.currency}" does not match target pricing currency "${context.targetCurrency}".`
          )
        );
      }
      stoneValueAmount = context.stoneValue;
    }

    // 10. Subtotal Before Tax
    const subtotal = baseMetalValue
      .add(makingChargeAmount)
      .unwrap()
      .add(sellerMarginAmount)
      .unwrap()
      .add(stoneValueAmount)
      .unwrap();

    // 11. Tax / VAT Calculation
    const taxConfig = context.rule.config.tax;
    const taxRate = new Decimal(taxConfig.rate);
    let taxableAmount: Money;
    let taxAmount: Money;

    switch (taxConfig.taxableBase) {
      case 'MARGIN_AND_FEE_ONLY': {
        // Iranian statutory rule: Raw gold is exempt from VAT; VAT applies solely to (Making Charge + Margin)
        taxableAmount = makingChargeAmount.add(sellerMarginAmount).unwrap();
        taxAmount = taxableAmount.multiply(taxRate).unwrap();
        break;
      }
      case 'TOTAL_VALUE': {
        // International retail VAT: applies to full subtotal
        taxableAmount = subtotal;
        taxAmount = taxableAmount.multiply(taxRate).unwrap();
        break;
      }
      case 'EXEMPT': {
        taxableAmount = Money.zero(context.targetCurrency);
        taxAmount = Money.zero(context.targetCurrency);
        break;
      }
    }

    // 12. Unrounded Total (Exact arbitrary precision)
    const unroundedTotal = subtotal.add(taxAmount).unwrap();

    // 13. Presentation Rounding at Final Boundary
    const scale =
      context.rule.config.roundingScale ??
      CURRENCY_METADATA[context.targetCurrency].standardMinorUnits;
    const roundingMode = ROUNDING_MODES[context.rule.config.roundingMode];

    const finalAmount = unroundedTotal.round(scale, roundingMode);
    const roundingAdjustment = finalAmount.subtract(unroundedTotal).unwrap();

    // 14. Instantiate Pricing Breakdown
    const breakdown = new PricingBreakdown({
      currency: context.targetCurrency,
      itemWeightGrams,
      purityFineness,
      pureGrams,
      pureGoldMarketRatePerGram,
      baseMetalValue,
      makingChargeType: makingConfig.type,
      makingChargeRate,
      makingChargeAmount,
      sellerMarginType: marginConfig.type,
      sellerMarginRate,
      sellerMarginAmount,
      stoneValueAmount,
      taxableBase: taxConfig.taxableBase,
      taxableAmount,
      taxRate,
      taxAmount,
      subtotal,
      unroundedTotal,
      roundingAdjustment,
      finalAmount,
    });

    // Verify mathematical integrity of breakdown
    if (!breakdown.verifyLineItemInvariant()) {
      return err(
        PricingError.precisionError(
          'Breakdown line items sum does not equal finalAmount after presentation rounding.'
        )
      );
    }

    // 15. Create PricingResult
    const resultId = createEntityId<PricingResultId>(
      context.resultId ?? `prc_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
    );

    const result = new PricingResult(resultId, {
      tenantId: context.tenantId,
      storeId: context.storeId,
      finalPrice: finalAmount,
      currency: context.targetCurrency,
      breakdown,
      inputs: {
        weightGrams: itemWeightGrams.toString(),
        purityFineness: purityFineness.toString(),
        targetCurrency: context.targetCurrency,
        stoneValue: stoneValueAmount.isZero() ? undefined : stoneValueAmount.amount.toString(),
      },
      marketReference: {
        observationId: context.marketObservation.id,
        instrumentSymbol: context.marketObservation.instrumentId,
        marketPrice: context.marketObservation.price.amount.toString(),
        marketUnit: context.marketObservation.price.unit,
        marketCurrency: context.marketObservation.price.currency,
        observedAt: context.marketObservation.observedAt,
        freshnessStatus,
        appliedFxRate: appliedFxRateSnapshot,
      },
      ruleReference: {
        ruleId: context.rule.id,
        ruleName: context.rule.name,
        ruleVersion: context.rule.version,
      },
      rounding: {
        mode: context.rule.config.roundingMode,
        scale,
      },
      calculatedAt: evaluationDate,
      isStaleMarketData,
    });

    return ok(result);
  }
}
