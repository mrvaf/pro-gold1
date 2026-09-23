import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { Money, CurrencyMismatchError, parseCurrencyCode } from '@v-gold/core';

describe('Money Value Object & Financial Precision', () => {
  it('creates valid Money instances across supported currencies', () => {
    const m1 = Money.create('15000000', 'IRR').unwrap();
    expect(m1.amount.toString()).toBe('15000000');
    expect(m1.currency).toBe('IRR');

    const m2 = Money.create('1250.50', 'USD').unwrap();
    expect(m2.amount.toString()).toBe('1250.5');
    expect(m2.currency).toBe('USD');

    const m3 = Money.zero('TOMAN');
    expect(m3.isZero()).toBe(true);
    expect(m3.amount.toString()).toBe('0');
  });

  it('rejects invalid, non-numeric, or non-finite monetary values', () => {
    const invalidInputs = ['abc', '12.34.56', 'NaN', 'Infinity', '-Infinity'];
    for (const input of invalidInputs) {
      const result = Money.create(input, 'IRR');
      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    }
  });

  it('enforces strict currency parity on addition and subtraction', () => {
    const usd = Money.create('100.00', 'USD').unwrap();
    const irr = Money.create('60000000', 'IRR').unwrap();

    const addResult = usd.add(irr);
    expect(addResult.isErr).toBe(true);
    if (addResult.isErr) {
      expect(addResult.error).toBeInstanceOf(CurrencyMismatchError);
      expect(addResult.error.code).toBe('CURRENCY_MISMATCH');
    }

    const subResult = usd.subtract(irr);
    expect(subResult.isErr).toBe(true);
    if (subResult.isErr) {
      expect(subResult.error).toBeInstanceOf(CurrencyMismatchError);
    }
  });

  it('performs exact addition and subtraction without floating-point errors', () => {
    // Classic IEEE 754 precision failure: 0.1 + 0.2 !== 0.3
    const m1 = Money.create('0.1', 'USD').unwrap();
    const m2 = Money.create('0.2', 'USD').unwrap();
    const sum = m1.add(m2).unwrap();

    expect(sum.amount.toString()).toBe('0.3');
    expect(sum.amount.equals(new Decimal('0.3'))).toBe(true);

    const diff = sum.subtract(m1).unwrap();
    expect(diff.amount.toString()).toBe('0.2');
  });

  it('performs exact multiplication and division', () => {
    const price = Money.create('4500000', 'TOMAN').unwrap();
    const doubled = price.multiply('2').unwrap();
    expect(doubled.amount.toString()).toBe('9000000');

    const halved = doubled.divide('2').unwrap();
    expect(halved.amount.toString()).toBe('4500000');
  });

  it('rejects division by zero and invalid factors', () => {
    const price = Money.create('1000', 'USD').unwrap();
    const divZero = price.divide('0');
    expect(divZero.isErr).toBe(true);
    if (divZero.isErr) {
      expect(divZero.error.code).toBe('UNPROCESSABLE_ENTITY');
    }

    const mulInvalid = price.multiply('not-a-number');
    expect(mulInvalid.isErr).toBe(true);
    if (mulInvalid.isErr) {
      expect(mulInvalid.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('requires explicit deterministic rounding and prevents silent rounding', () => {
    const raw = Money.create('123.456789', 'USD').unwrap();

    // Raw stays exact
    expect(raw.amount.toString()).toBe('123.456789');

    // Explicit rounding to 2 decimal places (ROUND_HALF_UP)
    const rounded2 = raw.round(2);
    expect(rounded2.amount.toString()).toBe('123.46');

    // Explicit rounding to minor units (USD has 2 minor units)
    const standardUsd = raw.roundToStandardMinorUnits();
    expect(standardUsd.amount.toString()).toBe('123.46');

    // IRR has 0 minor units
    const rawIrr = Money.create('54321.75', 'IRR').unwrap();
    const standardIrr = rawIrr.roundToStandardMinorUnits();
    expect(standardIrr.amount.toString()).toBe('54322');
  });

  it('determines equality and comparison strictly within the same currency', () => {
    const a = Money.create('100.50', 'USD').unwrap();
    const b = Money.create('100.50', 'USD').unwrap();
    const c = Money.create('200.00', 'USD').unwrap();

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);

    expect(a.compare(c).unwrap()).toBe(-1);
    expect(c.compare(a).unwrap()).toBe(1);
    expect(a.compare(b).unwrap()).toBe(0);

    const eur = Money.create('100.50', 'EUR').unwrap();
    expect(a.equals(eur)).toBe(false);
    expect(a.compare(eur).isErr).toBe(true);
  });

  it('handles very large and very small monetary amounts with high precision', () => {
    // 100 Billion Tomans
    const huge = Money.create('100000000000.000000000001', 'TOMAN').unwrap();
    expect(huge.amount.toString()).toBe('100000000000.000000000001');

    // Fractional cent
    const micro = Money.create('0.00000001', 'USD').unwrap();
    const multiplied = micro.multiply('100000000').unwrap();
    expect(multiplied.amount.toString()).toBe('1');
  });

  it('validates supported currencies via parser', () => {
    expect(parseCurrencyCode('irr').unwrap()).toBe('IRR');
    expect(parseCurrencyCode('Toman').unwrap()).toBe('TOMAN');
    expect(parseCurrencyCode('USD').unwrap()).toBe('USD');
    expect(parseCurrencyCode('eur').unwrap()).toBe('EUR');
    expect(parseCurrencyCode('GBP').isErr).toBe(true);
  });
});
