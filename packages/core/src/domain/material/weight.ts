import { Decimal } from 'decimal.js';
import { ValueObject } from '../../common/value-object.js';
import { ValidationError, BusinessRuleViolationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';

export interface WeightProps {
  grams: string; // Canonical internal representation in grams
}

export const WEIGHT_CONVERSION_CONSTANTS = {
  MILLIGRAMS_PER_GRAM: new Decimal(1000),
  CARATS_PER_GRAM: new Decimal(5), // 1 carat = 0.200 grams
  GRAMS_PER_MESGHAL: new Decimal('4.6083'), // Standard Iranian gold mesghal = 4.6083 grams
  GRAMS_PER_TROY_OUNCE: new Decimal('31.1034768'), // 1 troy ounce = 31.1034768 grams
} as const;

/**
 * Weight Value Object.
 * Canonical internal unit is strictly GRAMS (g).
 * Mass is guaranteed non-negative.
 * Precision: Preserves arbitrary decimal precision via Decimal.js.
 */
export class Weight extends ValueObject<WeightProps> {
  private readonly _grams: Decimal;

  private constructor(grams: Decimal) {
    super({
      grams: grams.toString(),
    });
    this._grams = grams;
  }

  get grams(): Decimal {
    return this._grams;
  }

  /**
   * Primary factory: Create Weight from grams.
   * Mass must be non-negative and finite.
   */
  static fromGrams(gramsInput: Decimal | string): Result<Weight, ValidationError> {
    try {
      const dec = gramsInput instanceof Decimal ? gramsInput : new Decimal(gramsInput);
      if (!dec.isFinite() || dec.isNaN()) {
        return err(new ValidationError(`Invalid weight: "${gramsInput}". Must be a finite number.`));
      }
      if (dec.lessThan(0)) {
        return err(new ValidationError(`Weight cannot be negative. Received: ${dec.toString()}g`));
      }
      return ok(new Weight(dec));
    } catch {
      return err(new ValidationError(`Failed to parse weight: "${gramsInput}".`));
    }
  }

  /**
   * Factory: Create Weight from milligrams (mg).
   */
  static fromMilligrams(mgInput: Decimal | string): Result<Weight, ValidationError> {
    try {
      const dec = mgInput instanceof Decimal ? mgInput : new Decimal(mgInput);
      if (!dec.isFinite() || dec.isNaN() || dec.lessThan(0)) {
        return err(new ValidationError(`Invalid milligrams: "${mgInput}". Must be non-negative and finite.`));
      }
      return ok(new Weight(dec.dividedBy(WEIGHT_CONVERSION_CONSTANTS.MILLIGRAMS_PER_GRAM)));
    } catch {
      return err(new ValidationError(`Failed to parse milligrams: "${mgInput}".`));
    }
  }

  /**
   * Factory: Create Weight from Iranian Mesghals (1 mesghal = 4.6083g).
   */
  static fromMesghal(mesghalInput: Decimal | string): Result<Weight, ValidationError> {
    try {
      const dec = mesghalInput instanceof Decimal ? mesghalInput : new Decimal(mesghalInput);
      if (!dec.isFinite() || dec.isNaN() || dec.lessThan(0)) {
        return err(new ValidationError(`Invalid mesghal: "${mesghalInput}". Must be non-negative and finite.`));
      }
      return ok(new Weight(dec.times(WEIGHT_CONVERSION_CONSTANTS.GRAMS_PER_MESGHAL)));
    } catch {
      return err(new ValidationError(`Failed to parse mesghal: "${mesghalInput}".`));
    }
  }

  /**
   * Factory: Create Weight from gemstone carats (1 ct = 0.2g).
   */
  static fromCarats(caratsInput: Decimal | string): Result<Weight, ValidationError> {
    try {
      const dec = caratsInput instanceof Decimal ? caratsInput : new Decimal(caratsInput);
      if (!dec.isFinite() || dec.isNaN() || dec.lessThan(0)) {
        return err(new ValidationError(`Invalid carats: "${caratsInput}". Must be non-negative and finite.`));
      }
      return ok(new Weight(dec.dividedBy(WEIGHT_CONVERSION_CONSTANTS.CARATS_PER_GRAM)));
    } catch {
      return err(new ValidationError(`Failed to parse carats: "${caratsInput}".`));
    }
  }

  static zero(): Weight {
    return new Weight(new Decimal(0));
  }

  /**
   * Safe mass addition.
   */
  add(other: Weight): Weight {
    return new Weight(this._grams.plus(other._grams));
  }

  /**
   * Safe mass subtraction.
   * Prevents mass from becoming negative.
   */
  subtract(other: Weight): Result<Weight, BusinessRuleViolationError> {
    const remainder = this._grams.minus(other._grams);
    if (remainder.lessThan(0)) {
      return err(
        new BusinessRuleViolationError(
          `Cannot subtract ${other._grams.toString()}g from ${this._grams.toString()}g: mass cannot become negative.`
        )
      );
    }
    return ok(new Weight(remainder));
  }

  /**
   * Scalar multiplication.
   */
  multiply(factor: Decimal | string): Result<Weight, ValidationError> {
    try {
      const dec = factor instanceof Decimal ? factor : new Decimal(factor);
      if (!dec.isFinite() || dec.isNaN()) {
        return err(new ValidationError(`Multiplication factor must be a finite number: "${factor}".`));
      }
      if (dec.lessThan(0)) {
        return err(new ValidationError(`Weight cannot be multiplied by negative factor: "${factor}".`));
      }
      return ok(new Weight(this._grams.times(dec)));
    } catch {
      return err(new ValidationError(`Invalid multiplication factor: "${factor}".`));
    }
  }

  /**
   * Conversions to alternative units.
   */
  toMilligrams(): Decimal {
    return this._grams.times(WEIGHT_CONVERSION_CONSTANTS.MILLIGRAMS_PER_GRAM);
  }

  toCarats(): Decimal {
    return this._grams.times(WEIGHT_CONVERSION_CONSTANTS.CARATS_PER_GRAM);
  }

  toMesghal(): Decimal {
    return this._grams.dividedBy(WEIGHT_CONVERSION_CONSTANTS.GRAMS_PER_MESGHAL);
  }

  toTroyOunces(): Decimal {
    return this._grams.dividedBy(WEIGHT_CONVERSION_CONSTANTS.GRAMS_PER_TROY_OUNCE);
  }

  round(decimalPlaces: number, mode: Decimal.Rounding = Decimal.ROUND_HALF_UP): Weight {
    if (decimalPlaces < 0 || !Number.isInteger(decimalPlaces)) {
      throw new ValidationError(`Decimal places must be a non-negative integer: ${decimalPlaces}`);
    }
    return new Weight(this._grams.toDecimalPlaces(decimalPlaces, mode));
  }

  compare(other: Weight): number {
    return this._grams.comparedTo(other._grams);
  }

  override equals(other?: ValueObject<WeightProps> | null): boolean {
    if (!other || !(other instanceof Weight)) {
      return false;
    }
    return this._grams.equals(other._grams);
  }

  isZero(): boolean {
    return this._grams.isZero();
  }

  override toString(): string {
    return `${this._grams.toString()}g`;
  }
}
