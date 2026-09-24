import {
  type PricingRuleRepositoryPort,
  type PricingResultRepositoryPort,
  type MarketObservationRepositoryPort,
  type MarketInstrumentRepositoryPort,
  type FxRateRepositoryPort,
  MarketDataFreshnessPolicy,
  PricingEngine,
  PricingResult,
  PricingRule,
  type PricingRuleId,
  PricingError,
  Weight,
  GoldPurity,
  Money,
  type CurrencyCode,
  type TenantId,
  type StoreId,
  createEntityId,
  WEIGHT_CONVERSION_CONSTANTS,
} from '@v-gold/core';
import { err, ok, type Result } from '@v-gold/core';
import { Decimal } from 'decimal.js';

export interface CalculateQuoteInput {
  weightInput: {
    grams?: string | undefined;
    troyOunces?: string | undefined;
    mesghal?: string | undefined;
    carats?: string | undefined; // Rejected with explicit error to prevent carat-to-gold confusion
  };
  purityInput: {
    fineness?: string | undefined;
    karat?: string | undefined;
  };
  targetCurrency: CurrencyCode;
  instrumentSymbol: string;
  ruleId?: string | undefined;
  allowStaleMarketData?: boolean | undefined;
  stoneValue?: string | undefined;
  tenantId?: string | undefined;
  storeId?: string | undefined;
  timestamp?: Date | undefined;
  persistResult?: boolean | undefined;
}

export class PricingService {
  constructor(
    private readonly ruleRepo: PricingRuleRepositoryPort,
    private readonly resultRepo: PricingResultRepositoryPort,
    private readonly observationRepo: MarketObservationRepositoryPort,
    private readonly instrumentRepo: MarketInstrumentRepositoryPort,
    private readonly fxRateRepo: FxRateRepositoryPort,
    private readonly freshnessPolicy: MarketDataFreshnessPolicy
  ) {}

  async calculateQuote(input: CalculateQuoteInput): Promise<Result<PricingResult, PricingError>> {
    const evaluationDate = input.timestamp ?? new Date();
    const tenantId = input.tenantId ? createEntityId<TenantId>(input.tenantId) : undefined;
    const storeId = input.storeId ? createEntityId<StoreId>(input.storeId) : undefined;

    // 1. Parse and Validate Weight (Carats strictly rejected for gold body mass)
    if (input.weightInput.carats !== undefined) {
      return err(
        new PricingError(
          'INVALID_WEIGHT',
          'Carats (ct) are reserved exclusively for gemstone mass and cannot be used for precious metal bulk weight. Please specify gold weight in grams, mesghal, or troyOunces.'
        )
      );
    }

    let weight: Weight;
    if (input.weightInput.grams !== undefined) {
      const res = Weight.fromGrams(input.weightInput.grams);
      if (res.isErr) return err(new PricingError('INVALID_WEIGHT', res.error.message));
      weight = res.value;
    } else if (input.weightInput.troyOunces !== undefined) {
      const rawOz = input.weightInput.troyOunces;
      const res = Weight.fromGrams(
        new Decimal(rawOz).times(WEIGHT_CONVERSION_CONSTANTS.GRAMS_PER_TROY_OUNCE)
      );
      if (res.isErr) return err(new PricingError('INVALID_WEIGHT', res.error.message));
      weight = res.value;
    } else if (input.weightInput.mesghal !== undefined) {
      const res = Weight.fromMesghal(input.weightInput.mesghal);
      if (res.isErr) return err(new PricingError('INVALID_WEIGHT', res.error.message));
      weight = res.value;
    } else {
      return err(
        new PricingError(
          'INVALID_WEIGHT',
          'No precious metal weight provided. Gold mass must be specified in grams, mesghal, or troyOunces.'
        )
      );
    }

    if (weight.isZero()) {
      return err(new PricingError('INVALID_WEIGHT', 'Weight cannot be zero for gold pricing.'));
    }

    // 2. Parse and Validate Gold Purity
    let purity: GoldPurity;
    if (input.purityInput.fineness !== undefined) {
      const res = GoldPurity.fromFineness(input.purityInput.fineness);
      if (res.isErr) return err(new PricingError('INVALID_PURITY', res.error.message));
      purity = res.value;
    } else if (input.purityInput.karat !== undefined) {
      const res = GoldPurity.fromKarat(input.purityInput.karat);
      if (res.isErr) return err(new PricingError('INVALID_PURITY', res.error.message));
      purity = res.value;
    } else {
      return err(new PricingError('INVALID_PURITY', 'No purity provided (fineness or karat required).'));
    }

    // 3. Resolve Market Instrument & Latest Observation
    const instrument = await this.instrumentRepo.findBySymbol(input.instrumentSymbol);
    if (!instrument) {
      return err(
        new PricingError(
          'MARKET_DATA_UNAVAILABLE',
          `Instrument symbol "${input.instrumentSymbol}" not found.`,
          503
        )
      );
    }

    const observation = await this.observationRepo.findLatestByInstrument(instrument.id);
    if (!observation) {
      return err(PricingError.marketDataUnavailable(input.instrumentSymbol));
    }

    // 4. Resolve Pricing Rule (Strict: No Silent Commercial Defaults)
    let rule: PricingRule | null;
    if (input.ruleId) {
      rule = await this.ruleRepo.findById(createEntityId<PricingRuleId>(input.ruleId), tenantId);
      if (!rule) {
        return err(PricingError.ruleNotFound(input.ruleId));
      }
    } else {
      // Find active authoritative rule for tenant (excludes reference samples)
      rule = await this.ruleRepo.findEffective({
        atDate: evaluationDate,
        tenantId,
        includeReferenceSamples: false,
      });

      if (!rule) {
        return err(PricingError.explicitRuleRequired());
      }
    }

    // 5. Resolve FX Rate if Needed
    let fxRate = undefined;
    const marketCurrency = observation.price.currency;
    if (marketCurrency !== input.targetCurrency) {
      // Direct pair check
      fxRate = await this.fxRateRepo.findLatest(marketCurrency, input.targetCurrency);
      if (!fxRate) {
        // Inverse pair check
        const inverseRate = await this.fxRateRepo.findLatest(input.targetCurrency, marketCurrency);
        if (inverseRate) {
          fxRate = inverseRate.invert();
        }
      }
    }

    // 6. Optional Stone Value (Passthrough aggregation only; no fake valuation)
    let stoneValue = undefined;
    if (input.stoneValue !== undefined && input.stoneValue.trim() !== '') {
      const stoneRes = Money.create(input.stoneValue, input.targetCurrency);
      if (stoneRes.isErr) {
        return err(new PricingError('PRICING_CONFIGURATION_ERROR', `Invalid stone value: ${stoneRes.error.message}`));
      }
      stoneValue = stoneRes.value;
    }

    // 7. Execute Domain Engine Calculation
    const calcResult = PricingEngine.calculate({
      weight,
      purity,
      targetCurrency: input.targetCurrency,
      marketObservation: observation,
      freshnessPolicy: this.freshnessPolicy,
      rule,
      timestamp: evaluationDate,
      allowStaleMarketData: input.allowStaleMarketData ?? false,
      fxRate: fxRate ?? undefined,
      stoneValue,
      tenantId,
      storeId,
    });

    if (calcResult.isErr) {
      return err(calcResult.error);
    }

    const pricingResult = calcResult.value;

    // 8. Optionally Persist Historical Calculation
    if (input.persistResult !== false) {
      await this.resultRepo.save(pricingResult);
    }

    return ok(pricingResult);
  }
}
