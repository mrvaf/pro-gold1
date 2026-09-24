import { Decimal } from 'decimal.js';
import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { Weight, WEIGHT_CONVERSION_CONSTANTS } from '../material/weight.js';

export type GemstoneType = 'DIAMOND' | 'RUBY' | 'EMERALD' | 'SAPPHIRE' | 'PEARL' | 'OTHER';

export interface GemstoneCaratWeightProps {
  carats: string;
}

/**
 * Gemstone Carat Weight Value Object.
 * Strictly dedicated to gemstone mass (carats).
 * Enforces domain separation: carat weight is NEVER directly interchangeable with gold weight.
 * 1 Carat = 0.200 grams.
 */
export class GemstoneCaratWeight extends ValueObject<GemstoneCaratWeightProps> {
  private readonly _carats: Decimal;

  private constructor(carats: Decimal) {
    super({ carats: carats.toString() });
    this._carats = carats;
  }

  get carats(): Decimal {
    return this._carats;
  }

  static fromCarats(caratsInput: Decimal | string | number): Result<GemstoneCaratWeight, ValidationError> {
    try {
      const dec = caratsInput instanceof Decimal ? caratsInput : new Decimal(caratsInput);
      if (!dec.isFinite() || dec.isNaN()) {
        return err(new ValidationError(`Invalid gemstone carat weight: "${caratsInput}". Must be a finite number.`));
      }
      if (dec.lessThan(0)) {
        return err(new ValidationError(`Gemstone carat weight cannot be negative. Received: ${dec.toString()} ct`));
      }
      return ok(new GemstoneCaratWeight(dec));
    } catch {
      return err(new ValidationError(`Failed to parse gemstone carat weight: "${caratsInput}".`));
    }
  }

  /**
   * Converts gemstone carats to physical Weight in grams for gross item mass calculation only.
   * Note: This returns physical weight, which must NOT be treated as gold mass.
   * Strictly reuses the canonical WEIGHT_CONVERSION_CONSTANTS.CARATS_PER_GRAM (5 ct = 1 g).
   */
  toPhysicalWeight(): Weight {
    const grams = this._carats.dividedBy(WEIGHT_CONVERSION_CONSTANTS.CARATS_PER_GRAM);
    return Weight.fromGrams(grams).unwrap();
  }

  override toString(): string {
    return `${this._carats.toString()} ct`;
  }
}

export interface GemstoneSpecificationProps {
  gemstoneType: GemstoneType;
  caratWeight: string; // Carats
  count: number;
  color?: string | undefined;
  clarity?: string | undefined;
  cut?: string | undefined;
  certificateNumber?: string | undefined;
  description?: string | undefined;
}

export interface CreateGemstoneSpecInput {
  gemstoneType: GemstoneType;
  carats: Decimal | string | number;
  count?: number | undefined;
  color?: string | undefined;
  clarity?: string | undefined;
  cut?: string | undefined;
  certificateNumber?: string | undefined;
  description?: string | undefined;
}

/**
 * Gemstone Specification Value Object.
 * Represents non-authoritative gemstone catalog metadata (type, carats, 4Cs, certificate).
 * No valuation or pricing calculation is performed here.
 */
export class GemstoneSpecification extends ValueObject<GemstoneSpecificationProps> {
  private readonly _gemstoneType: GemstoneType;
  private readonly _caratWeight: GemstoneCaratWeight;
  private readonly _count: number;

  private constructor(
    gemstoneType: GemstoneType,
    caratWeight: GemstoneCaratWeight,
    count: number,
    color?: string,
    clarity?: string,
    cut?: string,
    certificateNumber?: string,
    description?: string
  ) {
    super({
      gemstoneType,
      caratWeight: caratWeight.carats.toString(),
      count,
      ...(color ? { color } : {}),
      ...(clarity ? { clarity } : {}),
      ...(cut ? { cut } : {}),
      ...(certificateNumber ? { certificateNumber } : {}),
      ...(description ? { description } : {}),
    });
    this._gemstoneType = gemstoneType;
    this._caratWeight = caratWeight;
    this._count = count;
  }

  get gemstoneType(): GemstoneType {
    return this._gemstoneType;
  }

  get caratWeight(): GemstoneCaratWeight {
    return this._caratWeight;
  }

  get count(): number {
    return this._count;
  }

  get color(): string | undefined {
    return this.props.color;
  }

  get clarity(): string | undefined {
    return this.props.clarity;
  }

  get cut(): string | undefined {
    return this.props.cut;
  }

  get certificateNumber(): string | undefined {
    return this.props.certificateNumber;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  static create(input: CreateGemstoneSpecInput): Result<GemstoneSpecification, ValidationError> {
    const validTypes: GemstoneType[] = ['DIAMOND', 'RUBY', 'EMERALD', 'SAPPHIRE', 'PEARL', 'OTHER'];
    if (!validTypes.includes(input.gemstoneType)) {
      return err(new ValidationError(`Invalid gemstone type: "${input.gemstoneType}". Valid types: ${validTypes.join(', ')}`));
    }

    const caratRes = GemstoneCaratWeight.fromCarats(input.carats);
    if (caratRes.isErr) return err(caratRes.error);

    const count = input.count ?? 1;
    if (!Number.isInteger(count) || count < 1) {
      return err(new ValidationError(`Gemstone count must be a positive integer. Received: ${count}`));
    }

    return ok(
      new GemstoneSpecification(
        input.gemstoneType,
        caratRes.value,
        count,
        input.color?.trim() || undefined,
        input.clarity?.trim() || undefined,
        input.cut?.trim() || undefined,
        input.certificateNumber?.trim() || undefined,
        input.description?.trim() || undefined
      )
    );
  }

  /**
   * Total physical mass in grams of this gemstone specification.
   */
  totalPhysicalWeight(): Weight {
    return this._caratWeight.toPhysicalWeight();
  }

  toDto(): GemstoneSpecificationProps {
    return { ...this.props };
  }
}
