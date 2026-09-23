import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';

export const SUPPORTED_CURRENCIES = ['IRR', 'TOMAN', 'USD', 'EUR'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface CurrencyMetadata {
  readonly code: CurrencyCode;
  readonly name: string;
  readonly symbol: string;
  readonly standardMinorUnits: number;
}

export const CURRENCY_METADATA: Record<CurrencyCode, CurrencyMetadata> = {
  IRR: {
    code: 'IRR',
    name: 'Iranian Rial',
    symbol: 'ریال',
    standardMinorUnits: 0,
  },
  TOMAN: {
    code: 'TOMAN',
    name: 'Iranian Toman',
    symbol: 'تومان',
    standardMinorUnits: 0,
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    standardMinorUnits: 2,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    standardMinorUnits: 2,
  },
};

export const parseCurrencyCode = (raw: string): Result<CurrencyCode, ValidationError> => {
  const normalized = raw.trim().toUpperCase();
  if (SUPPORTED_CURRENCIES.includes(normalized as CurrencyCode)) {
    return ok(normalized as CurrencyCode);
  }
  return err(
    new ValidationError(`Unsupported currency code: "${raw}". Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`)
  );
};
