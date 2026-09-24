import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { Decimal } from 'decimal.js';

export const SUPPORTED_CURRENCIES = ['IRR', 'TOMAN', 'USD', 'EUR'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export type CurrencyCategory = 'FIAT';

export interface CurrencyMetadata {
  readonly code: CurrencyCode;
  readonly name: string;
  readonly symbol: string;
  readonly category: CurrencyCategory;
  /**
   * Number of fractional decimal digits for standard accounting/presentation.
   * e.g., 0 for IRR/TOMAN (no fractional Rials/Tomans in circulation), 2 for USD/EUR (cents).
   */
  readonly standardMinorUnits: number;
  /**
   * Whether this currency is the official statutory accounting currency.
   * IRR is the legal accounting currency of Iran, while TOMAN is the standard commercial pricing unit.
   */
  readonly isAccountingCurrency: boolean;
  /**
   * Default rounding mode for presentation.
   */
  readonly defaultRoundingMode: Decimal.Rounding;
}

export const CURRENCY_METADATA: Record<CurrencyCode, CurrencyMetadata> = {
  IRR: {
    code: 'IRR',
    name: 'Iranian Rial',
    symbol: 'ریال',
    category: 'FIAT',
    standardMinorUnits: 0,
    isAccountingCurrency: true,
    defaultRoundingMode: Decimal.ROUND_HALF_UP,
  },
  TOMAN: {
    code: 'TOMAN',
    name: 'Iranian Toman',
    symbol: 'تومان',
    category: 'FIAT',
    standardMinorUnits: 0,
    isAccountingCurrency: false, // Commercial unit of account; 1 TOMAN = 10 IRR
    defaultRoundingMode: Decimal.ROUND_HALF_UP,
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    category: 'FIAT',
    standardMinorUnits: 2,
    isAccountingCurrency: true,
    defaultRoundingMode: Decimal.ROUND_HALF_UP,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    category: 'FIAT',
    standardMinorUnits: 2,
    isAccountingCurrency: true,
    defaultRoundingMode: Decimal.ROUND_HALF_UP,
  },
};

/**
 * Statutory conversion ratio between Iranian Toman and Iranian Rial.
 * Exactly 1 Toman = 10 Rials.
 * Maintained as an immutable Decimal constant to prevent floating-point drift.
 */
export const IRR_PER_TOMAN = new Decimal(10);
export const TOMAN_PER_IRR = new Decimal('0.1');

/**
 * Validates and normalizes raw string into a supported CurrencyCode.
 */
export const parseCurrencyCode = (raw: string): Result<CurrencyCode, ValidationError> => {
  const normalized = raw.trim().toUpperCase();
  if (SUPPORTED_CURRENCIES.includes(normalized as CurrencyCode)) {
    return ok(normalized as CurrencyCode);
  }
  return err(
    new ValidationError(
      `Unsupported currency code: "${raw}". Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`
    )
  );
};

/**
 * Deterministically converts a Toman amount to Iranian Rials (x 10).
 */
export function tomanToIrrAmount(tomanAmount: Decimal): Decimal {
  return tomanAmount.times(IRR_PER_TOMAN);
}

/**
 * Deterministically converts an Iranian Rial amount to Tomans (/ 10).
 */
export function irrToTomanAmount(irrAmount: Decimal): Decimal {
  return irrAmount.dividedBy(IRR_PER_TOMAN);
}
