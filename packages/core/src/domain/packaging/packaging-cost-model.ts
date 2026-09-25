import { Result, ok, err } from '../../common/result.js';
import { Money } from '../finance/money.js';
import { BoxDimensions } from './box-dimensions.js';
import { InvalidPackagingMaterialError } from './packaging-errors.js';

export const BOX_MATERIALS = ['LEATHER', 'VELVET', 'SOLID_WOOD', 'HARDCOVER_PAPER', 'LACQUERED_WOOD'] as const;
export type BoxMaterial = (typeof BOX_MATERIALS)[number];

export const LUXURY_TIERS = ['STANDARD', 'PREMIUM', 'BESPOKE_LUXURY'] as const;
export type LuxuryTier = (typeof LUXURY_TIERS)[number];

export interface PackagingCostModelProps {
  material: BoxMaterial;
  tier: LuxuryTier;
  hasCustomDieline: boolean;
  hasFoilEmbossing: boolean;
}

export class PackagingCostCalculator {
  private static readonly MATERIAL_RATE_PER_100CM2: Record<BoxMaterial, number> = {
    HARDCOVER_PAPER: 1.5,
    VELVET: 3.5,
    LEATHER: 6.0,
    SOLID_WOOD: 8.5,
    LACQUERED_WOOD: 12.0,
  };

  private static readonly TIER_MULTIPLIER: Record<LuxuryTier, number> = {
    STANDARD: 1.0,
    PREMIUM: 1.5,
    BESPOKE_LUXURY: 2.2,
  };

  static calculateCost(
    dimensions: BoxDimensions,
    props: PackagingCostModelProps,
    currency: 'USD' | 'EUR' | 'IRR' | 'TOMAN' = 'USD'
  ): Result<Money, InvalidPackagingMaterialError> {
    const rate = this.MATERIAL_RATE_PER_100CM2[props.material];
    if (rate === undefined) {
      return err(new InvalidPackagingMaterialError(`Unsupported packaging material: ${props.material}`));
    }

    const tierMult = this.TIER_MULTIPLIER[props.tier] ?? 1.0;
    const surfaceUnits = dimensions.surfaceAreaMm2 / 10000;

    let totalAmount = surfaceUnits * rate * tierMult;

    if (props.hasCustomDieline) {
      totalAmount += 25.0;
    }
    if (props.hasFoilEmbossing) {
      totalAmount += 15.0;
    }

    if (totalAmount < 5.0) {
      totalAmount = 5.0;
    }

    const formattedAmount = totalAmount.toFixed(2);
    return Money.create(formattedAmount, currency);
  }
}
