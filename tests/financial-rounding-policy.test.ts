import { describe, expect, it } from 'vitest';
import {
  FinancialRoundingPolicy,
  ROUNDING_MODES,
  STORAGE_PRECISION_LIMITS,
} from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('Financial Rounding Policy & Detailed Mode Semantics', () => {
  describe('ROUND_HALF_UP (Commercial Rounding)', () => {
    it('handles positive exact midpoints (.5 rounds away from zero)', () => {
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('1.25'), 1, ROUNDING_MODES.HALF_UP).toString()).toBe('1.3');
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('1.35'), 1, ROUNDING_MODES.HALF_UP).toString()).toBe('1.4');
    });

    it('handles positive non-midpoints', () => {
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('1.24'), 1, ROUNDING_MODES.HALF_UP).toString()).toBe('1.2');
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('1.26'), 1, ROUNDING_MODES.HALF_UP).toString()).toBe('1.3');
    });

    it('handles negative exact midpoints (rounds away from zero towards -infinity)', () => {
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('-1.25'), 1, ROUNDING_MODES.HALF_UP).toString()).toBe('-1.3');
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('-1.35'), 1, ROUNDING_MODES.HALF_UP).toString()).toBe('-1.4');
    });

    it('handles negative non-midpoints', () => {
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('-1.24'), 1, ROUNDING_MODES.HALF_UP).toString()).toBe('-1.2');
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('-1.26'), 1, ROUNDING_MODES.HALF_UP).toString()).toBe('-1.3');
    });

    it('handles zero and already-rounded values', () => {
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('0'), 2, ROUNDING_MODES.HALF_UP).toString()).toBe('0');
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('1.50'), 2, ROUNDING_MODES.HALF_UP).toString()).toBe('1.5');
    });
  });

  describe('ROUND_HALF_EVEN (Banker’s Rounding)', () => {
    it('rounds midpoint to nearest even digit for positive numbers', () => {
      // 1.25: 2 is even -> 1.2
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('1.25'), 1, ROUNDING_MODES.HALF_EVEN).toString()).toBe('1.2');
      // 1.35: 4 is even -> 1.4
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('1.35'), 1, ROUNDING_MODES.HALF_EVEN).toString()).toBe('1.4');
    });

    it('rounds midpoint to nearest even digit for negative numbers', () => {
      // -1.25: -2 is even -> -1.2
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('-1.25'), 1, ROUNDING_MODES.HALF_EVEN).toString()).toBe('-1.2');
      // -1.35: -4 is even -> -1.4
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('-1.35'), 1, ROUNDING_MODES.HALF_EVEN).toString()).toBe('-1.4');
    });
  });

  describe('ROUND_UP (Away from Zero) vs ROUND_CEIL (+Infinity)', () => {
    it('verifies ROUND_UP rounds away from zero for both positive and negative', () => {
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('1.21'), 1, ROUNDING_MODES.UP).toString()).toBe('1.3');
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('-1.21'), 1, ROUNDING_MODES.UP).toString()).toBe('-1.3');
    });

    it('verifies ROUND_CEIL rounds towards +infinity', () => {
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('1.21'), 1, ROUNDING_MODES.CEIL).toString()).toBe('1.3');
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('-1.21'), 1, ROUNDING_MODES.CEIL).toString()).toBe('-1.2');
    });
  });

  describe('ROUND_DOWN (Towards Zero / Truncation) vs ROUND_FLOOR (-Infinity)', () => {
    it('verifies ROUND_DOWN rounds towards zero for both positive and negative', () => {
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('1.29'), 1, ROUNDING_MODES.DOWN).toString()).toBe('1.2');
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('-1.29'), 1, ROUNDING_MODES.DOWN).toString()).toBe('-1.2');
    });

    it('verifies ROUND_FLOOR rounds towards -infinity', () => {
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('1.29'), 1, ROUNDING_MODES.FLOOR).toString()).toBe('1.2');
      expect(FinancialRoundingPolicy.roundDecimal(new Decimal('-1.29'), 1, ROUNDING_MODES.FLOOR).toString()).toBe('-1.3');
    });
  });

  describe('Currency-Specific Presentation Rounding', () => {
    it('rounds fiat amounts according to declared minor units', () => {
      expect(FinancialRoundingPolicy.roundForCurrency(new Decimal('150.256'), 'USD').toString()).toBe('150.26');
      expect(FinancialRoundingPolicy.roundForCurrency(new Decimal('99.994'), 'EUR').toString()).toBe('99.99');
      expect(FinancialRoundingPolicy.roundForCurrency(new Decimal('54250000.85'), 'IRR').toString()).toBe('54250001');
      expect(FinancialRoundingPolicy.roundForCurrency(new Decimal('5425000.49'), 'TOMAN').toString()).toBe('5425000');
    });
  });

  describe('Storage Precision Assertions & Silent Truncation Prevention', () => {
    it('validates scale boundaries against declared storage limits', () => {
      const validRate = new Decimal('0.0000016666666667'); // 16 decimal places
      expect(FinancialRoundingPolicy.fitsStorageScale(validRate, STORAGE_PRECISION_LIMITS.FX_RATE)).toBe(true);

      const excessiveRate = new Decimal('0.00000166666666667'); // 17 decimal places
      expect(FinancialRoundingPolicy.fitsStorageScale(excessiveRate, STORAGE_PRECISION_LIMITS.FX_RATE)).toBe(false);

      const checkResult = FinancialRoundingPolicy.assertStorageScale(excessiveRate, STORAGE_PRECISION_LIMITS.FX_RATE, 'FX Rate');
      expect(checkResult.isErr).toBe(true);
      if (checkResult.isErr) {
        expect(checkResult.error.message).toContain('Precision overflow');
      }
    });

    it('prepares values for storage using explicit rounding mode rather than silent truncation', () => {
      const rawRecurring = new Decimal('1').dividedBy(new Decimal('600000')); // 1.6666666666666666667e-6
      const prepared = FinancialRoundingPolicy.prepareForStorage(rawRecurring, STORAGE_PRECISION_LIMITS.FX_RATE, ROUNDING_MODES.HALF_UP);

      expect(prepared.decimalPlaces()).toBeLessThanOrEqual(16);
      expect(prepared.toString()).toBe('0.0000016666666667');
    });
  });
});
