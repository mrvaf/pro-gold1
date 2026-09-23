import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { Money } from '../finance/money.js';
import type { CurrencyCode } from '../finance/currency.js';
import type { TenantId } from '../tenant/tenant.js';
import type { StoreId } from '../tenant/store.js';
import type { MarketDataStatus } from '../market-data/market-data-types.js';
import type { RoundingModeKey } from '../finance/rounding-policy.js';
import type { PricingRuleConfig } from './pricing-types.js';
import { PricingBreakdown, type PricingBreakdownDto } from './pricing-breakdown.js';

export type PricingResultId = EntityId<'PricingResult'>;

export interface PricingInputSnapshot {
  readonly weightGrams: string;
  readonly purityFineness: string;
  readonly targetCurrency: CurrencyCode;
  readonly stoneValue?: string | undefined;
}

export interface MarketReferenceSnapshot {
  readonly observationId: string;
  readonly instrumentSymbol: string;
  readonly marketPrice: string;
  readonly marketUnit: string;
  readonly marketCurrency: CurrencyCode;
  readonly observedAt: Date;
  readonly freshnessStatus: MarketDataStatus;
  readonly appliedFxRate?: {
    readonly baseCurrency: CurrencyCode;
    readonly quoteCurrency: CurrencyCode;
    readonly rate: string;
  } | undefined;
}

export interface RuleReferenceSnapshot {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly ruleVersion: string;
  readonly isReferenceSample: boolean;
  readonly specificationSource?: string | undefined;
  /**
   * Immutable snapshot of the exact effective rule parameters used for this calculation.
   * Ensures historical reproducibility even if the rule entity is later modified or deleted.
   */
  readonly effectiveConfig: PricingRuleConfig;
}

export interface RoundingSnapshot {
  readonly mode: RoundingModeKey;
  readonly scale: number;
}

export interface CreatePricingResultProps {
  id?: string | undefined;
  tenantId?: TenantId | undefined;
  storeId?: StoreId | undefined;
  finalPrice: Money;
  currency: CurrencyCode;
  breakdown: PricingBreakdown;
  inputs: PricingInputSnapshot;
  marketReference: MarketReferenceSnapshot;
  ruleReference: RuleReferenceSnapshot;
  rounding: RoundingSnapshot;
  calculatedAt: Date;
  isStaleMarketData: boolean;
  createdAt?: Date | undefined;
}

export interface PricingResultDto {
  id: string;
  tenantId?: string | undefined;
  storeId?: string | undefined;
  finalPrice: {
    amount: string;
    currency: string;
  };
  breakdown: PricingBreakdownDto;
  inputs: PricingInputSnapshot;
  marketReference: {
    observationId: string;
    instrumentSymbol: string;
    marketPrice: string;
    marketUnit: string;
    marketCurrency: string;
    observedAt: string;
    freshnessStatus: string;
    appliedFxRate?: {
      baseCurrency: string;
      quoteCurrency: string;
      rate: string;
    } | undefined;
  };
  ruleReference: {
    ruleId: string;
    ruleName: string;
    ruleVersion: string;
    isReferenceSample: boolean;
    specificationSource?: string | undefined;
    effectiveConfig: {
      makingCharge: {
        type: string;
        rate: string;
      };
      margin: {
        type: string;
        rate: string;
      };
      tax: {
        taxableBase: string;
        rate: string;
      };
      roundingMode: string;
      roundingScale?: number | undefined;
    };
  };
  rounding: RoundingSnapshot;
  calculatedAt: string;
  isStaleMarketData: boolean;
  createdAt: string;
}

export class PricingResult extends Entity<PricingResultId> {
  private readonly _tenantId?: TenantId | undefined;
  private readonly _storeId?: StoreId | undefined;
  private readonly _finalPrice: Money;
  private readonly _currency: CurrencyCode;
  private readonly _breakdown: PricingBreakdown;
  private readonly _inputs: PricingInputSnapshot;
  private readonly _marketReference: MarketReferenceSnapshot;
  private readonly _ruleReference: RuleReferenceSnapshot;
  private readonly _rounding: RoundingSnapshot;
  private readonly _calculatedAt: Date;
  private readonly _isStaleMarketData: boolean;
  private readonly _createdAt: Date;

