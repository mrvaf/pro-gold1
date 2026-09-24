import type { CurrencyCode } from '../finance/currency.js';
import type { RoundingModeKey } from '../finance/rounding-policy.js';

export type PricingErrorCode =
  | 'MARKET_DATA_UNAVAILABLE'
  | 'MARKET_DATA_STALE'
  | 'INVALID_CURRENCY'
  | 'CURRENCY_MISMATCH'
  | 'INVALID_WEIGHT'
  | 'INVALID_PURITY'
  | 'INVALID_PRICING_RULE'
  | 'UNSUPPORTED_MARKET_UNIT'
  | 'PRECISION_ERROR'
  | 'PRICING_CONFIGURATION_ERROR'
  | 'FX_RATE_MISSING'
  | 'RULE_NOT_FOUND'
  | 'RULE_EXPIRED'
  | 'IDOR_ACCESS_DENIED'
  | 'EXPLICIT_RULE_REQUIRED';

/**
 * Making charge (ojrat) calculation methods supported by the pricing engine.
 * - PERCENTAGE: Percentage of base metal value (e.g. 15% of raw gold)
 * - PER_GRAM: Fixed monetary amount per gram of total item weight
 * - FIXED: Flat monetary fee regardless of weight
 * - ZERO: Bullion, scrap, or raw metal with zero labor charge
 */
export type MakingChargeType = 'PERCENTAGE' | 'PER_GRAM' | 'FIXED' | 'ZERO';

/**
 * Retail / seller margin calculation methods.
 * - PERCENTAGE: Percentage applied to (baseMetalValue + makingCharge)
 * - FIXED: Flat monetary margin
 * - ZERO: Zero markup (wholesale / direct bullion)
 */
export type MarginType = 'PERCENTAGE' | 'FIXED' | 'ZERO';

/**
 * Tax / VAT calculation bases.
 * - MARGIN_AND_FEE_ONLY: Statutory Iranian gold VAT (tax applied strictly to Making Charge + Seller Margin, raw gold is exempt)
 * - TOTAL_VALUE: Standard international VAT applied to total item value
 * - EXEMPT: Zero tax
 */
export type TaxableBaseType = 'MARGIN_AND_FEE_ONLY' | 'TOTAL_VALUE' | 'EXEMPT';

export interface MakingChargeConfig {
  readonly type: MakingChargeType;
  /** Decimal string representation of percentage (e.g. "0.15" for 15%) or per-gram amount */
  readonly rate: string;
}

export interface MarginConfig {
  readonly type: MarginType;
  /** Decimal string representation of margin percentage (e.g. "0.07" for 7%) or fixed amount */
  readonly rate: string;
}

export interface TaxConfig {
  readonly taxableBase: TaxableBaseType;
  /** Decimal string representation of tax rate (e.g. "0.09" for 9% VAT) */
  readonly rate: string;
}

export interface PricingRuleConfig {
  readonly makingCharge: MakingChargeConfig;
  readonly margin: MarginConfig;
  readonly tax: TaxConfig;
  readonly roundingMode: RoundingModeKey;
  /** Decimal places for final rounding (default is currency minor units if not specified) */
  readonly roundingScale?: number | undefined;
}
