import { Decimal } from 'decimal.js';
import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { parseCurrencyCode, type CurrencyCode } from './currency.js';

export interface FxRateProps {
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  rate: string; // Exact Decimal string representation
  observedAt: string; // ISO 8601 UTC string
  source: string;
}

export interface FxRateDto {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  observedAt: string;
  source: string;
  direction: string; // e.g., '1 USD = 0.92000000 EUR'
}

/**
 * Foreign Exchange (FX) Rate Value Object.
 * Represents an authoritative exchange rate between two fiat currencies.
 *
 * Directional Semantics:
 * `1 baseCurrency = rate quoteCurrency`
 * e.g., Base: 'USD', Quote: 'IRR', Rate: '600000' means 1 USD = 600,000 IRR.
 *
 * All rate arithmetic uses arbitrary-precision Decimal.js (no JavaScript floating-point conversions).
 */
export class FxRate extends ValueObject<FxRateProps> {
  private readonly _baseCurrency: CurrencyCode;
  private readonly _quoteCurrency: CurrencyCode;
  private readonly _rate: Decimal;
  private readonly _observedAt: Date;
  private readonly _source: string;

  private constructor(
    baseCurrency: CurrencyCode,
    quoteCurrency: CurrencyCode,
    rate: Decimal,
    observedAt: Date,
    source: string
  ) {
    super({
      baseCurrency,
      quoteCurrency,
      rate: rate.toString(),
      observedAt: observedAt.toISOString(),
      source,
    });
    this._baseCurrency = baseCurrency;
    this._quoteCurrency = quoteCurrency;
    this._rate = rate;
    this._observedAt = observedAt;
    this._source = source;
  }

  get baseCurrency(): CurrencyCode {
    return this._baseCurrency;
  }

  get quoteCurrency(): CurrencyCode {
    return this._quoteCurrency;
  }

  get rate(): Decimal {
    return this._rate;
  }

  get observedAt(): Date {
    return this._observedAt;
  }

  get source(): string {
    return this._source;
  }

  static create(params: {
    baseCurrency: string;
    quoteCurrency: string;
    rate: Decimal | string;
    observedAt?: Date | string | undefined;
    source: string;
  }): Result<FxRate, ValidationError> {
    const baseResult = parseCurrencyCode(params.baseCurrency);
    if (baseResult.isErr) return err(baseResult.error);

    const quoteResult = parseCurrencyCode(params.quoteCurrency);
    if (quoteResult.isErr) return err(quoteResult.error);

    if (baseResult.value === quoteResult.value) {
      return err(
        new ValidationError(
          `Base currency and quote currency cannot be identical: "${baseResult.value}". Parity conversion does not require an FX rate.`
        )
      );
    }

    const source = params.source.trim();
    if (!source || source.length > 64) {
      return err(new ValidationError('FxRate source must be between 1 and 64 characters.'));
    }

    let rateDec: Decimal;
    try {
      if (typeof params.rate === 'string' && params.rate.trim() === '') {
        return err(new ValidationError('FxRate amount cannot be empty.'));
      }
      rateDec = params.rate instanceof Decimal ? params.rate : new Decimal(params.rate);
      if (!rateDec.isFinite() || rateDec.isNaN()) {
        return err(new ValidationError(`FxRate must be a finite number: "${params.rate}".`));
      }
      if (rateDec.lessThanOrEqualTo(0)) {
        return err(
          new ValidationError(`FxRate must be strictly positive (> 0). Received: "${rateDec.toString()}".`)
        );
      }
    } catch {
      return err(new ValidationError(`Failed to parse FX rate: "${params.rate}".`));
    }

    let observedAt: Date;
    if (!params.observedAt) {
      observedAt = new Date();
    } else if (params.observedAt instanceof Date) {
      observedAt = params.observedAt;
    } else {
      observedAt = new Date(params.observedAt);
    }

    if (isNaN(observedAt.getTime())) {
      return err(new ValidationError('FxRate observedAt must be a valid date.'));
    }

    return ok(new FxRate(baseResult.value, quoteResult.value, rateDec, observedAt, source));
  }

  /**
   * Deterministically inverts the exchange rate to produce the reverse direction.
   * e.g., if this represents USD -> EUR (1 USD = 0.92 EUR),
   * the inverse represents EUR -> USD (1 EUR = 1 / 0.92 USD = 1.086956521739... USD).
   *
   * Internal calculation preserves arbitrary decimal precision without premature rounding.
   */
  invert(source?: string | undefined, now?: Date | undefined): FxRate {
    const invertedRate = new Decimal(1).dividedBy(this._rate);
    const invertedSource = source ?? `${this._source}_INVERTED`;
    const observedAt = now ?? this._observedAt;

    return new FxRate(
      this._quoteCurrency,
      this._baseCurrency,
      invertedRate,
      observedAt,
      invertedSource
    );
  }

  override equals(other?: ValueObject<FxRateProps> | null): boolean {
    if (!other || !(other instanceof FxRate)) {
      return false;
    }
    return (
      this._baseCurrency === other._baseCurrency &&
      this._quoteCurrency === other._quoteCurrency &&
      this._rate.equals(other._rate) &&
      this._source === other._source
    );
  }

  toDto(): FxRateDto {
    return {
      baseCurrency: this._baseCurrency,
      quoteCurrency: this._quoteCurrency,
      rate: this._rate.toString(),
      observedAt: this._observedAt.toISOString(),
      source: this._source,
      direction: `1 ${this._baseCurrency} = ${this._rate.toString()} ${this._quoteCurrency}`,
    };
  }

  override toString(): string {
    return `FxRate(${this._baseCurrency}/${this._quoteCurrency}: ${this._rate.toString()})`;
  }
}
