import type { MarketObservation } from '../domain/market-data/market-observation.js';
import type { MarketInstrumentId } from '../domain/market-data/market-instrument.js';
import type { MarketDataSourceId } from '../domain/market-data/market-data-source.js';

export interface MarketObservationRepositoryPort {
  save(observation: MarketObservation): Promise<void>;
  saveBatch(observations: MarketObservation[]): Promise<number>;
  findLatestByInstrument(instrumentId: MarketInstrumentId): Promise<MarketObservation | null>;
  findHistory(
    instrumentId: MarketInstrumentId,
    from: Date,
    to: Date,
    limit?: number
  ): Promise<MarketObservation[]>;
  exists(
    sourceId: MarketDataSourceId,
    instrumentId: MarketInstrumentId,
    observedAt: Date
  ): Promise<boolean>;
  count(): Promise<number>;
}
