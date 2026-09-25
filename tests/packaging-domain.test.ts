import { describe, it, expect } from 'vitest';
import {
  BoxDimensions,
  PackagingSpecification,
  PackagingCostCalculator,
  InvalidPackagingDimensionsError,
  createEntityId,
  type PackagingSpecId,
  type TenantId,
} from '@v-gold/core';

describe('Stage 16 AI Packaging & Box Studio Domain Unit Tests', () => {
  const tenantId = createEntityId<TenantId>('tenant-pkg-unit');
  const specId = createEntityId<PackagingSpecId>('pkg-spec-1');

  it('validates box dimension bounds and computes volume and surface area accurately', () => {
    // Valid dimensions
    const dimRes = BoxDimensions.create({
      widthMm: 100,
      lengthMm: 120,
      heightMm: 50,
    });
    expect(dimRes.isOk).toBe(true);
    const dim = dimRes.unwrap();

    expect(dim.widthMm).toBe(100);
    expect(dim.lengthMm).toBe(120);
    expect(dim.heightMm).toBe(50);

    // surface area = 2 * (100*120 + 100*50 + 120*50) = 2 * (12000 + 5000 + 6000) = 46000 mm2
    expect(dim.surfaceAreaMm2).toBe(46000);
    // volume = 100 * 120 * 50 = 600,000 mm3
    expect(dim.volumeMm3).toBe(600000);

    // Invalid dimensions: width too small (< 20mm)
    const tooSmall = BoxDimensions.create({
      widthMm: 15,
      lengthMm: 100,
      heightMm: 50,
    });
    expect(tooSmall.isErr).toBe(true);
    if (tooSmall.isErr) {
      expect(tooSmall.error).toBeInstanceOf(InvalidPackagingDimensionsError);
    }
  });

  it('computes realistic packaging costs across luxury tiers and finishes', () => {
    const dim = BoxDimensions.create({
      widthMm: 80,
      lengthMm: 80,
      heightMm: 40,
    }).unwrap();

    // Standard Velvet Box
    const velvetCost = PackagingCostCalculator.calculateCost(dim, {
      material: 'VELVET',
      tier: 'STANDARD',
      hasCustomDieline: false,
      hasFoilEmbossing: false,
    }).unwrap();

    // Bespoke Luxury Leather Box with Foil Stamping and Custom Dieline
    const bespokeCost = PackagingCostCalculator.calculateCost(dim, {
      material: 'LEATHER',
      tier: 'BESPOKE_LUXURY',
      hasCustomDieline: true,
      hasFoilEmbossing: true,
    }).unwrap();

    expect(Number(bespokeCost.amount.toString())).toBeGreaterThan(Number(velvetCost.amount.toString()));
  });

  it('creates PackagingSpecification aggregate and applies AI preview image url', () => {
    const specRes = PackagingSpecification.create(specId, {
      tenantId,
      name: 'Signature Emerald Ring Box',
      dimensions: {
        widthMm: 70,
        lengthMm: 70,
        heightMm: 45,
      },
      material: 'VELVET',
      tier: 'PREMIUM',
      primaryColorHex: '#0f382c',
      accentColorHex: '#d4af37',
      hasCustomDieline: true,
      hasFoilEmbossing: true,
      dieline: {
        fluteOrBoardThicknessMm: 2.0,
        creasingMatrixMm: 0.8,
        insertCushionType: 'RING_CLIP',
      },
    });

    expect(specRes.isOk).toBe(true);
    const spec = specRes.unwrap();
    expect(spec.name).toBe('Signature Emerald Ring Box');
    expect(spec.material).toBe('VELVET');
    expect(spec.hasCustomDieline).toBe(true);
    expect(spec.productionCost.amount.toNumber()).toBeGreaterThan(0);

    spec.setAiPreviewImageUrl('https://cdn.v-gold.test/packaging/preview.png');
    expect(spec.aiPreviewImageUrl).toBe('https://cdn.v-gold.test/packaging/preview.png');
  });
});
