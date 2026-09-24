import { describe, expect, it } from 'vitest';
import {
  Weight,
  GoldPurity,
  MaterialSpecification,
  GemstoneSpecification,
  GemstoneCaratWeight,
  JewelrySpecification,
} from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('Stage 6: Jewelry & Gemstone Specification Invariants', () => {
  describe('Gold Purity & Material Semantics', () => {
    it('validates standard gold purities and millesimal fineness', () => {
      // 18K (750)
      const p18k = GoldPurity.K18;
      expect(p18k.fineness.toString()).toBe('750');
      expect(p18k.karat.toString()).toBe('18');
      expect(p18k.pureGoldFraction.toString()).toBe('0.75');

      // 24K (999.9)
      const p24k = GoldPurity.K24;
      expect(p24k.fineness.toString()).toBe('999.9');

      // Custom fineness
      const customPurity = GoldPurity.fromFineness('875').unwrap();
      expect(customPurity.karat.toString()).toBe('21');

      // Invalid fineness
      expect(GoldPurity.fromFineness('0').isErr).toBe(true);
      expect(GoldPurity.fromFineness('1001').isErr).toBe(true);
    });

    it('creates authoritative Gold MaterialSpecification and derives pure metal mass', () => {
      const purity = GoldPurity.K18; // 750 / 1000
      const totalWeight = Weight.fromGrams('10.000000').unwrap();

      const metal = MaterialSpecification.gold(purity, totalWeight).unwrap();
      expect(metal.materialType).toBe('GOLD');
      expect(metal.weight.grams.toString()).toBe('10');

      // Pure metal weight: 10g * 0.75 = 7.5g
      const pureWeight = metal.pureMetalWeight();
      expect(pureWeight.grams.toString()).toBe('7.5');
    });

    it('supports structural extension point for Platinum and Silver without fake pricing', () => {
      const platWeight = Weight.fromGrams('15.000000').unwrap();
      const platSpec = MaterialSpecification.preciousMetal('PLATINUM', '950', platWeight).unwrap();

      expect(platSpec.materialType).toBe('PLATINUM');
      expect(platSpec.purityFineness.toString()).toBe('950');
      // 15g * 0.95 = 14.25g pure platinum
      expect(platSpec.pureMetalWeight().grams.toString()).toBe('14.25');
    });
  });

  describe('Gemstone Semantics & Strict Carat Separation', () => {
    it('enforces GemstoneCaratWeight as dedicated carat unit with explicit physical conversion', () => {
      // 2.50 carats
      const caratRes = GemstoneCaratWeight.fromCarats('2.50');
      expect(caratRes.isOk).toBe(true);
      const caratWeight = caratRes.unwrap();
      expect(caratWeight.carats.toString()).toBe('2.5');

      // 1 carat = 0.200 grams -> 2.5 carats = 0.5 grams
      const physicalWeight = caratWeight.toPhysicalWeight();
      expect(physicalWeight.grams.toString()).toBe('0.5');

      // Negative carats rejected
      expect(GemstoneCaratWeight.fromCarats('-0.5').isErr).toBe(true);
    });

    it('creates GemstoneSpecification catalog metadata with 4Cs without valuation calculations', () => {
      const gemRes = GemstoneSpecification.create({
        gemstoneType: 'DIAMOND',
        carats: '1.25',
        count: 1,
        color: 'G',
        clarity: 'VS1',
        cut: 'ROUND_BRILLIANT',
        certificateNumber: 'GIA-2184920194',
        description: 'Natural round brilliant cut diamond',
      });

      expect(gemRes.isOk).toBe(true);
      const gem = gemRes.unwrap();
      expect(gem.gemstoneType).toBe('DIAMOND');
      expect(gem.caratWeight.carats.toString()).toBe('1.25');
      expect(gem.color).toBe('G');
      expect(gem.clarity).toBe('VS1');
      expect(gem.certificateNumber).toBe('GIA-2184920194');

      // Physical mass = 1.25 ct / 5 = 0.25 grams
      expect(gem.totalPhysicalWeight().grams.toString()).toBe('0.25');
    });

    it('strictly enforces physical weight invariants: grossWeight >= netGoldWeight + gemstoneMass', () => {
      const purity = GoldPurity.K18;
      const goldWeight = Weight.fromGrams('8.000000').unwrap();
      const metal = MaterialSpecification.gold(purity, goldWeight).unwrap();

      // Gemstone: 5 carats = 1.000000 gram
      const diamond = GemstoneSpecification.create({
        gemstoneType: 'DIAMOND',
        carats: '5.00',
        count: 1,
      }).unwrap();

      // Case 1: Gross weight (9.0g) is valid (= 8.0g gold + 1.0g diamond)
      const validGross = Weight.fromGrams('9.000000').unwrap();
      const validSpec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal,
        grossWeight: validGross,
        gemstones: [diamond],
      });
      expect(validSpec.isOk).toBe(true);

      // Case 2: Gross weight (8.5g) is less than combined gold (8.0g) + diamond (1.0g) = 9.0g
      const invalidGross = Weight.fromGrams('8.500000').unwrap();
      const invalidSpec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal,
        grossWeight: invalidGross,
        gemstones: [diamond],
      });
      expect(invalidSpec.isErr).toBe(true);
      expect(invalidSpec.unwrapOr(null as any)).toBeNull();

      // Case 3: Gross weight less than net gold weight alone (even without gemstones)
      const subGoldGross = Weight.fromGrams('7.900000').unwrap();
      const subGoldSpec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal,
        grossWeight: subGoldGross,
      });
      expect(subGoldSpec.isErr).toBe(true);
    });
  });
});
