import { describe, expect, it } from 'vitest';
import { fxRatesTable } from '@v-gold/database';

describe('Foreign Exchange Database Schema (fxRatesTable)', () => {
  it('validates fxRatesTable schema definition and precision', () => {
    expect(fxRatesTable.id).toBeDefined();
    expect(fxRatesTable.baseCurrency).toBeDefined();
    expect(fxRatesTable.quoteCurrency).toBeDefined();
    expect(fxRatesTable.rate).toBeDefined();
    expect(fxRatesTable.observedAt).toBeDefined();
    expect(fxRatesTable.source).toBeDefined();
    expect(fxRatesTable.createdAt).toBeDefined();

    // Verify rate column data type is numeric string for Decimal.js
    expect(fxRatesTable.rate.dataType).toBe('string');
  });
});
