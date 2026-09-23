import { Decimal } from 'decimal.js';
import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { parseCurrencyCode, type CurrencyCode } from '../finance/currency.js';
import { parseMarketUnit, type MarketUnitCode } from './market-unit.js';

export interface MarketPriceProps {
  amount: string; // Exact string representation of Decimal
  currency: CurrencyCode;
  unit: MarketUnitCode;
  bid?: string | undefined;
  ask?: string | undefined;
}

export interface MarketPriceDto {
  amount: string;
  currency: string;
  unit: string;
  bid?: string | undefined;
  ask?: string | undefined;
  spread?: string | undefined;
}

/**
 * MarketPrice Value Object.
 * Encapsulates the exact numeric value, currency, unit, and bid/ask quotes of a market observation.
 * Authoritative values strictly use Decimal.js (no JavaScript floating-point conversions).
 */
export class MarketPrice extends ValueObject<MarketPriceProps> {
  private readonly _amount: Decimal;
  private readonly _currency: CurrencyCode;
  private readonly _unit: MarketUnitCode;
  private readonly _bid?: Decimal | undefined;
  private readonly _ask?: Decimal | undefined;

  private constructor(
    amount: Decimal,
    currency: CurrencyCode,
    unit: MarketUnitCode,
    bid?: Decimal | undefined,
    ask?: Decimal | undefined
  ) {
    super({
      amount: amount.toString(),
      currency,
      unit,
      bid: bid?.toString(),
      ask: ask?.toString(),
    });
    this._amount = amount;
    this._currency = currency;
    this._unit = unit;
    this._bid = bid;
    this._ask = ask;
  }

  get amount(): Decimal {
    return this._amount;
  }

  get currency(): CurrencyCode {
    return this._currency;
  }

  get unit(): MarketUnitCode {
    return this._unit;
  }

  get bid(): Decimal | undefined {
    return this._bid;
  }

  get ask(): Decimal | undefined {
    return this._ask;
  }

  get spread(): Decimal | undefined {
    if (this._bid !== undefined && this._ask !== undefined) {
      return this._ask.minus(this._bid);
    }
    return undefined;
  }

  static create(params: {
    amount: Decimal | string;
    currency: string;
    unit: string;
    bid?: Decimal | string | undefined;
    ask?: Decimal | string | undefined;
  }): Result<MarketPrice, ValidationError> {
    const currencyResult = parseCurrencyCode(params.currency);
    if (currencyResult.isErr) return err(currencyResult.error);

    const unitResult = parseMarketUnit(params.unit);
    if (unitResult.isErr) return err(unitResult.error);

    let amountDec: Decimal;
    try {
      if (typeof params.amount === 'string' && params.amount.trim() === '') {
        return err(new ValidationError('MarketPrice amount cannot be empty.'));
      }
      amountDec = params.amount instanceof Decimal ? params.amount : new Decimal(params.amount);
      if (!amountDec.isFinite() || amountDec.isNaN()) {
        return err(new ValidationError(`MarketPrice amount must be a finite number: "${params.amount}"`));
      }
      if (amountDec.lessThan(0)) {
        return err(new ValidationError(`MarketPrice amount cannot be negative: ${amountDec.toString()}`));
      }
    } catch {
      return err(new ValidationError(`Failed to parse market price amount: "${params.amount}"`));
    }

    let bidDec: Decimal | undefined;
    if (params.bid !== undefined && params.bid !== null) {
      try {
        if (typeof params.bid === 'string' && params.bid.trim() === '') {
          return err(new ValidationError('MarketPrice bid cannot be empty string.'));
        }
        bidDec = params.bid instanceof Decimal ? params.bid : new Decimal(params.bid);
        if (!bidDec.isFinite() || bidDec.isNaN() || bidDec.lessThan(0)) {
          return err(new ValidationError(`MarketPrice bid must be non-negative and finite: "${params.bid}"`));
        }
      } catch {
        return err(new ValidationError(`Failed to parse market price bid: "${params.bid}"`));
      }
    }

    let askDec: Decimal | undefined;
    if (params.ask !== undefined && params.ask !== null) {
      try {
        if (typeof params.ask === 'string' && params.ask.trim() === '') {
          return err(new ValidationError('MarketPrice ask cannot be empty string.'));
        }
        askDec = params.ask instanceof Decimal ? params.ask : new Decimal(params.ask);
        if (!askDec.isFinite() || askDec.isNaN() || askDec.lessThan(0)) {
          return err(new ValidationError(`MarketPrice ask must be non-negative and finite: "${params.ask}"`));
        }
      } catch {
        return err(new ValidationError(`Failed to parse market price ask: "${params.ask}"`));
      }
    }

    if (bidDec !== undefined && askDec !== undefined && bidDec.greaterThan(askDec)) {
      return err(
        new ValidationError(
          `MarketPrice bid (${bidDec.toString()}) cannot exceed ask (${askDec.toString()}).`
        )
      );
    }

    return ok(new MarketPrice(amountDec, currencyResult.value, unitResult.value, bidDec, askDec));
  }

  override equals(other?: ValueObject<MarketPriceProps> | null): boolean {
    if (!other || !(other instanceof MarketPrice)) {
      return false;
    }
    const sameAmount = this._amount.equals(other._amount);
    const sameCurrency = this._currency === other._currency;
    const sameUnit = this._unit === other._unit;
    const sameBid =
      (this._bid === undefined && other._bid === undefined) ||
      (this._bid !== undefined && other._bid !== undefined && this._bid.equals(other._bid));
    const sameAsk =
      (this._ask === undefined && other._ask === undefined) ||
      (this._ask !== undefined && other._ask !== undefined && this._ask.equals(other._ask));

    return sameAmount && sameCurrency && sameUnit && sameBid && sameAsk;
  }

  toDto(): MarketPriceDto {
    return {
      amount: this._amount.toString(),
      currency: this._currency,
      unit: this._unit,
      bid: this._bid?.toString(),
      ask: this._ask?.toString(),
      spread: this.spread?.toString(),
    };
  }

  override toString(): string {
    return `${this._amount.toString()} ${this._currency} / ${this._unit}`;
  }
}
