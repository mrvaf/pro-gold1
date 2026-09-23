import { describe, expect, it } from 'vitest';
import {
  Money,
  FxRate,
  CurrencyConverter,
} from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('CurrencyConverter Domain Service', () => {
  it('converts Money using an authoritative FxRate without premature rounding', () => {
    // 100 USD at 0.9255 EUR per USD
    const usdMoney = Money.create('100.00', 'USD').unwrap();
    const fxRate = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rate: '0.9255',
      source: 'ECB',
    }).unwrap();

    const eurResult = CurrencyConverter.convert(usdMoney, fxRate);
    expect(eurResult.isOk).toBe(true);
    if (!eurResult.isOk) return;

    const eur = eurResult.value;
    expect(eur.currency).toBe('EUR');
    expect(eur.amount.toString()).toBe('92.55');

    // High-precision fractional amount
    const preciseUsd = Money.create('33.33333333', 'USD').unwrap();
    const preciseEur = CurrencyConverter.convert(preciseUsd, fxRate).unwrap();
    expect(preciseEur.amount.equals(new Decimal('33.33333333').times(new Decimal('0.9255')))).toBe(true);
  });

  it('rejects conversion when Money currency does not match FxRate base currency', () => {
    const irrMoney = Money.create('60000000', 'IRR').unwrap();
    const fxRate = FxRate.create({
      baseCurrency: 'USD', // Expects USD!
      quoteCurrency: 'EUR',
      rate: '0.92',
      source: 'ECB',
    }).unwrap();

    const result = CurrencyConverter.convert(irrMoney, fxRate);
    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error.code).toBe('BASE_CURRENCY_MISMATCH');
    }
  });

  it('converts Toman to Rial deterministically (10x)', () => {
    const toman = Money.create('5000000', 'TOMAN').unwrap();
    const rialResult = CurrencyConverter.tomanToIrr(toman);

    expect(rialResult.isOk).toBe(true);
    if (!rialResult.isOk) return;

    expect(rialResult.value.currency).toBe('IRR');
    expect(rialResult.value.amount.toString()).toBe('50000000');
  });

  it('converts Rial to Toman deterministically (0.1x)', () => {
    const rial = Money.create('50000000', 'IRR').unwrap();
    const tomanResult = CurrencyConverter.irrToToman(rial);

    expect(tomanResult.isOk).toBe(true);
    if (!tomanResult.isOk) return;

    expect(tomanResult.value.currency).toBe('TOMAN');
    expect(tomanResult.value.amount.toString()).toBe('5000000');
  });

  it('rejects invalid source currency for Toman/Rial conversions', () => {
    const usd = Money.create('100', 'USD').unwrap();
    expect(CurrencyConverter.tomanToIrr(usd).isErr).toBe(true);
    expect(CurrencyConverter.irrToToman(usd).isErr).toBe(true);
  });

  it('preserves round-trip precision across rate inversion: convert(convert(M, A->B), B->A)', () => {
    const original = Money.create('1234.5678', 'USD').unwrap();
    const rateUsdToEur = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rate: '0.91845231',
      source: 'ECB',
    }).unwrap();

    const rateEurToUsd = rateUsdToEur.invert();

    // 1. Convert USD -> EUR
    const inEur = CurrencyConverter.convert(original, rateUsdToEur).unwrap();

    // 2. Convert EUR -> USD
    const backToUsd = CurrencyConverter.convert(inEur, rateEurToUsd).unwrap();

    // The round-trip difference must be infinitesimal (< 10^-12)
    const difference = backToUsd.amount.minus(original.amount).abs();
    expect(difference.lessThan(new Decimal('1e-12'))).toBe(true);
  });
});