  constructor(
    id: PricingResultId,
    params: {
      tenantId?: TenantId | undefined;
      storeId?: StoreId | undefined;
      finalPrice: Money;
      currency: CurrencyCode;
      breakdown: PricingBreakdown;
      inputs: PricingInputSnapshot;
      marketReference: MarketReferenceSnapshot;
      ruleReference: RuleReferenceSnapshot;
      rounding: RoundingSnapshot;
      calculatedAt: Date;
      isStaleMarketData: boolean;
      createdAt?: Date | undefined;
    }
  ) {
    super(id);
    this._tenantId = params.tenantId;
    this._storeId = params.storeId;
    this._finalPrice = params.finalPrice;
    this._currency = params.currency;
    this._breakdown = params.breakdown;
    this._inputs = params.inputs;
    this._marketReference = params.marketReference;
    this._ruleReference = params.ruleReference;
    this._rounding = params.rounding;
    this._calculatedAt = params.calculatedAt;
    this._isStaleMarketData = params.isStaleMarketData;
    this._createdAt = params.createdAt ?? params.calculatedAt;
  }

  get finalPrice(): Money {
    return this._finalPrice;
  }

  get currency(): CurrencyCode {
    return this._currency;
  }

  get breakdown(): PricingBreakdown {
    return this._breakdown;
  }

  get inputs(): PricingInputSnapshot {
    return this._inputs;
  }

  get marketReference(): MarketReferenceSnapshot {
    return this._marketReference;
  }

  get ruleReference(): RuleReferenceSnapshot {
    return this._ruleReference;
  }

  get rounding(): RoundingSnapshot {
    return this._rounding;
  }

  get calculatedAt(): Date {
    return this._calculatedAt;
  }

  get isStaleMarketData(): boolean {
    return this._isStaleMarketData;
  }

  get tenantId(): TenantId | undefined {
    return this._tenantId;
  }

  get storeId(): StoreId | undefined {
    return this._storeId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  toDto(): PricingResultDto {
    return {
      id: this._id,
      tenantId: this._tenantId,
      storeId: this._storeId,
      finalPrice: {
        amount: this._finalPrice.amount.toString(),
        currency: this._currency,
      },
      breakdown: this._breakdown.toDto(),
      inputs: this._inputs,
      marketReference: {
        observationId: this._marketReference.observationId,
        instrumentSymbol: this._marketReference.instrumentSymbol,
        marketPrice: this._marketReference.marketPrice,
        marketUnit: this._marketReference.marketUnit,
        marketCurrency: this._marketReference.marketCurrency,
        observedAt: this._marketReference.observedAt.toISOString(),
        freshnessStatus: this._marketReference.freshnessStatus,
        appliedFxRate: this._marketReference.appliedFxRate,
      },
      ruleReference: {
        ruleId: this._ruleReference.ruleId,
        ruleName: this._ruleReference.ruleName,
        ruleVersion: this._ruleReference.ruleVersion,
        isReferenceSample: this._ruleReference.isReferenceSample,
        specificationSource: this._ruleReference.specificationSource,
        effectiveConfig: {
          makingCharge: {
            type: this._ruleReference.effectiveConfig.makingCharge.type,
            rate: this._ruleReference.effectiveConfig.makingCharge.rate,
          },
          margin: {
            type: this._ruleReference.effectiveConfig.margin.type,
            rate: this._ruleReference.effectiveConfig.margin.rate,
          },
          tax: {
            taxableBase: this._ruleReference.effectiveConfig.tax.taxableBase,
            rate: this._ruleReference.effectiveConfig.tax.rate,
          },
          roundingMode: this._ruleReference.effectiveConfig.roundingMode,
          roundingScale: this._ruleReference.effectiveConfig.roundingScale,
        },
      },
      rounding: this._rounding,
      calculatedAt: this._calculatedAt.toISOString(),
      isStaleMarketData: this._isStaleMarketData,
      createdAt: this._createdAt.toISOString(),
    };
  }
}
