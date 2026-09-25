import { Decimal } from 'decimal.js';
import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';

export interface GoldPurityProps {
  fineness: string; // Parts per thousand (e.g. "750" for 18K, "999.9" for 24K)
  karatEquivalent: string; // Karat value (e.g. "18")
}

/**
 * Standard known gold karat and millesimal fineness definitions.
 * Karat = (Fineness / 1000) * 24
 * Fineness = (Karat / 24) * 1000
 */
export const STANDARD_PURITY_DEFINITIONS = {
  K24: { karat: '24', fineness: '999.9' },
  K22: { karat: '22', fineness: '916' },
  K21: { karat: '21', fineness: '875' },
  K18: { karat: '18', fineness: '750' },
  K14: { karat: '14', fineness: '585' },
  K9: { karat: '9', fineness: '375' },
} as const;

/**
 * Gold Purity Value Object.
 * Represents gold purity strictly in millesimal fineness (parts per 1000) and karat equivalent.
 * Independent of presentation strings and UI styling.
 */
export class GoldPurity extends ValueObject<GoldPurityProps> {
  private readonly _fineness: Decimal;
  private readonly _karat: Decimal;

  private constructor(fineness: Decimal, karat: Decimal) {
    super({
      fineness: fineness.toString(),
      karatEquivalent: karat.toString(),
    });
    this._fineness = fineness;
    this._karat = karat;
  }

  get fineness(): Decimal {
    return this._fineness;
  }

  get karat(): Decimal {
    return this._karat;
  }

  /**
   * Pure factor between 0.000 and 1.000 representing the pure gold fraction.
   * e.g., 750 fineness -> 0.75
   */
  get pureGoldFraction(): Decimal {
    return this._fineness.dividedBy(1000);
  }

  /**
   * Create purity from millesimal fineness (e.g. 750 for 18K, 875 for 21K, 999.9 for 24K).
   * Valid range: 1 to 1000.
   */
  static fromFineness(finenessInput: Decimal | string): Result<GoldPurity, ValidationError> {
    try {
      const dec = finenessInput instanceof Decimal ? finenessInput : new Decimal(finenessInput);
      if (!dec.isFinite() || dec.isNaN()) {
        return err(new ValidationError(`Invalid gold fineness: "${finenessInput}". Must be a finite number.`));
      }
      if (dec.lessThanOrEqualTo(0) || dec.greaterThan(1000)) {
        return err(
          new ValidationError(
            `Gold fineness must be greater than 0 and at most 1000 parts per thousand. Received: ${dec.toString()}`
          )
        );
      }
      // Karat = (fineness / 1000) * 24
      const karat = dec.dividedBy(1000).times(24);
      return ok(new GoldPurity(dec, karat));
    } catch {
      return err(new ValidationError(`Failed to parse gold fineness: "${finenessInput}".`));
    }
  }

  /**
   * Create purity from Karat value (e.g. 18, 21, 24).
   * Valid range: 0.1 to 24.
   */
  static fromKarat(karatInput: Decimal | string): Result<GoldPurity, ValidationError> {
    try {
      const dec = karatInput instanceof Decimal ? karatInput : new Decimal(karatInput);
      if (!dec.isFinite() || dec.isNaN()) {
        return err(new ValidationError(`Invalid gold karat: "${karatInput}". Must be a finite number.`));
      }
      if (dec.lessThanOrEqualTo(0) || dec.greaterThan(24)) {
        return err(
          new ValidationError(`Gold karat must be greater than 0 and at most 24. Received: ${dec.toString()}`)
        );
      }
      // Fineness = (karat / 24) * 1000
      let fineness = dec.dividedBy(24).times(1000);
      // Canonical adjustment for standard karats
      if (dec.equals(24)) {
        fineness = new Decimal('999.9');
      } else if (dec.equals(22)) {
        fineness = new Decimal('916');
      } else if (dec.equals(21)) {
        fineness = new Decimal('875');
      } else if (dec.equals(18)) {
        fineness = new Decimal('750');
      } else if (dec.equals(14)) {
        fineness = new Decimal('585');
      } else if (dec.equals(9)) {
        fineness = new Decimal('375');
      }

      return ok(new GoldPurity(fineness, dec));
    } catch {
      return err(new ValidationError(`Failed to parse gold karat: "${karatInput}".`));
    }
  }

  // Common industry presets
  static readonly K24 = new GoldPurity(new Decimal(STANDARD_PURITY_DEFINITIONS.K24.fineness), new Decimal(24));
  static readonly K22 = new GoldPurity(new Decimal(STANDARD_PURITY_DEFINITIONS.K22.fineness), new Decimal(22));
  static readonly K21 = new GoldPurity(new Decimal(STANDARD_PURITY_DEFINITIONS.K21.fineness), new Decimal(21));
  static readonly K18 = new GoldPurity(new Decimal(STANDARD_PURITY_DEFINITIONS.K18.fineness), new Decimal(18));
  static readonly K14 = new GoldPurity(new Decimal(STANDARD_PURITY_DEFINITIONS.K14.fineness), new Decimal(14));
  static readonly K9 = new GoldPurity(new Decimal(STANDARD_PURITY_DEFINITIONS.K9.fineness), new Decimal(9));

  override equals(other?: ValueObject<GoldPurityProps> | null): boolean {
    if (!other || !(other instanceof GoldPurity)) {
      return false;
    }
    return this._fineness.equals(other._fineness);
  }

  override toString(): string {
    return `${this._karat.toDecimalPlaces(1).toString()}K (${this._fineness.toString()}/1000)`;
  }
}
