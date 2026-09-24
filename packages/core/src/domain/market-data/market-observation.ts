import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import type { MarketDataSourceId } from './market-data-source.js';
import type { MarketInstrumentId } from './market-instrument.js';
import { MarketPrice, type MarketPriceDto } from './market-price.js';
import type { MarketDataQuality, MarketDataStatus } from './market-data-types.js';

export type MarketObservationId = EntityId<'MarketObservation'>;

export function createMarketObservationId(raw: string): Result<MarketObservationId, ValidationError> {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 64) {
    return err(new ValidationError(`MarketObservationId must be between 2 and 64 characters: "${raw}"`));
  }
  return ok(createEntityId<MarketObservationId>(trimmed));
}

export interface MarketObservationDto {
  id: string;
  instrumentId: string;
  sourceId: string;
  price: MarketPriceDto;
  quality: MarketDataQuality;
  observedAt: string;
  ingestedAt: string;
  externalId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

// 5 minutes max clock skew tolerance for external provider timestamps
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * MarketObservation Entity.
 * An immutable historical record of an externally observed market rate.
 * Preserves exact source identity, quoted units, and distinct observed/ingested timestamps.
 */
export class MarketObservation extends Entity<MarketObservationId> {
  private _instrumentId: MarketInstrumentId;
  private _sourceId: MarketDataSourceId;
  private _price: MarketPrice;
  private _quality: MarketDataQuality;
  private _observedAt: Date;
  private _ingestedAt: Date;
  private _externalId?: string | undefined;
  private _metadata?: Record<string, unknown> | undefined;

  private constructor(
    id: MarketObservationId,
    instrumentId: MarketInstrumentId,
    sourceId: MarketDataSourceId,
    price: MarketPrice,
    quality: MarketDataQuality,
    observedAt: Date,
    ingestedAt: Date,
    externalId?: string | undefined,
    metadata?: Record<string, unknown> | undefined
  ) {
    super(id);
    this._instrumentId = instrumentId;
    this._sourceId = sourceId;
    this._price = price;
    this._quality = quality;
    this._observedAt = observedAt;
    this._ingestedAt = ingestedAt;
    this._externalId = externalId;
    this._metadata = metadata;
  }

  get instrumentId(): MarketInstrumentId {
    return this._instrumentId;
  }

  get sourceId(): MarketDataSourceId {
    return this._sourceId;
  }

  get price(): MarketPrice {
    return this._price;
  }

  get quality(): MarketDataQuality {
    return this._quality;
  }

  get observedAt(): Date {
    return this._observedAt;
  }

  get ingestedAt(): Date {
    return this._ingestedAt;
  }

  get externalId(): string | undefined {
    return this._externalId;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this._metadata ? { ...this._metadata } : undefined;
  }

  static create(params: {
    id: string;
    instrumentId: MarketInstrumentId;
    sourceId: MarketDataSourceId;
    price: MarketPrice;
    quality: MarketDataQuality;
    observedAt: Date;
    ingestedAt?: Date | undefined;
    externalId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  }): Result<MarketObservation, ValidationError> {
    const idResult = createMarketObservationId(params.id);
    if (idResult.isErr) return err(idResult.error);

    if (!(params.observedAt instanceof Date) || isNaN(params.observedAt.getTime())) {
      return err(new ValidationError('MarketObservation observedAt must be a valid Date.'));
    }

    const now = new Date();
    if (params.observedAt.getTime() > now.getTime() + MAX_CLOCK_SKEW_MS) {
      return err(
        new ValidationError(
          `MarketObservation observedAt cannot be in the future: "${params.observedAt.toISOString()}".`
        )
      );
    }

    const ingestedAt = params.ingestedAt ?? now;
    if (!(ingestedAt instanceof Date) || isNaN(ingestedAt.getTime())) {
      return err(new ValidationError('MarketObservation ingestedAt must be a valid Date.'));
    }

    return ok(
      new MarketObservation(
        idResult.value,
        params.instrumentId,
        params.sourceId,
        params.price,
        params.quality,
        params.observedAt,
        ingestedAt,
        params.externalId?.trim(),
        params.metadata ? Object.freeze({ ...params.metadata }) : undefined
      )
    );
  }

  static reconstitute(
    id: MarketObservationId,
    instrumentId: MarketInstrumentId,
    sourceId: MarketDataSourceId,
    price: MarketPrice,
    quality: MarketDataQuality,
    observedAt: Date,
    ingestedAt: Date,
    externalId?: string | undefined,
    metadata?: Record<string, unknown> | undefined
  ): MarketObservation {
    return new MarketObservation(
      id,
      instrumentId,
      sourceId,
      price,
      quality,
      observedAt,
      ingestedAt,
      externalId,
      metadata
    );
  }

  /**
   * Evaluates freshness status against a maximum age threshold in milliseconds.
   */
  determineStatus(maxAgeMs: number, now: Date = new Date()): MarketDataStatus {
    const ageMs = now.getTime() - this._observedAt.getTime();
    if (ageMs < 0) {
      // Small clock skew: still consider fresh
      return 'FRESH';
    }
    return ageMs <= maxAgeMs ? 'FRESH' : 'STALE';
  }

  isStale(maxAgeMs: number, now: Date = new Date()): boolean {
    return this.determineStatus(maxAgeMs, now) === 'STALE';
  }

  toDto(): MarketObservationDto {
    return {
      id: this.id,
      instrumentId: this._instrumentId,
      sourceId: this._sourceId,
      price: this._price.toDto(),
      quality: this._quality,
      observedAt: this._observedAt.toISOString(),
      ingestedAt: this._ingestedAt.toISOString(),
      externalId: this._externalId,
      metadata: this._metadata,
    };
  }
}
