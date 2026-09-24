import { DomainError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import type { MarketObservationRepositoryPort } from '../../ports/market-observation.repository.port.js';
import type { MarketInstrumentRepositoryPort } from '../../ports/market-instrument.repository.port.js';
import type { MarketDataSourceRepositoryPort } from '../../ports/market-data-source.repository.port.js';
import type { MarketObservation, MarketObservationDto } from './market-observation.js';
import type { MarketInstrument, MarketInstrumentId } from './market-instrument.js';
import type { MarketDataSource } from './market-data-source.js';
import { MarketDataFreshnessPolicy } from './market-data-freshness.policy.js';
import type { MarketDataStatus } from './market-data-types.js';

export interface LatestObservationResult {
  readonly instrument: MarketInstrument;
  readonly source: MarketDataSource;
  readonly observation: MarketObservation;
  readonly status: MarketDataStatus;
  readonly ageMs: number;
}

export interface LatestObservationDto {
  instrument: {
    id: string;
    symbol: string;
    baseAsset: string;
    quoteCurrency: string;
    unit: string;
    displayName: string;
  };
  source: {
    id: string;
    name: string;
    code: string;
  };
  observation: MarketObservationDto;
  status: MarketDataStatus;
  ageMs: number;
}

export type MarketDataQueryErrorCode =
  | 'INSTRUMENT_NOT_FOUND'
  | 'OBSERVATION_UNAVAILABLE'
  | 'SOURCE_NOT_FOUND';

export class MarketDataQueryError extends DomainError {
  override readonly code: MarketDataQueryErrorCode;
  readonly httpStatus: number;

  constructor(code: MarketDataQueryErrorCode, message: string) {
    super(message);
    this.name = 'MarketDataQueryError';
    this.code = code;

    switch (code) {
      case 'INSTRUMENT_NOT_FOUND':
      case 'SOURCE_NOT_FOUND':
        this.httpStatus = 404;
        break;
      case 'OBSERVATION_UNAVAILABLE':
        this.httpStatus = 503;
        break;
      default:
        this.httpStatus = 500;
        break;
    }
  }
}

/**
 * MarketDataQueryService.
 * Authoritative query service for external market data observations.
 * Truthfully evaluates freshness status (FRESH vs STALE vs UNAVAILABLE).
 * Never substitutes fake data for missing or stale data.
 */
export class MarketDataQueryService {
  constructor(
    private readonly observationRepo: MarketObservationRepositoryPort,
    private readonly instrumentRepo: MarketInstrumentRepositoryPort,
    private readonly sourceRepo: MarketDataSourceRepositoryPort,
    private readonly freshnessPolicy: MarketDataFreshnessPolicy = new MarketDataFreshnessPolicy()
  ) {}

  /**
   * Retrieves the latest observation for an instrument symbol or ID.
   */
  async getLatestObservation(
    symbolOrId: string,
    now: Date = new Date()
  ): Promise<Result<LatestObservationResult, MarketDataQueryError>> {
    // 1. Resolve instrument
    let instrument = await this.instrumentRepo.findBySymbol(symbolOrId);
    if (!instrument) {
      instrument = await this.instrumentRepo.findById(symbolOrId as MarketInstrumentId);
    }
    if (!instrument || !instrument.isActive) {
      return err(
        new MarketDataQueryError(
          'INSTRUMENT_NOT_FOUND',
          `Active instrument "${symbolOrId}" not found in registry.`
        )
      );
    }

    // 2. Fetch latest observation
    const observation = await this.observationRepo.findLatestByInstrument(instrument.id);
    if (!observation) {
      return err(
        new MarketDataQueryError(
          'OBSERVATION_UNAVAILABLE',
          `No market observation currently available for instrument "${instrument.symbol}".`
        )
      );
    }

    // 3. Resolve source
    const source = await this.sourceRepo.findById(observation.sourceId);
    if (!source) {
      return err(
        new MarketDataQueryError(
          'SOURCE_NOT_FOUND',
          `Market data source "${observation.sourceId}" not found in registry.`
        )
      );
    }

    // 4. Evaluate freshness status
    const status = this.freshnessPolicy.evaluate(observation, now);
    const ageMs = this.freshnessPolicy.getAgeMs(observation, now);

    return ok({
      instrument,
      source,
      observation,
      status,
      ageMs,
    });
  }

  /**
   * Retrieves historical observations for an instrument.
   */
  async getHistoricalObservations(
    symbolOrId: string,
    from: Date,
    to: Date,
    limit: number = 100
  ): Promise<Result<MarketObservation[], MarketDataQueryError>> {
    let instrument = await this.instrumentRepo.findBySymbol(symbolOrId);
    if (!instrument) {
      instrument = await this.instrumentRepo.findById(symbolOrId as MarketInstrumentId);
    }
    if (!instrument || !instrument.isActive) {
      return err(
        new MarketDataQueryError(
          'INSTRUMENT_NOT_FOUND',
          `Active instrument "${symbolOrId}" not found in registry.`
        )
      );
    }

    const history = await this.observationRepo.findHistory(instrument.id, from, to, limit);
    return ok(history);
  }
}
