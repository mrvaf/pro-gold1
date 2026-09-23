import { describe, expect, it } from 'vitest';
import { Money, FxRate, CurrencyConverter } from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('Financial Precision Invariants & Mathematical Properties', () => {
  it('strictly satisfies commutative and associative laws under addition', () => {
    const a = Money.create('1234567.89123456', 'USD').unwrap();
    const b = Money.create('9876543.21987654', 'USD').unwrap();
    const c = Money.create('5555555.55555555', 'USD').unwrap();

    // Commutativity: A + B === B + A
    const aPlusB = a.add(b).unwrap();
    const bPlusA = b.add(a).unwrap();
    expect(aPlusB.equals(bPlusA)).toBe(true);

    // Associativity: (A + B) + C === A + (B + C)
    const leftAssoc = aPlusB.add(c).unwrap();
    const rightAssoc = a.add(b.add(c).unwrap()).unwrap();
    expect(leftAssoc.equals(rightAssoc)).toBe(true);
  });

  it('strictly satisfies distributive law under multiplication: A * (B + C) === A * B + A * C', () => {
    const m = Money.create('2500000', 'TOMAN').unwrap();
    const factorB = new Decimal('1.09'); // 9% tax or fee
    const factorC = new Decimal('0.07'); // 7% margin

    const distributed = m.multiply(factorB).unwrap().add(m.multiply(factorC).unwrap()).unwrap();
    const factored = m.multiply(factorB.plus(factorC)).unwrap();

    expect(distributed.equals(factored)).toBe(true);
  });

  it('eliminates IEEE-754 binary floating-point drift over 50,000 cumulative additions', () => {
    // Adding 0.1 fifty thousand times in IEEE-754 produces 5000.000000000007
    // In Decimal.js it must equal 5000 exactly
    const step = Money.create('0.1', 'USD').unwrap();
    let accumulated = Money.zero('USD');

    for (let i = 0; i < 50000; i++) {
      accumulated = accumulated.add(step).unwrap();
    }

    expect(accumulated.amount.toString()).toBe('5000');
    expect(accumulated.amount.equals(new Decimal(5000))).toBe(true);
  });

  it('bounds division and multiplication round-trip error within Decimal calculation precision epsilon', () => {
    // 100 / 3 * 3 has a repeating decimal in base 10 (33.333333333333333333...)
    // Decimal.js default precision is 20 digits, so 33.333333333333333333 * 3 = 99.999999999999999999
    // The error is strictly bounded by machine epsilon eps <= 10^-18, not an exact identity for repeating decimals
    const original = Money.create('100.00', 'EUR').unwrap();
    const third = original.divide('3').unwrap();
    const reconstructed = third.multiply('3').unwrap();

    const diff = original.amount.minus(reconstructed.amount).abs();
    expect(diff.lessThanOrEqualTo(new Decimal('1e-18'))).toBe(true);
  });

  it('demonstrates FX round-trip behavior: exact for terminating ratios, bounded for repeating decimals', () => {
    // Terminating ratio: USD/EUR = 0.8
    const mUsd = Money.create('100', 'USD').unwrap();
    const usdToEur = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rate: '0.8',
      source: 'TEST',
    }).unwrap();
    const eurToUsd = usdToEur.invert(); // 1 / 0.8 = 1.25 (exact terminating decimal)

    const convertedEur = CurrencyConverter.convert(mUsd, usdToEur).unwrap();
    const backToUsd = CurrencyConverter.convert(convertedEur, eurToUsd).unwrap();
    expect(backToUsd.amount.toString()).toBe('100');

    // Repeating ratio: USD/EUR = 0.9 (invert is 1 / 0.9 = 1.1111111111111111111...)
    const rateRepeating = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rate: '0.9',
      source: 'TEST',
    }).unwrap();
    const invRepeating = rateRepeating.invert();

    const convertedRep = CurrencyConverter.convert(mUsd, rateRepeating).unwrap();
    const roundTripRep = CurrencyConverter.convert(convertedRep, invRepeating).unwrap();

    // Round trip error bounded by Decimal calculation precision
    const errDelta = roundTripRep.amount.minus(mUsd.amount).abs();
    expect(errDelta.lessThanOrEqualTo(new Decimal('1e-18'))).toBe(true);
  });

  it('handles Iranian sovereign numbers (trillions of Rials) without overflow or scientific notation pollution', () => {
    // 10 Trillion Rials = 10,000,000,000,000 IRR
    const tenTrillionIrr = Money.create('10000000000000', 'IRR').unwrap();
    expect(tenTrillionIrr.amount.isFinite()).toBe(true);
    expect(tenTrillionIrr.amount.toString()).toBe('10000000000000');

    // Convert to Tomans (1 Trillion Tomans)
    const oneTrillionToman = CurrencyConverter.irrToToman(tenTrillionIrr).unwrap();
    expect(oneTrillionToman.amount.toString()).toBe('1000000000000');
    expect(oneTrillionToman.currency).toBe('TOMAN');
  });
});
