import {
  type MarketDataProviderPort,
  type ProviderCapabilities,
  type ProviderObservationRaw,
  ProviderError,
  type MarketInstrument,
  createEntityId,
  type MarketDataSourceId,
  err,
  type Result,
} from '@v-gold/core';

/**
 * UnavailableMarketDataProvider.
 * Default production provider adapter when no real external provider credentials are configured.
 * Strictly adheres to Principle 1 & 15: Never invent live market data, never present fake data as real.
 */
export class UnavailableMarketDataProvider implements MarketDataProviderPort {
  readonly providerId: MarketDataSourceId;
  readonly providerName: string = 'Unavailable Market Data Provider (No Credentials)';

  constructor() {
    this.providerId = createEntityId<MarketDataSourceId>('src_unavailable');
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return {
      supportedSymbols: [],
      supportedUnits: [],
      supportedCurrencies: [],
      qualitiesProvided: [],
      isRealTime: false,
    };
  }

  async fetchObservation(
    instrument: MarketInstrument
  ): Promise<Result<ProviderObservationRaw, ProviderError>> {
    return err(
      new ProviderError({
        code: 'PROVIDER_UNAVAILABLE',
        providerId: this.providerId,
        message: `Market data provider is unavailable for "${instrument.symbol}": No external provider credentials configured in environment.`,
      })
    );
  }
}
