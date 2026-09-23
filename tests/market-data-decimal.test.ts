import { describe, expect, it } from 'vitest';
import { MarketPrice } from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('Market Data Decimal Precision & Numeric Integrity', () => {
  it('parses high-precision 8-decimal place numbers without floating-point distortion', () => {
    const rawHighPrecision = '2650.12345678';
    const price = MarketPrice.create({
      amount: rawHighPrecision,
      currency: 'USD',
      unit: 'TROY_OUNCE',
      bid: '2650.12345670',
      ask: '2650.12345680',
    }).unwrap();

    expect(price.amount.toString()).toBe('2650.12345678');
    expect(price.bid?.toString()).toBe('2650.1234567');
    expect(price.ask?.toString()).toBe('2650.1234568');

    // Spread must be exact: 2650.12345680 - 2650.12345670 = 0.00000010
    expect(price.spread?.equals(new Decimal('0.0000001'))).toBe(true);
    expect(price.spread?.toFixed(7)).toBe('0.0000001');
    expect(price.amount.equals(new Decimal(rawHighPrecision))).toBe(true);
  });

  it('handles massive numeric values for high-denomination currencies (IRR) without overflow', () => {
    // Iranian Rial rate for 1 gram of gold can exceed 50,000,000 IRR
    const rawIrr = '54250000.00000000';
    const price = MarketPrice.create({
      amount: rawIrr,
      currency: 'IRR',
      unit: 'GRAM',
    }).unwrap();

    expect(price.amount.toString()).toBe('54250000');
    expect(price.amount.isFinite()).toBe(true);
    expect(price.amount.greaterThan(50000000)).toBe(true);
  });

  it('prevents classic IEEE-754 binary floating-point drift (0.1 + 0.2)', () => {
    // In IEEE-754: 0.1 + 0.2 === 0.30000000000000004
    // In Decimal.js: 0.1 + 0.2 === 0.3
    const p1 = MarketPrice.create({ amount: '0.1', currency: 'USD', unit: 'GRAM' }).unwrap();
    const p2 = MarketPrice.create({ amount: '0.2', currency: 'USD', unit: 'GRAM' }).unwrap();

    const sum = p1.amount.plus(p2.amount);
    expect(sum.toString()).toBe('0.3');
    expect(sum.equals(new Decimal('0.3'))).toBe(true);
  });

  it('preserves exact string representation when projected to DTO', () => {
    const raw = '2789.98765432';
    const price = MarketPrice.create({
      amount: raw,
      currency: 'EUR',
      unit: 'TROY_OUNCE',
    }).unwrap();

    const dto = price.toDto();
    expect(dto.amount).toBe(raw);
  });
});
