import { describe, expect, it } from 'vitest';
import { FxRate } from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('Foreign Exchange (FX) Rate Value Object', () => {
  it('creates valid FxRate with explicit directional semantics', () => {
    const rateResult = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'IRR',
      rate: '600000.00000000',
      source: 'CBI_OFFICIAL',
    });

    expect(rateResult.isOk).toBe(true);
    if (!rateResult.isOk) return;

    const fx = rateResult.value;
    expect(fx.baseCurrency).toBe('USD');
    expect(fx.quoteCurrency).toBe('IRR');
    expect(fx.rate.toString()).toBe('600000');
    expect(fx.source).toBe('CBI_OFFICIAL');

    const dto = fx.toDto();
    expect(dto.direction).toBe('1 USD = 600000 IRR');
    expect(dto.baseCurrency).toBe('USD');
    expect(dto.quoteCurrency).toBe('IRR');
  });

  it('rejects identical base and quote currency', () => {
    const parity = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'USD',
      rate: '1.0',
      source: 'TEST',
    });

    expect(parity.isErr).toBe(true);
    if (parity.isErr) {
      expect(parity.error.message).toContain('cannot be identical');
    }
  });

  it('rejects zero or negative exchange rates', () => {
    const zeroRate = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rate: '0',
      source: 'TEST',
    });
    expect(zeroRate.isErr).toBe(true);

    const negativeRate = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rate: '-1.25',
      source: 'TEST',
    });
    expect(negativeRate.isErr).toBe(true);
  });

  it('rejects non-numeric and non-finite rates', () => {
    expect(FxRate.create({ baseCurrency: 'USD', quoteCurrency: 'EUR', rate: 'abc', source: 'TEST' }).isErr).toBe(true);
    expect(FxRate.create({ baseCurrency: 'USD', quoteCurrency: 'EUR', rate: 'NaN', source: 'TEST' }).isErr).toBe(true);
    expect(FxRate.create({ baseCurrency: 'USD', quoteCurrency: 'EUR', rate: 'Infinity', source: 'TEST' }).isErr).toBe(true);
  });

  it('deterministically inverts the exchange rate with arbitrary precision', () => {
    // 1 USD = 0.92 EUR
    const usdToEur = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rate: '0.92',
      source: 'ECB',
    }).unwrap();

    const eurToUsd = usdToEur.invert();

    expect(eurToUsd.baseCurrency).toBe('EUR');
    expect(eurToUsd.quoteCurrency).toBe('USD');
    expect(eurToUsd.source).toBe('ECB_INVERTED');

    // 1 / 0.92 = 1.0869565217391304347826086957...
    const expectedInverse = new Decimal(1).dividedBy(new Decimal('0.92'));
    expect(eurToUsd.rate.equals(expectedInverse)).toBe(true);

    // Double inversion returns original rate (1 / (1 / rate) === rate)
    const reinverted = eurToUsd.invert();
    expect(reinverted.rate.toDecimalPlaces(8).equals(new Decimal('0.92'))).toBe(true);
  });

  it('implements value object equality correctly', () => {
    const time = new Date('2026-09-23T12:00:00Z');

    const rate1 = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rate: '0.9200',
      observedAt: time,
      source: 'ECB',
    }).unwrap();

    const rate2 = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rate: '0.92',
      observedAt: time,
      source: 'ECB',
    }).unwrap();

    const differentSource = FxRate.create({
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rate: '0.92',
      observedAt: time,
      source: 'BLOOMBERG',
    }).unwrap();

    expect(rate1.equals(rate2)).toBe(true);
    expect(rate1.equals(differentSource)).toBe(false);
  });
});
