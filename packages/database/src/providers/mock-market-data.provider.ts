import {
  type MarketDataProviderPort,
  type ProviderCapabilities,
  type ProviderObservationRaw,
  ProviderError,
  type MarketInstrument,
  createEntityId,
  type MarketDataSourceId,
  err,
  ok,
  type Result,
  type MarketDataQuality,
  type MarketUnitCode,
  type CurrencyCode,
} from '@v-gold/core';

export interface MockProviderOptions {
  providerId?: string;
  providerName?: string;
  capabilities?: Partial<ProviderCapabilities>;
  simulateError?: ProviderError;
  fixedObservations?: Map<string, ProviderObservationRaw>;
}

/**
 * MockMarketDataProvider.
 * STRICTLY FOR AUTOMATED TESTING ONLY.
 * Never to be used as a production market data source.
 */
export class MockMarketDataProvider implements MarketDataProviderPort {
  readonly isTestOnly: boolean = true;
  readonly providerId: MarketDataSourceId;
  readonly providerName: string;
  private readonly capabilities: ProviderCapabilities;
  private simulateError?: ProviderError | undefined;
  private readonly fixedObservations: Map<string, ProviderObservationRaw>;

  constructor(options: MockProviderOptions = {}) {
    this.providerId = createEntityId<MarketDataSourceId>(options.providerId ?? 'src_mock_test');
    this.providerName = options.providerName ?? 'Test Mock Market Data Provider';
    this.simulateError = options.simulateError;
    this.fixedObservations = options.fixedObservations ?? new Map();

    this.capabilities = {
      supportedSymbols: options.capabilities?.supportedSymbols ?? [
        'XAU/USD',
        'XAU/EUR',
        'XAU/IRR',
        'XAG/USD',
      ],
      supportedUnits: options.capabilities?.supportedUnits ?? [
        'TROY_OUNCE' as MarketUnitCode,
        'GRAM' as MarketUnitCode,
        'MESGHAL' as MarketUnitCode,
      ],
      supportedCurrencies: options.capabilities?.supportedCurrencies ?? [
        'USD' as CurrencyCode,
        'EUR' as CurrencyCode,
        'IRR' as CurrencyCode,
      ],
      qualitiesProvided: options.capabilities?.qualitiesProvided ?? [
        'REAL_TIME' as MarketDataQuality,
        'DELAYED' as MarketDataQuality,
      ],
      isRealTime: options.capabilities?.isRealTime ?? true,
    };
  }

  setSimulateError(error?: ProviderError | undefined): void {
    this.simulateError = error;
  }

  setObservation(symbol: string, raw: ProviderObservationRaw): void {
    this.fixedObservations.set(symbol.toUpperCase(), raw);
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return this.capabilities;
  }

  async fetchObservation(
    instrument: MarketInstrument
  ): Promise<Result<ProviderObservationRaw, ProviderError>> {
    if (this.simulateError) {
      return err(this.simulateError);
    }

    if (!this.capabilities.supportedSymbols.includes(instrument.symbol)) {
      return err(
        new ProviderError({
          code: 'UNSUPPORTED_INSTRUMENT',
          providerId: this.providerId,
          message: `Instrument "${instrument.symbol}" is not supported by mock provider.`,
        })
      );
    }

    const custom = this.fixedObservations.get(instrument.symbol.toUpperCase());
    if (custom) {
      return ok(custom);
    }

    // Default deterministic test observation
    return ok({
      instrumentSymbol: instrument.symbol,
      amount: '2650.50000000',
      currency: instrument.quoteCurrency,
      unit: instrument.unit,
      quality: 'REAL_TIME',
      observedAt: new Date(),
      bid: '2650.25000000',
      ask: '2650.75000000',
      externalId: `mock_${Date.now()}`,
    });
  }
}
