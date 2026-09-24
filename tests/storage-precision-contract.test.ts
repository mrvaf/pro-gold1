import { describe, expect, it } from 'vitest';
import {
  FxRate,
  MarketPrice,
  MarketObservation,
  FinancialRoundingPolicy,
  STORAGE_PRECISION_LIMITS,
  createEntityId,
  type MarketObservationId,
  type MarketInstrumentId,
  type MarketDataSourceId,
} from '@v-gold/core';
import {
  toDatabaseFxRate,
  toDomainFxRate,
} from '../packages/database/src/repositories/drizzle-fx-rate.repository.js';
import {
  toDatabaseMarketObservation,
  toDomainMarketObservation,
} from '../packages/database/src/repositories/drizzle-market-observation.repository.js';
import { Decimal } from 'decimal.js';

describe('Storage Precision & Persistence Contract', () => {
  it('losslessly round-trips high-precision 16-decimal place FX rate through database mapping', () => {
    // Micro-currency rate: 1 Rial in USD = 0.0000016666666667 USD (16 decimal places)
    const rawRate = '0.0000016666666667';
    const fx = FxRate.create({
      baseCurrency: 'IRR',
      quoteCurrency: 'USD',
      rate: rawRate,
      source: 'CBI_INVERTED',
    }).unwrap();

    // Verify it fits storage scale
    expect(FinancialRoundingPolicy.fitsStorageScale(fx.rate, STORAGE_PRECISION_LIMITS.FX_RATE)).toBe(true);

    // Simulate database mapping (Domain -> DB Record -> Domain)
    const dbRecord = {
      id: 'fx_test_001',
      baseCurrency: fx.baseCurrency,
      quoteCurrency: fx.quoteCurrency,
      rate: fx.rate.toString(),
      observedAt: fx.observedAt,
      source: fx.source,
      createdAt: new Date(),
    };

    const restored = toDomainFxRate(dbRecord);

    // Assert exact equality with original domain value
    expect(restored.rate.toString()).toBe(rawRate);
    expect(restored.rate.equals(new Decimal(rawRate))).toBe(true);
    expect(restored.equals(fx)).toBe(true);
  });

  it('losslessly round-trips 8-decimal place commodity spot price through database mapping', () => {
    const rawAmount = '2650.12345678';
    const price = MarketPrice.create({
      amount: rawAmount,
      currency: 'USD',
      unit: 'TROY_OUNCE',
      bid: '2650.12345670',
      ask: '2650.12345680',
    }).unwrap();

    expect(FinancialRoundingPolicy.fitsStorageScale(price.amount, STORAGE_PRECISION_LIMITS.MARKET_PRICE)).toBe(true);

    const obs = MarketObservation.create({
      id: createEntityId<MarketObservationId>('obs_precision_contract'),
      instrumentId: createEntityId<MarketInstrumentId>('inst_xau_usd'),
      sourceId: createEntityId<MarketDataSourceId>('src_nasdaq'),
      price,
      quality: 'REAL_TIME',
      observedAt: new Date(),
    }).unwrap();

    const dbRecord = toDatabaseMarketObservation(obs);
    expect(dbRecord.amount).toBe(rawAmount);

    const restored = toDomainMarketObservation(dbRecord);
    expect(restored.price.amount.toString()).toBe(rawAmount);
    expect(restored.price.amount.equals(new Decimal(rawAmount))).toBe(true);
  });

  it('refuses silent truncation when a domain value exceeds database storage scale', () => {
    // 20 decimal places (e.g. from an unrounded division)
    const rawDivision = new Decimal('1').dividedBy(new Decimal('3')); // 0.33333333333333333333...

    const check = FinancialRoundingPolicy.assertStorageScale(
      rawDivision,
      STORAGE_PRECISION_LIMITS.MONEY_AMOUNT, // 4 decimal places
      'Invoice Balance'
    );

    expect(check.isErr).toBe(true);
    if (check.isErr) {
      expect(check.error.message).toContain('Precision overflow');
      expect(check.error.message).toContain('exceeding maximum database storage scale of 4');
    }

    // Explicit preparation before persistence prevents silent database truncation
    const prepared = FinancialRoundingPolicy.prepareForStorage(
      rawDivision,
      STORAGE_PRECISION_LIMITS.MONEY_AMOUNT,
      Decimal.ROUND_HALF_UP
    );
    expect(prepared.toString()).toBe('0.3333');
    expect(FinancialRoundingPolicy.fitsStorageScale(prepared, STORAGE_PRECISION_LIMITS.MONEY_AMOUNT)).toBe(true);
  });
});
