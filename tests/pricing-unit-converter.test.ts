import { describe, expect, it } from 'vitest';
import {
  PricingUnitConverter,
  MarketPrice,
} from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('PricingUnitConverter', () => {
  it('converts international Troy Ounce spot price to price per canonical gram', () => {
    // 2650.00 USD per Troy Ounce
    // 1 Troy Ounce = 31.1034768 g
    // Price per gram = 2650 / 31.1034768 = 85.2001192305886...
    const price = MarketPrice.create({
      amount: '2650.00',
      currency: 'USD',
      unit: 'TROY_OUNCE',
    }).unwrap();

    const result = PricingUnitConverter.getPricePerGram(price).unwrap();
    expect(result.marketUnit).toBe('TROY_OUNCE');
    expect(result.gramsPerUnit.toString()).toBe('31.1034768');

    const expected = new Decimal('2650.00').dividedBy('31.1034768');
    expect(result.pricePerGram.equals(expected)).toBe(true);
    expect(result.pricePerGram.toDecimalPlaces(4).toString()).toBe('85.1995');
  });

  it('converts Iranian Mesghal spot price to price per canonical gram', () => {
    // 54,000,000 IRR per Mesghal
    // 1 Mesghal = 4.6083 g
    const price = MarketPrice.create({
      amount: '54000000',
      currency: 'IRR',
      unit: 'MESGHAL',
    }).unwrap();

    const result = PricingUnitConverter.getPricePerGram(price).unwrap();
    expect(result.marketUnit).toBe('MESGHAL');
    expect(result.gramsPerUnit.toString()).toBe('4.6083');

    const expected = new Decimal('54000000').dividedBy('4.6083');
    expect(result.pricePerGram.equals(expected)).toBe(true);
    expect(result.pricePerGram.toDecimalPlaces(2).toString()).toBe('11717987.11');
  });

  it('returns exact amount when market unit is already GRAM', () => {
    const price = MarketPrice.create({
      amount: '85.50',
      currency: 'EUR',
      unit: 'GRAM',
    }).unwrap();

    const result = PricingUnitConverter.getPricePerGram(price).unwrap();
    expect(result.pricePerGram.toString()).toBe('85.5');
    expect(result.gramsPerUnit.toString()).toBe('1');
  });

  it('rejects discrete contract units that have no defined physical mass', () => {
    const price = MarketPrice.create({
      amount: '450000000',
      currency: 'IRR',
      unit: 'UNIT', // e.g. Emami Gold Coin discrete contract
    }).unwrap();

    const res = PricingUnitConverter.getPricePerGram(price);
    expect(res.isErr).toBe(true);
    if (res.isErr) {
      expect(res.error.code).toBe('UNSUPPORTED_MARKET_UNIT');
    }
  });
});
