import { DomainError } from '../common/errors.js';
import type { Result } from '../common/result.js';
import type { MarketDataSourceId } from '../domain/market-data/market-data-source.js';
import type { MarketInstrument } from '../domain/market-data/market-instrument.js';
import type { MarketDataQuality } from '../domain/market-data/market-data-types.js';
import type { MarketUnitCode } from '../domain/market-data/market-unit.js';
import type { CurrencyCode } from '../domain/finance/currency.js';

export type ProviderErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'UNSUPPORTED_INSTRUMENT'
  | 'MALFORMED_RESPONSE'
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR';

export class ProviderError extends DomainError {
  override readonly code: ProviderErrorCode;
  readonly httpStatus = 503;
  readonly providerId: string;
  override readonly details?: Record<string, unknown> | undefined;

  constructor(params: {
    code: ProviderErrorCode;
    providerId: string;
    message: string;
    details?: Record<string, unknown> | undefined;
  }) {
    super(params.message, params.details);
    this.name = 'ProviderError';
    this.code = params.code;
    this.providerId = params.providerId;
    this.details = params.details;
  }
}

export interface ProviderCapabilities {
  readonly supportedSymbols: readonly string[];
  readonly supportedUnits: readonly MarketUnitCode[];
  readonly supportedCurrencies: readonly CurrencyCode[];
  readonly qualitiesProvided: readonly MarketDataQuality[];
  readonly isRealTime: boolean;
  readonly rateLimitPerMinute?: number | undefined;
}

export interface ProviderObservationRaw {
  readonly instrumentSymbol: string;
  readonly amount: string; // Exact decimal string from provider
  readonly currency: string;
  readonly unit: string;
  readonly quality: MarketDataQuality;
  readonly observedAt: Date;
  readonly externalId?: string | undefined;
  readonly bid?: string | undefined;
  readonly ask?: string | undefined;
  readonly rawMetadata?: Record<string, unknown> | undefined;
}

/**
 * MarketDataProviderPort.
 * Provider-neutral interface for external precious metals market data providers.
 * External provider SDKs, HTTP clients, and credentials must never leak into core.
 */
export interface MarketDataProviderPort {
  readonly providerId: MarketDataSourceId;
  readonly providerName: string;

  getCapabilities(): Promise<ProviderCapabilities>;

  fetchObservation(
    instrument: MarketInstrument
  ): Promise<Result<ProviderObservationRaw, ProviderError>>;

  fetchObservations?(
    instruments: MarketInstrument[]
  ): Promise<Result<ProviderObservationRaw[], ProviderError>>;
}
