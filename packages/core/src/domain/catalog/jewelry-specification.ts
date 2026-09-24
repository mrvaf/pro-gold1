import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { Weight } from '../material/weight.js';
import { MaterialSpecification } from './material-specification.js';
import { GemstoneSpecification, type GemstoneSpecificationProps } from './gemstone-specification.js';
import { Decimal } from 'decimal.js';

export type JewelryType =
  | 'RING'
  | 'NECKLACE'
  | 'BRACELET'
  | 'EARRINGS'
  | 'PENDANT'
  | 'BULLION'
  | 'COIN'
  | 'OTHER';

export interface JewelrySpecificationProps {
  jewelryType: JewelryType;
  metal: MaterialSpecification;
  grossWeight: Weight;
  gemstones: GemstoneSpecification[];
}

export interface CreateJewelrySpecInput {
  jewelryType: JewelryType;
  metal: MaterialSpecification;
  grossWeight: Weight;
  gemstones?: GemstoneSpecification[] | undefined;
}

export interface JewelrySpecificationDto {
  jewelryType: JewelryType;
  metal: {
    materialType: string;
    purityFineness: string;
    karatEquivalent?: string | undefined;
    weightGrams: string;
  };
  grossWeightGrams: string;
  netGoldWeightGrams: string;
  pureGoldWeightGrams: string;
  gemstones: GemstoneSpecificationProps[];
}

/**
 * Jewelry Specification Value Object.
 * Enforces critical physical invariants:
 * 1. grossWeight >= netGoldWeight
 * 2. grossWeight >= netGoldWeight + gemstoneMassInGrams
 * 3. Gemstone carats cannot become gold mass.
 */
export class JewelrySpecification extends ValueObject<JewelrySpecificationProps> {
  private readonly _jewelryType: JewelryType;
  private readonly _metal: MaterialSpecification;
  private readonly _grossWeight: Weight;
  private readonly _gemstones: readonly GemstoneSpecification[];

  private constructor(
    jewelryType: JewelryType,
    metal: MaterialSpecification,
    grossWeight: Weight,
    gemstones: GemstoneSpecification[]
  ) {
    super({
      jewelryType,
      metal,
      grossWeight,
      gemstones,
    });
    this._jewelryType = jewelryType;
    this._metal = metal;
    this._grossWeight = grossWeight;
    this._gemstones = Object.freeze([...gemstones]);
  }

  get jewelryType(): JewelryType {
    return this._jewelryType;
  }

  get metal(): MaterialSpecification {
    return this._metal;
  }

  get grossWeight(): Weight {
    return this._grossWeight;
  }

  get netGoldWeight(): Weight {
    return this._metal.weight;
  }

  get gemstones(): readonly GemstoneSpecification[] {
    return this._gemstones;
  }

  /**
   * Derive the pure/fine gold content.
   */
  get pureGoldWeight(): Weight {
    return this._metal.pureMetalWeight();
  }

  static create(input: CreateJewelrySpecInput): Result<JewelrySpecification, ValidationError> {
    const validTypes: JewelryType[] = [
      'RING',
      'NECKLACE',
      'BRACELET',
      'EARRINGS',
      'PENDANT',
      'BULLION',
      'COIN',
      'OTHER',
    ];

    if (!validTypes.includes(input.jewelryType)) {
      return err(
        new ValidationError(
          `Invalid jewelry type: "${input.jewelryType}". Must be one of: ${validTypes.join(', ')}`
        )
      );
    }

    const netGoldGrams = input.metal.weight.grams;
    const grossGrams = input.grossWeight.grams;

    // Physical Invariant 1: Gross weight cannot be less than net gold weight
    if (grossGrams.lessThan(netGoldGrams)) {
      return err(
        new ValidationError(
          `Gross weight (${grossGrams.toString()}g) cannot be less than net metal weight (${netGoldGrams.toString()}g).`
        )
      );
    }

    const gemstones = input.gemstones ?? [];

    // Compute total gemstone physical mass in grams (1 ct = 0.200g)
    let totalStoneGrams = new Decimal(0);
    for (const stone of gemstones) {
      totalStoneGrams = totalStoneGrams.plus(stone.totalPhysicalWeight().grams);
    }

    // Physical Invariant 2: Gross weight cannot be less than net metal + gemstones mass (Exact Decimal.js comparison)
    const totalExpectedGrams = netGoldGrams.plus(totalStoneGrams);
    if (grossGrams.lessThan(totalExpectedGrams)) {
      return err(
        new ValidationError(
          `Gross weight (${grossGrams.toString()}g) is less than combined metal (${netGoldGrams.toString()}g) and gemstone mass (${totalStoneGrams.toString()}g, total ${totalExpectedGrams.toString()}g).`
        )
      );
    }

    return ok(new JewelrySpecification(input.jewelryType, input.metal, input.grossWeight, gemstones));
  }

  toDto(): JewelrySpecificationDto {
    return {
      jewelryType: this._jewelryType,
      metal: this._metal.toDto(),
      grossWeightGrams: this._grossWeight.grams.toString(),
      netGoldWeightGrams: this.netGoldWeight.grams.toString(),
      pureGoldWeightGrams: this.pureGoldWeight.grams.toString(),
      gemstones: this._gemstones.map((g) => g.toDto()),
    };
  }
}
