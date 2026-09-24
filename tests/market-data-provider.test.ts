import { describe, expect, it } from 'vitest';
import {
  UnavailableMarketDataProvider,
  MockMarketDataProvider,
} from '@v-gold/database';
import {
  MarketInstrument,
  ProviderError,
} from '@v-gold/core';

describe('Market Data Provider Adapters & Contracts', () => {
  const goldInstrument = MarketInstrument.create({
    id: 'inst_xau_usd',
    symbol: 'XAU/USD',
    baseAsset: 'XAU',
    quoteCurrency: 'USD',
    unit: 'TROY_OUNCE',
    displayName: 'Gold Spot USD',
  }).unwrap();

  const unsupportedInstrument = MarketInstrument.create({
    id: 'inst_unsupported',
    symbol: 'PLAT/USD',
    baseAsset: 'PLAT',
    quoteCurrency: 'USD',
    unit: 'TROY_OUNCE',
    displayName: 'Platinum USD',
  }).unwrap();

  describe('UnavailableMarketDataProvider (Production Default)', () => {
    it('reports unavailable capabilities without fabricating supported instruments', async () => {
      const provider = new UnavailableMarketDataProvider();
      const capabilities = await provider.getCapabilities();

      expect(capabilities.isRealTime).toBe(false);
      expect(capabilities.supportedSymbols.length).toBe(0);
      expect(provider.providerId).toBe('src_unavailable');
    });

    it('returns explicit PROVIDER_UNAVAILABLE error and never invents fake prices', async () => {
      const provider = new UnavailableMarketDataProvider();
      const result = await provider.fetchObservation(goldInstrument);

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error.code).toBe('PROVIDER_UNAVAILABLE');
        expect(result.error.message).toContain('No external provider credentials configured');
        expect(result.error.httpStatus).toBe(503);
      }
    });
  });

  describe('MockMarketDataProvider (Automated Testing Only)', () => {
    it('declares test-only flag and serves deterministic test observations', async () => {
      const mock = new MockMarketDataProvider();
      expect(mock.isTestOnly).toBe(true);

      const capabilities = await mock.getCapabilities();
      expect(capabilities.supportedSymbols).toContain('XAU/USD');
      expect(capabilities.isRealTime).toBe(true);

      const result = await mock.fetchObservation(goldInstrument);
      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.instrumentSymbol).toBe('XAU/USD');
        expect(result.value.amount).toBe('2650.50000000');
        expect(result.value.currency).toBe('USD');
        expect(result.value.unit).toBe('TROY_OUNCE');
      }
    });

    it('rejects unsupported instruments with UNSUPPORTED_INSTRUMENT code', async () => {
      const mock = new MockMarketDataProvider();
      const result = await mock.fetchObservation(unsupportedInstrument);

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error.code).toBe('UNSUPPORTED_INSTRUMENT');
        expect(result.error.message).toContain('not supported');
      }
    });

    it('allows simulating provider errors (network, timeout, rate limiting)', async () => {
      const mock = new MockMarketDataProvider();
      mock.setSimulateError(
        new ProviderError({
          code: 'RATE_LIMITED',
          providerId: mock.providerId,
          message: 'Provider rate limit exceeded (HTTP 429).',
        })
      );

      const result = await mock.fetchObservation(goldInstrument);
      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error.code).toBe('RATE_LIMITED');
        expect(result.error.message).toContain('rate limit exceeded');
      }
    });
  });
});
