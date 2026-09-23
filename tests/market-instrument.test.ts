import { describe, expect, it } from 'vitest';
import {
  MarketInstrument,
  createMarketInstrumentId,
  MARKET_UNITS,
  MARKET_UNIT_METADATA,
} from '@v-gold/core';

describe('MarketInstrument Domain Model', () => {
  it('creates valid precious metal instruments with explicit attributes', () => {
    const goldUsd = MarketInstrument.create({
      id: 'inst_xau_usd',
      symbol: 'XAU/USD',
      baseAsset: 'XAU',
      quoteCurrency: 'USD',
      unit: 'TROY_OUNCE',
      displayName: 'Gold Spot (USD per Troy Ounce)',
      assetType: 'PRECIOUS_METAL',
    });

    expect(goldUsd.isOk).toBe(true);
    if (!goldUsd.isOk) return;

    expect(goldUsd.value.id).toBe('inst_xau_usd');
    expect(goldUsd.value.symbol).toBe('XAU/USD');
    expect(goldUsd.value.baseAsset).toBe('XAU');
    expect(goldUsd.value.quoteCurrency).toBe('USD');
    expect(goldUsd.value.unit).toBe('TROY_OUNCE');
    expect(goldUsd.value.displayName).toBe('Gold Spot (USD per Troy Ounce)');
    expect(goldUsd.value.isActive).toBe(true);

    const goldIrr = MarketInstrument.create({
      id: 'inst_xau_irr',
      symbol: 'XAU/IRR',
      baseAsset: 'XAU',
      quoteCurrency: 'IRR',
      unit: 'GRAM',
      displayName: 'Gold 24K (IRR per Gram)',
    });
    expect(goldIrr.isOk).toBe(true);
    if (!goldIrr.isOk) return;
    expect(goldIrr.value.quoteCurrency).toBe('IRR');
    expect(goldIrr.value.unit).toBe('GRAM');
  });

  it('rejects empty or invalid symbols', () => {
    const emptySymbol = MarketInstrument.create({
      id: 'inst_invalid',
      symbol: '',
      baseAsset: 'XAU',
      quoteCurrency: 'USD',
      unit: 'TROY_OUNCE',
      displayName: 'Invalid',
    });
    expect(emptySymbol.isErr).toBe(true);
    if (emptySymbol.isErr) {
      expect(emptySymbol.error.message).toContain('symbol');
    }
  });

  it('rejects unsupported currency codes', () => {
    const invalidCurrency = MarketInstrument.create({
      id: 'inst_invalid_curr',
      symbol: 'XAU/GBP',
      baseAsset: 'XAU',
      quoteCurrency: 'GBP', // Currently unsupported
      unit: 'TROY_OUNCE',
      displayName: 'Gold GBP',
    });
    expect(invalidCurrency.isErr).toBe(true);
    if (invalidCurrency.isErr) {
      expect(invalidCurrency.error.message).toContain('Unsupported currency code');
    }
  });

  it('rejects unsupported market units', () => {
    const invalidUnit = MarketInstrument.create({
      id: 'inst_invalid_unit',
      symbol: 'XAU/USD',
      baseAsset: 'XAU',
      quoteCurrency: 'USD',
      unit: 'POUND', // Not a supported market unit
      displayName: 'Gold Pound',
    });
    expect(invalidUnit.isErr).toBe(true);
    if (invalidUnit.isErr) {
      expect(invalidUnit.error.message).toContain('Unsupported market unit');
    }
  });

  it('allows activating and deactivating instruments', () => {
    const instrument = MarketInstrument.create({
      id: 'inst_test',
      symbol: 'XAU/EUR',
      baseAsset: 'XAU',
      quoteCurrency: 'EUR',
      unit: 'TROY_OUNCE',
      displayName: 'Gold Spot EUR',
    }).unwrap();

    expect(instrument.isActive).toBe(true);
    instrument.deactivate();
    expect(instrument.isActive).toBe(false);
    instrument.activate();
    expect(instrument.isActive).toBe(true);
  });

  it('supports matching by symbol or ID case-insensitively', () => {
    const instrument = MarketInstrument.create({
      id: 'inst_xau_usd',
      symbol: 'XAU/USD',
      baseAsset: 'XAU',
      quoteCurrency: 'USD',
      unit: 'TROY_OUNCE',
      displayName: 'Gold Spot USD',
    }).unwrap();

    expect(instrument.matches('XAU/USD')).toBe(true);
    expect(instrument.matches('xau/usd')).toBe(true);
    expect(instrument.matches('inst_xau_usd')).toBe(true);
    expect(instrument.matches('INST_XAU_USD')).toBe(true);
    expect(instrument.matches('XAG/USD')).toBe(false);
  });

  it('verifies market units and conversion factors', () => {
    expect(MARKET_UNITS).toContain('TROY_OUNCE');
    expect(MARKET_UNITS).toContain('GRAM');
    expect(MARKET_UNITS).toContain('MESGHAL');

    expect(MARKET_UNIT_METADATA.TROY_OUNCE.gramsPerUnit?.toString()).toBe('31.1034768');
    expect(MARKET_UNIT_METADATA.MESGHAL.gramsPerUnit?.toString()).toBe('4.6083');
    expect(MARKET_UNIT_METADATA.GRAM.gramsPerUnit?.toString()).toBe('1');
    expect(MARKET_UNIT_METADATA.UNIT.isMassUnit).toBe(false);
  });
});
