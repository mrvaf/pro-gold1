import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { Weight } from '@v-gold/core';

describe('Weight Value Object & Precious Metal Mass', () => {
  it('creates weight in canonical unit (grams)', () => {
    const w = Weight.fromGrams('12.450').unwrap();
    expect(w.grams.toString()).toBe('12.45');
    expect(w.isZero()).toBe(false);

    const zero = Weight.zero();
    expect(zero.isZero()).toBe(true);
    expect(zero.grams.toString()).toBe('0');
  });

  it('rejects negative or invalid weight inputs', () => {
    expect(Weight.fromGrams('-1').isErr).toBe(true);
    expect(Weight.fromGrams('abc').isErr).toBe(true);
    expect(Weight.fromGrams('NaN').isErr).toBe(true);
    expect(Weight.fromGrams('Infinity').isErr).toBe(true);
  });

  it('accurately converts to and from milligrams', () => {
    // 500 mg = 0.5 g
    const fromMg = Weight.fromMilligrams('500').unwrap();
    expect(fromMg.grams.toString()).toBe('0.5');
    expect(fromMg.toMilligrams().toString()).toBe('500');
  });

  it('accurately converts to and from Iranian Mesghals (4.6083g)', () => {
    // 1 mesghal = 4.6083 grams
    const oneMesghal = Weight.fromMesghal('1').unwrap();
    expect(oneMesghal.grams.toString()).toBe('4.6083');
    expect(oneMesghal.toMesghal().toDecimalPlaces(4).toString()).toBe('1');

    // 2 mesghals = 9.2166 grams
    const twoMesghal = Weight.fromMesghal('2').unwrap();
    expect(twoMesghal.grams.toString()).toBe('9.2166');
  });

  it('accurately converts to and from gemstone carats (0.2g)', () => {
    // 1 carat = 0.2g
    const oneCarat = Weight.fromCarats('1').unwrap();
    expect(oneCarat.grams.toString()).toBe('0.2');
    expect(oneCarat.toCarats().toString()).toBe('1');

    // 5 carats = 1 gram
    const fiveCarats = Weight.fromCarats('5').unwrap();
    expect(fiveCarats.grams.toString()).toBe('1');
  });

  it('accurately converts to troy ounces (31.1034768g)', () => {
    const oneOz = Weight.fromGrams('31.1034768').unwrap();
    expect(oneOz.toTroyOunces().toDecimalPlaces(4).toString()).toBe('1');
  });

  it('performs safe weight arithmetic', () => {
    const w1 = Weight.fromGrams('5.250').unwrap();
    const w2 = Weight.fromGrams('2.750').unwrap();

    const sum = w1.add(w2);
    expect(sum.grams.toString()).toBe('8');

    const diff = w1.subtract(w2).unwrap();
    expect(diff.grams.toString()).toBe('2.5');

    // Subtraction that would result in negative weight is rejected
    const negativeDiff = w2.subtract(w1);
    expect(negativeDiff.isErr).toBe(true);
    if (negativeDiff.isErr) {
      expect(negativeDiff.error.code).toBe('UNPROCESSABLE_ENTITY');
    }

    const scaled = w1.multiply('3').unwrap();
    expect(scaled.grams.toString()).toBe('15.75');

    // Negative multiplier is rejected
    expect(w1.multiply('-1').isErr).toBe(true);
  });

  it('compares weights deterministically', () => {
    const small = Weight.fromGrams('1.5').unwrap();
    const large = Weight.fromGrams('10.0').unwrap();
    const equalSmall = Weight.fromGrams('1.5').unwrap();

    expect(small.compare(large)).toBe(-1);
    expect(large.compare(small)).toBe(1);
    expect(small.compare(equalSmall)).toBe(0);
    expect(small.equals(equalSmall)).toBe(true);
  });

  it('explicitly rounds weight without silent rounding', () => {
    const raw = Weight.fromGrams('12.345678').unwrap();
    expect(raw.grams.toString()).toBe('12.345678');

    // Round to 3 decimal places (milligram precision in grams)
    const rounded = raw.round(3, Decimal.ROUND_HALF_UP);
    expect(rounded.grams.toString()).toBe('12.346');
  });
});
