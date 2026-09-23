import { describe, expect, it } from 'vitest';
import {
  FinancialRoundingPolicy,
  ROUNDING_MODES,
  Money,
} from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('Financial Rounding Policy & Modes', () => {
  it('implements standard commercial rounding (ROUND_HALF_UP)', () => {
    // 2.5 -> 3, 2.4 -> 2, 2.6 -> 3
    const d1 = new Decimal('2.55');
    const d2 = new Decimal('2.54');

    expect(FinancialRoundingPolicy.roundDecimal(d1, 1, ROUNDING_MODES.HALF_UP).toString()).toBe('2.6');
    expect(FinancialRoundingPolicy.roundDecimal(d2, 1, ROUNDING_MODES.HALF_UP).toString()).toBe('2.5');
  });

  it('implements banker’s rounding (ROUND_HALF_EVEN) to minimize statistical accumulation bias', () => {
    // In HALF_EVEN:
    // 2.5 rounds to nearest even -> 2
    // 3.5 rounds to nearest even -> 4
    const d1 = new Decimal('2.5');
    const d2 = new Decimal('3.5');

    expect(FinancialRoundingPolicy.roundDecimal(d1, 0, ROUNDING_MODES.HALF_EVEN).toString()).toBe('2');
    expect(FinancialRoundingPolicy.roundDecimal(d2, 0, ROUNDING_MODES.HALF_EVEN).toString()).toBe('4');
  });

  it('implements ceiling (ROUND_UP) and floor/truncation (ROUND_DOWN)', () => {
    const val = new Decimal('10.21');

    expect(FinancialRoundingPolicy.roundDecimal(val, 1, ROUNDING_MODES.UP).toString()).toBe('10.3');
    expect(FinancialRoundingPolicy.roundDecimal(val, 1, ROUNDING_MODES.DOWN).toString()).toBe('10.2');
  });

  it('rounds amounts based on currency presentation policy', () => {
    // USD: 2 decimals
    const usdAmount = new Decimal('150.256');
    expect(FinancialRoundingPolicy.roundForCurrency(usdAmount, 'USD').toString()).toBe('150.26');

    // EUR: 2 decimals
    const eurAmount = new Decimal('99.994');
    expect(FinancialRoundingPolicy.roundForCurrency(eurAmount, 'EUR').toString()).toBe('99.99');

    // IRR: 0 decimals
    const irrAmount = new Decimal('54250000.85');
    expect(FinancialRoundingPolicy.roundForCurrency(irrAmount, 'IRR').toString()).toBe('54250001');

    // TOMAN: 0 decimals
    const tomanAmount = new Decimal('5425000.49');
    expect(FinancialRoundingPolicy.roundForCurrency(tomanAmount, 'TOMAN').toString()).toBe('5425000');
  });

  it('asserts storage scale limits without silent truncation', () => {
    const fits8 = new Decimal('123.12345678');
    const exceeds8 = new Decimal('123.123456789');

    expect(FinancialRoundingPolicy.fitsStorageScale(fits8)).toBe(true);
    expect(FinancialRoundingPolicy.fitsStorageScale(exceeds8)).toBe(false);
  });

  it('rejects invalid decimal places (negative or non-integer)', () => {
    expect(() => FinancialRoundingPolicy.roundDecimal(new Decimal(10), -1)).toThrow();
    expect(() => FinancialRoundingPolicy.roundDecimal(new Decimal(10), 1.5)).toThrow();
  });
});
