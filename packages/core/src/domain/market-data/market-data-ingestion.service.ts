import { DomainError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import type { MarketDataProviderPort, ProviderObservationRaw } from '../../ports/market-data-provider.port.js';
import type { MarketObservationRepositoryPort } from '../../ports/market-observation.repository.port.js';
import type { MarketInstrumentRepositoryPort } from '../../ports/market-instrument.repository.port.js';
import type { MarketDataSourceRepositoryPort } from '../../ports/market-data-source.repository.port.js';
import { MarketObservation, type MarketObservationId } from './market-observation.js';
import { MarketPrice } from './market-price.js';
import type { MarketInstrument } from './market-instrument.js';
import type { MarketDataSourceId } from './market-data-source.js';
import { createEntityId } from '../../common/id.js';
import { generateId } from '../../common/id-generator.js';
import crypto from 'node:crypto';

export type IngestionErrorCode =
  | 'INSTRUMENT_NOT_FOUND'
  | 'SOURCE_NOT_FOUND'
  | 'PROVIDER_ERROR'
  | 'VALIDATION_FAILED'
  | 'PERSISTENCE_FAILED';

export class IngestionError extends DomainError {
  override readonly code: IngestionErrorCode;
  readonly httpStatus: number;
  override readonly details?: Record<string, unknown> | undefined;

  constructor(
    code: IngestionErrorCode,
    message: string,
    details?: Record<string, unknown> | undefined
  ) {
    super(message, details);
    this.name = 'IngestionError';
    this.code = code;
    this.details = details;

    switch (code) {
      case 'INSTRUMENT_NOT_FOUND':
      case 'SOURCE_NOT_FOUND':
        this.httpStatus = 404;
        break;
      case 'VALIDATION_FAILED':
        this.httpStatus = 400;
        break;
      case 'PROVIDER_ERROR':
        this.httpStatus = 502;
        break;
      case 'PERSISTENCE_FAILED':
      default:
        this.httpStatus = 500;
        break;
    }
  }
}

export interface IngestionResult {
  readonly observation: MarketObservation;
  readonly isDuplicate: boolean;
}

/**
 * MarketDataIngestionService.
 * Ingests external market observations into the authoritative repository.
 * Enforces:
 * - Instrument and Source validation
 * - Strict Decimal parsing
 * - Idempotency by (sourceId, instrumentId, observedAt)
 * - Distinct observedAt vs ingestedAt timestamps
 * - Immutable historical persistence
 */
export class MarketDataIngestionService {
  constructor(
    private readonly observationRepo: MarketObservationRepositoryPort,
    private readonly instrumentRepo: MarketInstrumentRepositoryPort,
    private readonly sourceRepo: MarketDataSourceRepositoryPort
  ) {}

  /**
   * Pulls and ingests a live observation from an external provider port for a given instrument.
   */
  async ingestFromProvider(
    provider: MarketDataProviderPort,
    instrument: MarketInstrument
  ): Promise<Result<IngestionResult, IngestionError>> {
    // 1. Verify capability
    const capabilities = await provider.getCapabilities();
    if (!capabilities.supportedSymbols.includes(instrument.symbol)) {
      return err(
        new IngestionError(
          'PROVIDER_ERROR',
          `Provider "${provider.providerName}" does not support instrument "${instrument.symbol}".`
        )
      );
    }

    // 2. Fetch raw observation from provider
    const fetchResult = await provider.fetchObservation(instrument);
    if (fetchResult.isErr) {
      return err(
        new IngestionError(
          'PROVIDER_ERROR',
          `Provider "${provider.providerName}" failed to fetch observation: ${fetchResult.error.message}`,
          fetchResult.error.details
        )
      );
    }

    // 3. Ingest raw observation
    return this.ingestRawObservation({
      sourceId: provider.providerId,
      instrument,
      raw: fetchResult.value,
    });
  }

  /**
   * Validates and ingests a raw observation payload.
   */
  async ingestRawObservation(params: {
    sourceId: MarketDataSourceId;
    instrument: MarketInstrument;
    raw: ProviderObservationRaw;
  }): Promise<Result<IngestionResult, IngestionError>> {
    const { sourceId, instrument, raw } = params;

    // 1. Verify instrument is registered and active
    const registeredInstrument = await this.instrumentRepo.findById(instrument.id);
    if (!registeredInstrument || !registeredInstrument.isActive) {
      return err(
        new IngestionError(
          'INSTRUMENT_NOT_FOUND',
          `Active instrument "${instrument.symbol}" (${instrument.id}) not found in registry.`
        )
      );
    }

    // 2. Verify source is registered and active
    const registeredSource = await this.sourceRepo.findById(sourceId);
    if (!registeredSource || !registeredSource.isActive) {
      return err(
        new IngestionError(
          'SOURCE_NOT_FOUND',
          `Active market data source "${sourceId}" not found in registry.`
        )
      );
    }

    // 3. Idempotency Check: (sourceId, instrumentId, observedAt)
    const exists = await this.observationRepo.exists(sourceId, instrument.id, raw.observedAt);
    if (exists) {
      // Find existing latest observation to return idempotently
      const existing = await this.observationRepo.findLatestByInstrument(instrument.id);
      if (existing && existing.observedAt.getTime() === raw.observedAt.getTime()) {
        return ok({ observation: existing, isDuplicate: true });
      }
    }

    // 4. Build and validate MarketPrice
    const priceResult = MarketPrice.create({
      amount: raw.amount,
      currency: raw.currency,
      unit: raw.unit,
      bid: raw.bid,
      ask: raw.ask,
    });
    if (priceResult.isErr) {
      return err(
        new IngestionError('VALIDATION_FAILED', `Invalid market price: ${priceResult.error.message}`, {
          rawPrice: raw.amount,
        })
      );
    }

    // 5. Verify currency and unit match instrument specifications
    if (priceResult.value.currency !== instrument.quoteCurrency) {
      return err(
        new IngestionError(
          'VALIDATION_FAILED',
          `Observation currency mismatch: expected "${instrument.quoteCurrency}", received "${priceResult.value.currency}".`
        )
      );
    }

    if (priceResult.value.unit !== instrument.unit) {
      return err(
        new IngestionError(
          'VALIDATION_FAILED',
          `Observation unit mismatch: expected "${instrument.unit}", received "${priceResult.value.unit}".`
        )
      );
    }

    // 6. Construct MarketObservation
    const observationId = createEntityId<MarketObservationId>(
      generateId('obs')
    );
    const observationResult = MarketObservation.create({
      id: observationId,
      instrumentId: instrument.id,
      sourceId,
      price: priceResult.value,
      quality: raw.quality,
      observedAt: raw.observedAt,
      ingestedAt: new Date(),
      externalId: raw.externalId,
      metadata: raw.rawMetadata,
    });

    if (observationResult.isErr) {
      return err(
        new IngestionError(
          'VALIDATION_FAILED',
          `Observation validation failed: ${observationResult.error.message}`
        )
      );
    }

    // 7. Persist to repository
    try {
      await this.observationRepo.save(observationResult.value);
    } catch (dbErr) {
      return err(
        new IngestionError(
          'PERSISTENCE_FAILED',
          `Failed to persist observation: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`
        )
      );
    }

    return ok({
      observation: observationResult.value,
      isDuplicate: false,
    });
  }
}
