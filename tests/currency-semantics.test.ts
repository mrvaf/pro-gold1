import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_METADATA,
  IRR_PER_TOMAN,
  TOMAN_PER_IRR,
  parseCurrencyCode,
  tomanToIrrAmount,
  irrToTomanAmount,
} from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('Currency Semantics & Canonical Metadata', () => {
  it('supports canonical currencies: IRR, TOMAN, USD, EUR', () => {
    expect(SUPPORTED_CURRENCIES).toContain('IRR');
    expect(SUPPORTED_CURRENCIES).toContain('TOMAN');
    expect(SUPPORTED_CURRENCIES).toContain('USD');
    expect(SUPPORTED_CURRENCIES).toContain('EUR');
    expect(SUPPORTED_CURRENCIES.length).toBe(4);
  });

  it('validates currency metadata invariants', () => {
    // Iranian Rial: Statutory accounting currency, 0 minor units
    const irr = CURRENCY_METADATA.IRR;
    expect(irr.code).toBe('IRR');
    expect(irr.standardMinorUnits).toBe(0);
    expect(irr.isAccountingCurrency).toBe(true);
    expect(irr.category).toBe('FIAT');

    // Iranian Toman: Commercial unit of account, 0 minor units
    const toman = CURRENCY_METADATA.TOMAN;
    expect(toman.code).toBe('TOMAN');
    expect(toman.standardMinorUnits).toBe(0);
    expect(toman.isAccountingCurrency).toBe(false);
    expect(toman.category).toBe('FIAT');

    // USD: 2 minor units (cents)
    const usd = CURRENCY_METADATA.USD;
    expect(usd.code).toBe('USD');
    expect(usd.standardMinorUnits).toBe(2);
    expect(usd.isAccountingCurrency).toBe(true);

    // EUR: 2 minor units (cents)
    const eur = CURRENCY_METADATA.EUR;
    expect(eur.code).toBe('EUR');
    expect(eur.standardMinorUnits).toBe(2);
    expect(eur.isAccountingCurrency).toBe(true);
  });

  it('enforces exact 1:10 relationship between Toman and Rial', () => {
    expect(IRR_PER_TOMAN.equals(new Decimal(10))).toBe(true);
    expect(TOMAN_PER_IRR.equals(new Decimal('0.1'))).toBe(true);

    // 1 Toman = 10 Rials
    const toman1 = new Decimal(1);
    expect(tomanToIrrAmount(toman1).equals(new Decimal(10))).toBe(true);

    // 10 Rials = 1 Toman
    const rial10 = new Decimal(10);
    expect(irrToTomanAmount(rial10).equals(new Decimal(1))).toBe(true);

    // 50,000,000 Tomans = 500,000,000 Rials
    const fiftyMillion = new Decimal(50000000);
    expect(tomanToIrrAmount(fiftyMillion).equals(new Decimal(500000000))).toBe(true);
    expect(irrToTomanAmount(new Decimal(500000000)).equals(fiftyMillion)).toBe(true);
  });

  it('rejects unsupported currency strings', () => {
    expect(parseCurrencyCode('GBP').isErr).toBe(true);
    expect(parseCurrencyCode('BTC').isErr).toBe(true);
    expect(parseCurrencyCode('').isErr).toBe(true);
  });

  it('normalizes case-insensitive valid currency strings', () => {
    expect(parseCurrencyCode('irr').unwrap()).toBe('IRR');
    expect(parseCurrencyCode('Toman').unwrap()).toBe('TOMAN');
    expect(parseCurrencyCode(' usd ').unwrap()).toBe('USD');
    expect(parseCurrencyCode('EUR').unwrap()).toBe('EUR');
  });
});
