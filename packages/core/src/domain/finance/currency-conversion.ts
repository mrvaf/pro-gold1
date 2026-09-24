import { DomainError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { Money } from './money.js';
import { FxRate } from './fx-rate.js';
import { IRR_PER_TOMAN, TOMAN_PER_IRR } from './currency.js';

export type CurrencyConversionErrorCode =
  | 'BASE_CURRENCY_MISMATCH'
  | 'INVALID_SOURCE_CURRENCY';

export class CurrencyConversionError extends DomainError {
  override readonly code: CurrencyConversionErrorCode;
  readonly httpStatus: number = 422;

  constructor(code: CurrencyConversionErrorCode, message: string) {
    super(message);
    this.name = 'CurrencyConversionError';
    this.code = code;
  }
}

/**
 * CurrencyConverter Domain Service.
 * Executes authoritative, arbitrary-precision currency conversions.
 *
 * Rules:
 * 1. Requires exact match between Money.currency and FxRate.baseCurrency.
 * 2. Produces exact Decimal results without premature rounding.
 * 3. Enforces deterministic 1:10 conversion between Iranian Toman and Rial.
 */
export class CurrencyConverter {
  /**
   * Converts Money from base currency to quote currency using an authoritative FxRate.
   * Target amount = money.amount * fxRate.rate
   */
  static convert(money: Money, fxRate: FxRate): Result<Money, CurrencyConversionError> {
    if (money.currency !== fxRate.baseCurrency) {
      return err(
        new CurrencyConversionError(
          'BASE_CURRENCY_MISMATCH',
          `Cannot convert ${money.currency} using FX rate with base currency ${fxRate.baseCurrency}.`
        )
      );
    }

    const convertedAmount = money.amount.times(fxRate.rate);
    return ok(Money.fromDecimal(convertedAmount, fxRate.quoteCurrency));
  }

  /**
   * Deterministically converts Iranian Toman to Iranian Rials.
   * Exact conversion: 1 Toman = 10 Rials.
   */
  static tomanToIrr(money: Money): Result<Money, CurrencyConversionError> {
    if (money.currency !== 'TOMAN') {
      return err(
        new CurrencyConversionError(
          'INVALID_SOURCE_CURRENCY',
          `Expected TOMAN currency for Toman-to-Rial conversion, received "${money.currency}".`
        )
      );
    }
    const irrAmount = money.amount.times(IRR_PER_TOMAN);
    return ok(Money.fromDecimal(irrAmount, 'IRR'));
  }

  /**
   * Deterministically converts Iranian Rials to Iranian Tomans.
   * Exact conversion: 10 Rials = 1 Toman.
   */
  static irrToToman(money: Money): Result<Money, CurrencyConversionError> {
    if (money.currency !== 'IRR') {
      return err(
        new CurrencyConversionError(
          'INVALID_SOURCE_CURRENCY',
          `Expected IRR currency for Rial-to-Toman conversion, received "${money.currency}".`
        )
      );
    }
    const tomanAmount = money.amount.times(TOMAN_PER_IRR);
    return ok(Money.fromDecimal(tomanAmount, 'TOMAN'));
  }
}
