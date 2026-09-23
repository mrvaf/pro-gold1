import { Decimal } from 'decimal.js';
import { ValidationError } from '../../common/errors.js';
import type { CurrencyCode } from './currency.js';
import { CURRENCY_METADATA } from './currency.js';

/**
 * Explicit rounding modes supported across V-GOLD financial computations.
 * Wraps Decimal.js rounding modes with explicit domain semantics.
 */
export const ROUNDING_MODES = {
  HALF_UP: Decimal.ROUND_HALF_UP,     // Standard commercial rounding (round to nearest, .5 rounds away from zero)
  HALF_EVEN: Decimal.ROUND_HALF_EVEN, // Banker's rounding (round to nearest, .5 rounds to nearest even number; minimizes statistical bias)
  UP: Decimal.ROUND_UP,               // Ceiling (towards +infinity)
  DOWN: Decimal.ROUND_DOWN,           // Truncation / floor (towards zero)
} as const;

export type RoundingModeKey = keyof typeof ROUNDING_MODES;

/**
 * Three-Tier Precision Architecture:
 *
 * 1. CALCULATION_PRECISION:
 *    Raw arbitrary precision inside Decimal.js (default 20+ significant digits).
 *    MANDATE: Intermediate calculations must NEVER be rounded prematurely.
 *
 * 2. STORAGE_PRECISION:
 *    PostgreSQL NUMERIC(24, 8) or NUMERIC(28, 8).
 *    MANDATE: Persisted as exact decimal strings up to 8 decimal places.
 *
 * 3. PRESENTATION_PRECISION:
 *    End-user interface formatting based on currency minor units or display rules.
 *    e.g., USD: 2 decimals, EUR: 2 decimals, IRR: 0 decimals, TOMAN: 0 decimals.
 */
export const FINANCIAL_PRECISION_CONFIG = {
  MAX_STORAGE_DECIMAL_PLACES: 8,
  DEFAULT_CALCULATION_PRECISION: 28,
} as const;

/**
 * Domain utility for explicit financial rounding.
 */
export class FinancialRoundingPolicy {
  /**
   * Explicitly rounds a Decimal value to a specified number of decimal places.
   * Throws ValidationError if decimalPlaces is negative or non-integer.
   */
  static roundDecimal(
    value: Decimal,
    decimalPlaces: number,
    mode: Decimal.Rounding = Decimal.ROUND_HALF_UP
  ): Decimal {
    if (decimalPlaces < 0 || !Number.isInteger(decimalPlaces)) {
      throw new ValidationError(
        `Decimal places must be a non-negative integer. Received: ${decimalPlaces}`
      );
    }
    return value.toDecimalPlaces(decimalPlaces, mode);
  }

  /**
   * Explicitly rounds an amount to the standard minor units of a given currency.
   */
  static roundForCurrency(
    amount: Decimal,
    currency: CurrencyCode,
    mode: Decimal.Rounding = CURRENCY_METADATA[currency].defaultRoundingMode
  ): Decimal {
    const scale = CURRENCY_METADATA[currency].standardMinorUnits;
    return this.roundDecimal(amount, scale, mode);
  }

  /**
   * Asserts whether a Decimal value fits within the maximum storage scale (8 decimal places)
   * without silent truncation.
   */
  static fitsStorageScale(value: Decimal, maxScale = FINANCIAL_PRECISION_CONFIG.MAX_STORAGE_DECIMAL_PLACES): boolean {
    const decimalPlaces = value.decimalPlaces();
    return decimalPlaces <= maxScale;
  }
}
