import { Result, ok, err } from '../../common/result.js';
import { ContentGroundingViolationError } from './content-studio-errors.js';

export interface GroundingAttributes {
  title: string;
  targetKarat?: number;
  weightGrams?: number;
  gemstone?: string;
  metalType: string;
}

export class ContentGroundingValidator {
  /**
   * Validates that generated marketing/certificate copy matches authoritative technical specs.
   * Prevents LLM hallucinations on gold purity, metal type, and gemstone presence.
   */
  static validate(
    content: string,
    attributes: GroundingAttributes
  ): Result<void, ContentGroundingViolationError> {
    const lowerContent = content.toLowerCase();

    // 1. Metal type grounding check
    if (attributes.metalType) {
      const metal = attributes.metalType.toLowerCase();
      if (!lowerContent.includes(metal)) {
        return err(
          new ContentGroundingViolationError(
            `Metal type ${attributes.metalType}`,
            content.slice(0, 80)
          )
        );
      }
    }

    // 2. Karat check for gold
    if (attributes.metalType.toUpperCase() === 'GOLD' && attributes.targetKarat) {
      const karatStr = `${attributes.targetKarat}k`;
      const karatStrAlt = `${attributes.targetKarat} karat`;
      const karatFineness = attributes.targetKarat === 18 ? '750' : attributes.targetKarat === 24 ? '999' : '';

      const hasKarat =
        lowerContent.includes(karatStr) ||
        lowerContent.includes(karatStrAlt) ||
        (karatFineness && lowerContent.includes(karatFineness));

      if (!hasKarat) {
        return err(
          new ContentGroundingViolationError(
            `Gold Karat ${attributes.targetKarat}K`,
            content.slice(0, 80)
          )
        );
      }
    }

    // 3. Gemstone grounding check
    if (attributes.gemstone) {
      const gem = attributes.gemstone.toLowerCase();
      if (!lowerContent.includes(gem)) {
        return err(
          new ContentGroundingViolationError(
            `Gemstone "${attributes.gemstone}"`,
            content.slice(0, 80)
          )
        );
      }
    }

    return ok(undefined);
  }
}
