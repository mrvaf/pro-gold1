import { describe, expect, it } from 'vitest';
import { GoldPurity } from '@v-gold/core';

describe('GoldPurity Value Object', () => {
  it('instantiates standard industry gold purities', () => {
    expect(GoldPurity.K24.karat.toString()).toBe('24');
    expect(GoldPurity.K24.fineness.toString()).toBe('999.9');

    expect(GoldPurity.K18.karat.toString()).toBe('18');
    expect(GoldPurity.K18.fineness.toString()).toBe('750');

    expect(GoldPurity.K21.karat.toString()).toBe('21');
    expect(GoldPurity.K21.fineness.toString()).toBe('875');

    expect(GoldPurity.K14.karat.toString()).toBe('14');
    expect(GoldPurity.K14.fineness.toString()).toBe('585');
  });

  it('calculates the pure gold fraction accurately', () => {
    // 18K (750/1000) = 0.75
    expect(GoldPurity.K18.pureGoldFraction.toString()).toBe('0.75');

    // 21K (875/1000) = 0.875
    expect(GoldPurity.K21.pureGoldFraction.toString()).toBe('0.875');

    // 24K (999.9/1000) = 0.9999
    expect(GoldPurity.K24.pureGoldFraction.toString()).toBe('0.9999');
  });

  it('creates custom valid purity from fineness', () => {
    const custom = GoldPurity.fromFineness('916.6').unwrap();
    expect(custom.fineness.toString()).toBe('916.6');
    // Karat equivalent should be approx 22K (916.6 / 1000 * 24 = 21.9984)
    expect(custom.karat.toDecimalPlaces(1).toString()).toBe('22');
  });

  it('creates custom valid purity from karat', () => {
    const k10 = GoldPurity.fromKarat('10').unwrap();
    expect(k10.karat.toString()).toBe('10');
    // Fineness: 10/24 * 1000 = 416.666...
    expect(k10.fineness.toDecimalPlaces(1).toString()).toBe('416.7');
  });

  it('rejects invalid fineness values outside (0, 1000]', () => {
    expect(GoldPurity.fromFineness('0').isErr).toBe(true);
    expect(GoldPurity.fromFineness('-10').isErr).toBe(true);
    expect(GoldPurity.fromFineness('1000.1').isErr).toBe(true);
    expect(GoldPurity.fromFineness('invalid').isErr).toBe(true);
  });

  it('rejects invalid karat values outside (0, 24]', () => {
    expect(GoldPurity.fromKarat('0').isErr).toBe(true);
    expect(GoldPurity.fromKarat('-5').isErr).toBe(true);
    expect(GoldPurity.fromKarat('24.1').isErr).toBe(true);
    expect(GoldPurity.fromKarat('30').isErr).toBe(true);
    expect(GoldPurity.fromKarat('abc').isErr).toBe(true);
  });

  it('enforces value object equality based on fineness', () => {
    const p1 = GoldPurity.fromFineness('750').unwrap();
    const p2 = GoldPurity.fromKarat('18').unwrap();
    const p3 = GoldPurity.fromFineness('875').unwrap();

    expect(p1.equals(p2)).toBe(true);
    expect(p1.equals(p3)).toBe(false);
  });

  it('maps 22K to the ISO 9202 millesimal mark 916 (Stage 8.2, ADR-0045)', () => {
    // Standard definition table and preset both use 916 (aligned with 585/14K style marks).
    expect(GoldPurity.K22.fineness.toString()).toBe('916');
    expect(GoldPurity.K22.karat.toString()).toBe('22');
    expect(GoldPurity.K22.pureGoldFraction.toString()).toBe('0.916');

    // fromKarat applies the same canonical mark (previously 916.6 / 916.666...).
    const fromKarat22 = GoldPurity.fromKarat('22').unwrap();
    expect(fromKarat22.fineness.toString()).toBe('916');
    expect(fromKarat22.equals(GoldPurity.K22)).toBe(true);

    // Pricing effect (documented in ADR-0045): a 10g 22K piece now carries
    // 9.160g of pure gold instead of 9.166g (-0.0655% gold content).
    const tenGrams22K = GoldPurity.K22.pureGoldFraction.times(10);
    expect(tenGrams22K.toString()).toBe('9.16');
  });
});
