import { describe, expect, it } from 'vitest';
import { MarketPrice } from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('MarketPrice Value Object', () => {
  it('creates valid market prices with Decimal.js values', () => {
    const priceResult = MarketPrice.create({
      amount: '2650.75000000',
      currency: 'USD',
      unit: 'TROY_OUNCE',
      bid: '2650.50000000',
      ask: '2651.00000000',
    });

    expect(priceResult.isOk).toBe(true);
    if (!priceResult.isOk) return;

    const price = priceResult.value;
    expect(price.amount.equals(new Decimal('2650.75'))).toBe(true);
    expect(price.currency).toBe('USD');
    expect(price.unit).toBe('TROY_OUNCE');
    expect(price.bid?.toString()).toBe('2650.5');
    expect(price.ask?.toString()).toBe('2651');
    expect(price.spread?.toString()).toBe('0.5');
    expect(price.toString()).toBe('2650.75 USD / TROY_OUNCE');
  });

  it('rejects negative prices', () => {
    const negative = MarketPrice.create({
      amount: '-10.5',
      currency: 'USD',
      unit: 'TROY_OUNCE',
    });
    expect(negative.isErr).toBe(true);
    if (negative.isErr) {
      expect(negative.error.message).toContain('cannot be negative');
    }
  });

  it('rejects empty or malformed numeric inputs', () => {
    const empty = MarketPrice.create({
      amount: '   ',
      currency: 'USD',
      unit: 'TROY_OUNCE',
    });
    expect(empty.isErr).toBe(true);

    const nonNumeric = MarketPrice.create({
      amount: 'not_a_number',
      currency: 'USD',
      unit: 'TROY_OUNCE',
    });
    expect(nonNumeric.isErr).toBe(true);

    const infinity = MarketPrice.create({
      amount: 'Infinity',
      currency: 'USD',
      unit: 'TROY_OUNCE',
    });
    expect(infinity.isErr).toBe(true);
  });

  it('rejects bid greater than ask', () => {
    const invalidSpread = MarketPrice.create({
      amount: '2650.0',
      currency: 'USD',
      unit: 'TROY_OUNCE',
      bid: '2655.0',
      ask: '2650.0',
    });
    expect(invalidSpread.isErr).toBe(true);
    if (invalidSpread.isErr) {
      expect(invalidSpread.error.message).toContain('cannot exceed ask');
    }
  });

  it('implements value object equality correctly', () => {
    const price1 = MarketPrice.create({
      amount: '2650.50',
      currency: 'USD',
      unit: 'TROY_OUNCE',
      bid: '2650.00',
      ask: '2651.00',
    }).unwrap();

    const price2 = MarketPrice.create({
      amount: '2650.500000',
      currency: 'USD',
      unit: 'TROY_OUNCE',
      bid: '2650.00',
      ask: '2651.00',
    }).unwrap();

    const differentCurrency = MarketPrice.create({
      amount: '2650.50',
      currency: 'EUR',
      unit: 'TROY_OUNCE',
      bid: '2650.00',
      ask: '2651.00',
    }).unwrap();

    expect(price1.equals(price2)).toBe(true);
    expect(price1.equals(differentCurrency)).toBe(false);
  });
});
