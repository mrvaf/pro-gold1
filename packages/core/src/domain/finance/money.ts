import { Decimal } from 'decimal.js';
import { ValueObject } from '../../common/value-object.js';
import { ValidationError, BusinessRuleViolationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { type CurrencyCode, CURRENCY_METADATA } from './currency.js';

export interface MoneyProps {
  amount: string; // Serialized canonical Decimal string for ValueObject props
  currency: CurrencyCode;
}

export class CurrencyMismatchError extends BusinessRuleViolationError {
  override readonly code: string = 'CURRENCY_MISMATCH';
  constructor(baseCurrency: CurrencyCode, otherCurrency: CurrencyCode) {
    super(`Cannot perform operations between different currencies: "${baseCurrency}" and "${otherCurrency}"`);
  }
}

/**
 * Money Value Object.
 * Strictly encapsulates an arbitrary-precision Decimal and an explicit CurrencyCode.
 * All arithmetic operations enforce currency parity and zero silent rounding.
 */
export class Money extends ValueObject<MoneyProps> {
  private readonly _amount: Decimal;
  private readonly _currency: CurrencyCode;

  private constructor(amount: Decimal, currency: CurrencyCode) {
    super({
      amount: amount.toString(),
      currency,
    });
    this._amount = amount;
    this._currency = currency;
  }

  get amount(): Decimal {
    return this._amount;
  }

  get currency(): CurrencyCode {
    return this._currency;
  }

  /**
   * Factory method to safely instantiate Money.
   * Rejects non-finite, NaN, or non-numeric inputs.
   */
  static create(amountInput: string | Decimal, currency: CurrencyCode): Result<Money, ValidationError> {
    try {
      const dec = amountInput instanceof Decimal ? amountInput : new Decimal(amountInput);
      if (!dec.isFinite() || dec.isNaN()) {
        return err(new ValidationError(`Invalid monetary amount: "${amountInput}". Amount must be a finite number.`));
      }
      return ok(new Money(dec, currency));
    } catch {
      return err(new ValidationError(`Failed to parse monetary amount: "${amountInput}".`));
    }
  }

  static fromDecimal(amount: Decimal, currency: CurrencyCode): Money {
    if (!amount.isFinite() || amount.isNaN()) {
      throw new ValidationError(`Cannot create Money from non-finite Decimal: "${amount.toString()}".`);
    }
    return new Money(amount, currency);
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(new Decimal(0), currency);
  }

  /**
   * Safe addition. Rejects currency mismatch.
   */
  add(other: Money): Result<Money, CurrencyMismatchError> {
    if (this._currency !== other._currency) {
      return err(new CurrencyMismatchError(this._currency, other._currency));
    }
    return ok(new Money(this._amount.plus(other._amount), this._currency));
  }

  /**
   * Safe subtraction. Rejects currency mismatch.
   */
  subtract(other: Money): Result<Money, CurrencyMismatchError> {
    if (this._currency !== other._currency) {
      return err(new CurrencyMismatchError(this._currency, other._currency));
    }
    return ok(new Money(this._amount.minus(other._amount), this._currency));
  }

  /**
   * Safe multiplication by a scalar factor.
   * Requires explicit string or Decimal factor.
   */
  multiply(factor: Decimal | string): Result<Money, ValidationError> {
    try {
      const factorDec = factor instanceof Decimal ? factor : new Decimal(factor);
      if (!factorDec.isFinite() || factorDec.isNaN()) {
        return err(new ValidationError(`Multiplication factor must be a finite number: "${factor}".`));
      }
      return ok(new Money(this._amount.times(factorDec), this._currency));
    } catch {
      return err(new ValidationError(`Invalid factor for multiplication: "${factor}".`));
    }
  }

  /**
   * Safe division by a scalar divisor.
   * Prevents division by zero.
   */
  divide(divisor: Decimal | string): Result<Money, ValidationError | BusinessRuleViolationError> {
    try {
      const divisorDec = divisor instanceof Decimal ? divisor : new Decimal(divisor);
      if (!divisorDec.isFinite() || divisorDec.isNaN()) {
        return err(new ValidationError(`Divisor must be a finite number: "${divisor}".`));
      }
      if (divisorDec.isZero()) {
        return err(new BusinessRuleViolationError('Cannot divide money by zero.'));
      }
      return ok(new Money(this._amount.dividedBy(divisorDec), this._currency));
    } catch {
      return err(new ValidationError(`Invalid divisor: "${divisor}".`));
    }
  }

  /**
   * Explicit deterministic rounding.
   * Never silently rounds; must be called explicitly with target decimal scale and rounding mode.
   */
  round(decimalPlaces: number, mode: Decimal.Rounding = Decimal.ROUND_HALF_UP): Money {
    if (decimalPlaces < 0 || !Number.isInteger(decimalPlaces)) {
      throw new ValidationError(`Decimal places must be a non-negative integer: ${decimalPlaces}`);
    }
    return new Money(this._amount.toDecimalPlaces(decimalPlaces, mode), this._currency);
  }

  /**
   * Explicit rounding to the currency's standard minor unit (e.g. 0 for IRR/TOMAN, 2 for USD/EUR).
   */
  roundToStandardMinorUnits(mode: Decimal.Rounding = Decimal.ROUND_HALF_UP): Money {
    const minorUnits = CURRENCY_METADATA[this._currency].standardMinorUnits;
    return this.round(minorUnits, mode);
  }

  /**
   * Compare two Money objects of the same currency.
   * Returns -1 if this < other, 0 if this == other, 1 if this > other.
   */
  compare(other: Money): Result<number, CurrencyMismatchError> {
    if (this._currency !== other._currency) {
      return err(new CurrencyMismatchError(this._currency, other._currency));
    }
    return ok(this._amount.comparedTo(other._amount));
  }

  override equals(other?: ValueObject<MoneyProps> | null): boolean {
    if (!other || !(other instanceof Money)) {
      return false;
    }
    return this._currency === other._currency && this._amount.equals(other._amount);
  }

  isZero(): boolean {
    return this._amount.isZero();
  }

  isPositive(): boolean {
    return this._amount.greaterThan(0);
  }

  isNegative(): boolean {
    return this._amount.lessThan(0);
  }

  override toString(): string {
    return `${this._amount.toString()} ${this._currency}`;
  }
}
