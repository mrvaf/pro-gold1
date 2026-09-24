import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { GoldPurity } from '../material/gold-purity.js';
import { Weight } from '../material/weight.js';
import { Decimal } from 'decimal.js';

export type MaterialType = 'GOLD' | 'PLATINUM' | 'SILVER';

export interface MaterialSpecificationProps {
  materialType: MaterialType;
  purityFineness: string; // Parts per thousand (e.g. "750", "950", "925")
  karatEquivalent?: string | undefined; // For gold only (e.g. "18")
  weightGrams: string;
}

/**
 * Material Specification Value Object.
 * Gold is authoritative with strict GoldPurity and Weight semantics.
 * Platinum and Silver are supported as typed structural extension points without fake market formulas.
 */
export class MaterialSpecification extends ValueObject<MaterialSpecificationProps> {
  private readonly _materialType: MaterialType;
  private readonly _goldPurity: GoldPurity | undefined;
  private readonly _purityFineness: Decimal;
  private readonly _weight: Weight;

  private constructor(
    materialType: MaterialType,
    weight: Weight,
    purityFineness: Decimal,
    goldPurity?: GoldPurity
  ) {
    super({
      materialType,
      purityFineness: purityFineness.toString(),
      karatEquivalent: goldPurity ? goldPurity.karat.toString() : undefined,
      weightGrams: weight.grams.toString(),
    });
    this._materialType = materialType;
    this._weight = weight;
    this._purityFineness = purityFineness;
    this._goldPurity = goldPurity;
  }

  get materialType(): MaterialType {
    return this._materialType;
  }

  get weight(): Weight {
    return this._weight;
  }

  get purityFineness(): Decimal {
    return this._purityFineness;
  }

  get goldPurity(): GoldPurity | undefined {
    return this._goldPurity;
  }

  /**
   * Primary authoritative factory for gold precious metal.
   */
  static gold(purity: GoldPurity, weight: Weight): Result<MaterialSpecification, ValidationError> {
    if (weight.grams.lessThanOrEqualTo(0)) {
      return err(new ValidationError(`Gold weight must be greater than zero. Received: ${weight.toString()}`));
    }
    return ok(new MaterialSpecification('GOLD', weight, purity.fineness, purity));
  }

  /**
   * Extension point for non-gold precious metals (e.g. Platinum 950, Silver 925).
   * Validates parts per thousand fineness and non-zero mass.
   */
  static preciousMetal(
    materialType: Exclude<MaterialType, 'GOLD'>,
    finenessInput: Decimal | string | number,
    weight: Weight
  ): Result<MaterialSpecification, ValidationError> {
    try {
      const dec = finenessInput instanceof Decimal ? finenessInput : new Decimal(finenessInput);
      if (!dec.isFinite() || dec.isNaN() || dec.lessThanOrEqualTo(0) || dec.greaterThan(1000)) {
        return err(
          new ValidationError(
            `Fineness must be between 1 and 1000 parts per thousand. Received: "${finenessInput}"`
          )
        );
      }
      if (weight.grams.lessThanOrEqualTo(0)) {
        return err(new ValidationError(`Material weight must be greater than zero. Received: ${weight.toString()}`));
      }
      return ok(new MaterialSpecification(materialType, weight, dec, undefined));
    } catch {
      return err(new ValidationError(`Failed to parse fineness: "${finenessInput}".`));
    }
  }

  /**
   * Derive the fine/pure metal mass in grams.
   */
  pureMetalWeight(): Weight {
    const fraction = this._purityFineness.dividedBy(1000);
    const pureGrams = this._weight.grams.times(fraction);
    return Weight.fromGrams(pureGrams).unwrap();
  }

  toDto(): MaterialSpecificationProps {
    return { ...this.props };
  }
}
