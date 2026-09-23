import { Decimal } from 'decimal.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import type { CurrencyCode } from './currency.js';
import { CURRENCY_METADATA } from './currency.js';

/**
 * Explicit rounding modes supported across V-GOLD financial computations.
 * Wraps Decimal.js rounding modes with exact mathematical semantics.
 *
 * CRITICAL TERMINOLOGY AUDIT:
 * - ROUND_UP is "away from zero" (NOT ceiling). For -1.21 -> -1.3.
 * - ROUND_DOWN is "towards zero / truncation" (NOT floor). For -1.29 -> -1.2.
 * - ROUND_CEIL is mathematical ceiling (towards +infinity). For -1.21 -> -1.2.
 * - ROUND_FLOOR is mathematical floor (towards -infinity). For -1.29 -> -1.3.
 * - ROUND_HALF_UP is round to nearest; exact midpoints (.5) round away from zero.
 * - ROUND_HALF_EVEN is banker's rounding; exact midpoints (.5) round to nearest even digit.
 */
export const ROUNDING_MODES = {
  HALF_UP: Decimal.ROUND_HALF_UP,     // Round to nearest, midpoint rounds away from zero
  HALF_EVEN: Decimal.ROUND_HALF_EVEN, // Banker's rounding (round to nearest, midpoint to nearest even)
  UP: Decimal.ROUND_UP,               // Rounds away from zero
  DOWN: Decimal.ROUND_DOWN,           // Rounds towards zero (truncation)
  CEIL: Decimal.ROUND_CEIL,           // Rounds towards +infinity (mathematical ceiling)
  FLOOR: Decimal.ROUND_FLOOR,         // Rounds towards -infinity (mathematical floor)
} as const;

export type RoundingModeKey = keyof typeof ROUNDING_MODES;

/**
 * Storage scale boundaries by financial data type.
 * Explicitly defines the maximum decimal scale stored in database tables.
 */
export const STORAGE_PRECISION_LIMITS = {
  MONEY_AMOUNT: 4,      // 4 decimal places (up to 1/100th cent for statutory sub-cent clearing)
  MARKET_PRICE: 8,      // 8 decimal places for commodity spot rates (NUMERIC(24, 8))
  FX_RATE: 16,          // 16 decimal places to capture micro-currency ratios (NUMERIC(32, 16))
  WEIGHT_GRAMS: 6,     // 6 decimal places (1 microgram = 0.000001 g)
  GOLD_PURITY: 4,       // 4 decimal places (e.g. 0.9999)
  CONVERSION_FACTOR: 8, // 8 decimal places
} as const;

/**
 * Three-Tier Precision Architecture:
 *
 * 1. CALCULATION_PRECISION:
 *    Raw arbitrary precision inside Decimal.js (default 28+ significant digits).
 *    MANDATE: Intermediate calculations must NEVER be rounded prematurely.
 *
 * 2. STORAGE_PRECISION:
 *    PostgreSQL NUMERIC columns configured per data type:
 *    - FX Rates: NUMERIC(32, 16)
 *    - Market Prices: NUMERIC(24, 8)
 *    - Monetary Amounts: NUMERIC(24, 4) or NUMERIC(24, 8)
 *    MANDATE: Values exceeding target column scale must not be silently truncated.
 *
 * 3. PRESENTATION_PRECISION:
 *    End-user interface formatting based on currency minor units or display rules:
 *    - USD: 2 decimals
 *    - EUR: 2 decimals
 *    - IRR: 0 decimals
 *    - TOMAN: 0 decimals
 */
export const FINANCIAL_PRECISION_CONFIG = {
  DEFAULT_CALCULATION_PRECISION: 28,
  STORAGE_PRECISION_LIMITS,
} as const;

/**
 * Domain utility for explicit financial rounding and storage scale assertions.
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
   * Checks whether a Decimal value fits within a designated storage scale
   * without losing trailing fractional digits.
   */
  static fitsStorageScale(value: Decimal, maxScale: number): boolean {
    if (maxScale < 0 || !Number.isInteger(maxScale)) {
      throw new ValidationError(`maxScale must be a non-negative integer: ${maxScale}`);
    }
    const decimalPlaces = value.decimalPlaces();
    return decimalPlaces <= maxScale;
  }

  /**
   * Validates that a value fits storage scale, returning a Result.
   * Prevents silent truncation before persistence.
   */
  static assertStorageScale(
    value: Decimal,
    maxScale: number,
    contextName: string
  ): Result<void, ValidationError> {
    if (!this.fitsStorageScale(value, maxScale)) {
      return err(
        new ValidationError(
          `Precision overflow in ${contextName}: value "${value.toString()}" has ${value.decimalPlaces()} decimal places, exceeding maximum database storage scale of ${maxScale}. Explicit rounding required before persistence.`
        )
      );
    }
    return ok(undefined);
  }

  /**
   * Explicitly prepares a value for storage by rounding to the designated scale with explicit mode.
   * Eliminates silent database truncation.
   */
  static prepareForStorage(
    value: Decimal,
    maxScale: number,
    mode: Decimal.Rounding = Decimal.ROUND_HALF_UP
  ): Decimal {
    return this.roundDecimal(value, maxScale, mode);
  }
}
