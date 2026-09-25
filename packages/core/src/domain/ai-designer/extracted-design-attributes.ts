import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { ok, err, type Result } from '../../common/result.js';
import type { MaterialType } from '../catalog/material-specification.js';
import type { JewelryType } from '../catalog/jewelry-specification.js';
import type { GemstoneType } from '../catalog/gemstone-specification.js';

export const OCCASIONS = [
  'DAILY_WEAR',
  'ENGAGEMENT',
  'WEDDING',
  'GIFT',
  'INVESTMENT',
  'ANNIVERSARY',
  'PARTY',
  'OTHER',
] as const;
export type DesignOccasion = (typeof OCCASIONS)[number];

export interface ExtractedDesignAttributesProps {
  jewelryType?: JewelryType | undefined;
  metalType?: MaterialType | undefined;
  purityFineness?: string | undefined; // e.g. "750"
  karatEquivalent?: string | undefined; // e.g. "18"
  gemstoneType?: GemstoneType | undefined;
  gemstoneDescription?: string | undefined;
  occasion?: DesignOccasion | undefined;
  targetBudgetAmount?: string | undefined;
  targetBudgetCurrency?: string | undefined;
  estimatedWeightGrams?: string | undefined;
  designStyle?: string | undefined;
  notes?: string | undefined;
}

export class ExtractedDesignAttributes extends ValueObject<ExtractedDesignAttributesProps> {
  private constructor(props: ExtractedDesignAttributesProps) {
    super(props);
  }

  get jewelryType(): JewelryType | undefined {
    return this.props.jewelryType;
  }

  get metalType(): MaterialType | undefined {
    return this.props.metalType;
  }

  get purityFineness(): string | undefined {
    return this.props.purityFineness;
  }

  get karatEquivalent(): string | undefined {
    return this.props.karatEquivalent;
  }

  get gemstoneType(): GemstoneType | undefined {
    return this.props.gemstoneType;
  }

  get gemstoneDescription(): string | undefined {
    return this.props.gemstoneDescription;
  }

  get occasion(): DesignOccasion | undefined {
    return this.props.occasion;
  }

  get targetBudgetAmount(): string | undefined {
    return this.props.targetBudgetAmount;
  }

  get targetBudgetCurrency(): string | undefined {
    return this.props.targetBudgetCurrency;
  }

  get estimatedWeightGrams(): string | undefined {
    return this.props.estimatedWeightGrams;
  }

  get designStyle(): string | undefined {
    return this.props.designStyle;
  }

  get notes(): string | undefined {
    return this.props.notes;
  }

  static empty(): ExtractedDesignAttributes {
    return new ExtractedDesignAttributes({});
  }

  static create(props: ExtractedDesignAttributesProps): Result<ExtractedDesignAttributes, ValidationError> {
    const validJewelryTypes: JewelryType[] = [
      'RING',
      'NECKLACE',
      'BRACELET',
      'EARRINGS',
      'PENDANT',
      'BULLION',
      'COIN',
      'OTHER',
    ];
    if (props.jewelryType && !validJewelryTypes.includes(props.jewelryType)) {
      return err(new ValidationError(`Invalid jewelryType: "${props.jewelryType}".`));
    }

    const validMetals: MaterialType[] = ['GOLD', 'PLATINUM', 'SILVER'];
    if (props.metalType && !validMetals.includes(props.metalType)) {
      return err(new ValidationError(`Invalid metalType: "${props.metalType}".`));
    }

    const validGemstones: GemstoneType[] = ['DIAMOND', 'RUBY', 'EMERALD', 'SAPPHIRE', 'PEARL', 'OTHER'];
    if (props.gemstoneType && !validGemstones.includes(props.gemstoneType)) {
      return err(new ValidationError(`Invalid gemstoneType: "${props.gemstoneType}".`));
    }

    if (props.occasion && !OCCASIONS.includes(props.occasion)) {
      return err(new ValidationError(`Invalid occasion: "${props.occasion}".`));
    }

    return ok(
      new ExtractedDesignAttributes({
        jewelryType: props.jewelryType,
        metalType: props.metalType,
        purityFineness: props.purityFineness?.trim() || undefined,
        karatEquivalent: props.karatEquivalent?.trim() || undefined,
        gemstoneType: props.gemstoneType,
        gemstoneDescription: props.gemstoneDescription?.trim() || undefined,
        occasion: props.occasion,
        targetBudgetAmount: props.targetBudgetAmount?.trim() || undefined,
        targetBudgetCurrency: props.targetBudgetCurrency?.trim() || undefined,
        estimatedWeightGrams: props.estimatedWeightGrams?.trim() || undefined,
        designStyle: props.designStyle?.trim() || undefined,
        notes: props.notes?.trim() || undefined,
      })
    );
  }

  /**
   * Merges existing attributes with newly extracted attributes (new values overwrite defined fields).
   */
  merge(other: ExtractedDesignAttributes): ExtractedDesignAttributes {
    return new ExtractedDesignAttributes({
      jewelryType: other.jewelryType ?? this.jewelryType,
      metalType: other.metalType ?? this.metalType,
      purityFineness: other.purityFineness ?? this.purityFineness,
      karatEquivalent: other.karatEquivalent ?? this.karatEquivalent,
      gemstoneType: other.gemstoneType ?? this.gemstoneType,
      gemstoneDescription: other.gemstoneDescription ?? this.gemstoneDescription,
      occasion: other.occasion ?? this.occasion,
      targetBudgetAmount: other.targetBudgetAmount ?? this.targetBudgetAmount,
      targetBudgetCurrency: other.targetBudgetCurrency ?? this.targetBudgetCurrency,
      estimatedWeightGrams: other.estimatedWeightGrams ?? this.estimatedWeightGrams,
      designStyle: other.designStyle ?? this.designStyle,
      notes: other.notes ?? this.notes,
    });
  }

  toDto(): ExtractedDesignAttributesProps {
    return { ...this.props };
  }
}
